export type SaveQueueStatus = "IDLE" | "SAVING" | "ERROR";

export type SaveQueueSnapshot = {
  status: SaveQueueStatus;
  pending: number;
  lastError: Error | null;
};

type SaveOperation = () => Promise<void>;
type Listener = (snapshot: SaveQueueSnapshot) => void;

/**
 * Fila que serializa gravações de rascunho, preservando a ordem de digitação.
 *
 * Sem serialização, dois autossalvamentos concorrentes da mesma pergunta podem
 * chegar ao banco fora de ordem e gravar o valor antigo por último.
 */
export class ReliableSaveQueue {
  private tail: Promise<void> = Promise.resolve();
  private pending = 0;
  private failures = new Map<string, Error>();
  private operationSequence = 0;
  private listeners = new Set<Listener>();

  getSnapshot(): SaveQueueSnapshot {
    const lastError = Array.from(this.failures.values()).at(-1) ?? null;
    return {
      status: lastError ? "ERROR" : this.pending > 0 ? "SAVING" : "IDLE",
      pending: this.pending,
      lastError,
    };
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Agenda uma gravação após todas as anteriores.
   *
   * @returns promessa que rejeita se **esta** operação falhar, para o chamador
   * exibir a mensagem. A fila interna continua avançando de qualquer forma.
   */
  enqueue(operation: SaveOperation, key?: string) {
    const operationKey = key ?? `operation-${++this.operationSequence}`;
    this.pending += 1;
    // Uma nova tentativa só substitui o erro da mesma resposta. Limpar todos os
    // erros aqui permitiria que o sucesso da pergunta B escondesse a falha da A
    // e liberasse o envio com uma resposta ainda não persistida.
    this.failures.delete(operationKey);
    this.emit();

    const run = async () => {
      try {
        await operation();
        this.failures.delete(operationKey);
      } catch (error) {
        const failure = error instanceof Error ? error : new Error("Falha desconhecida ao salvar.");
        this.failures.set(operationKey, failure);
        throw failure;
      } finally {
        this.pending = Math.max(0, this.pending - 1);
        this.emit();
      }
    };

    // `tail` é mantida sempre resolvida: uma falha não pode travar a fila nem
    // gerar rejeição não tratada. O erro vai apenas para quem chamou `enqueue`.
    const current = this.tail.catch(() => undefined).then(run);
    this.tail = current.catch(() => undefined);
    return current;
  }

  /** Aguarda a fila esvaziar e relança o último erro. Use antes do envio definitivo. */
  async flush() {
    await this.tail;
    const lastError = Array.from(this.failures.values()).at(-1);
    if (lastError) throw lastError;
  }

  clearError() {
    this.failures.clear();
    this.emit();
  }

  private emit() {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}
