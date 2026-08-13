import { describe, expect, it, vi } from "vitest";
import { ReliableSaveQueue } from "./reliable-save-queue";

describe("ReliableSaveQueue", () => {
  it("executa operações em sequência", async () => {
    const queue = new ReliableSaveQueue();
    const events: string[] = [];

    const first = queue.enqueue(async () => {
      events.push("primeira-inicio");
      await Promise.resolve();
      events.push("primeira-fim");
    });
    const second = queue.enqueue(async () => {
      events.push("segunda");
    });

    await Promise.all([first, second]);

    expect(events).toEqual(["primeira-inicio", "primeira-fim", "segunda"]);
    expect(queue.getSnapshot()).toEqual({ status: "IDLE", pending: 0, lastError: null });
  });

  it("mantém o erro disponível até uma nova tentativa bem-sucedida", async () => {
    const queue = new ReliableSaveQueue();
    const failure = new Error("Sem conexão");

    await expect(queue.enqueue(async () => {
      throw failure;
    })).rejects.toThrow("Sem conexão");

    expect(queue.getSnapshot().status).toBe("ERROR");
    await expect(queue.flush()).rejects.toThrow("Sem conexão");

    await queue.enqueue(async () => undefined);
    expect(queue.getSnapshot()).toEqual({ status: "IDLE", pending: 0, lastError: null });
  });

  it("sucesso de outra chave não mascara a falha pendente — flush segue barrando o envio", async () => {
    const queue = new ReliableSaveQueue();

    await expect(queue.enqueue(async () => {
      throw new Error("Sem conexão");
    }, "pergunta-a")).rejects.toThrow("Sem conexão");

    await queue.enqueue(async () => undefined, "pergunta-b");

    expect(queue.getSnapshot().status).toBe("ERROR");
    await expect(queue.flush()).rejects.toThrow("Sem conexão");

    await queue.enqueue(async () => undefined, "pergunta-a");
    expect(queue.getSnapshot()).toEqual({ status: "IDLE", pending: 0, lastError: null });
    await expect(queue.flush()).resolves.toBeUndefined();
  });

  it("não interrompe as próximas operações após uma falha", async () => {
    const queue = new ReliableSaveQueue();
    const nextOperation = vi.fn(async () => undefined);

    const failed = queue.enqueue(async () => {
      throw new Error("Falha temporária");
    });
    const recovered = queue.enqueue(nextOperation);

    await expect(failed).rejects.toThrow("Falha temporária");
    await expect(recovered).resolves.toBeUndefined();
    expect(nextOperation).toHaveBeenCalledOnce();
  });

  it("notifica mudanças de estado", async () => {
    const queue = new ReliableSaveQueue();
    const statuses: string[] = [];
    const unsubscribe = queue.subscribe((snapshot) => statuses.push(`${snapshot.status}:${snapshot.pending}`));

    await queue.enqueue(async () => undefined);
    unsubscribe();

    expect(statuses).toEqual(["IDLE:0", "SAVING:1", "IDLE:0"]);
  });

  it("conclui os salvamentos antes de liberar a submissão", async () => {
    const queue = new ReliableSaveQueue();
    const events: string[] = [];
    let releaseSave: (() => void) | undefined;
    let markSaveStarted: (() => void) | undefined;
    const saveStarted = new Promise<void>((resolve) => { markSaveStarted = resolve; });
    const saveGate = new Promise<void>((resolve) => { releaseSave = resolve; });

    const save = queue.enqueue(async () => {
      events.push("salvamento-iniciado");
      markSaveStarted?.();
      await saveGate;
      events.push("salvamento-concluido");
    });
    const submission = queue.flush().then(() => { events.push("submissao"); });

    await saveStarted;
    expect(events).toEqual(["salvamento-iniciado"]);

    releaseSave?.();
    await Promise.all([save, submission]);
    expect(events).toEqual(["salvamento-iniciado", "salvamento-concluido", "submissao"]);
  });
});
