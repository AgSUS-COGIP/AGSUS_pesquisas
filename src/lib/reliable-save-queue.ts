export type SaveQueueStatus = "IDLE" | "SAVING" | "ERROR";

export type SaveQueueSnapshot = {
  status: SaveQueueStatus;
  pending: number;
  lastError: Error | null;
};

type SaveOperation = () => Promise<void>;
type Listener = (snapshot: SaveQueueSnapshot) => void;

/** Chave usada quando o chamador não correlaciona a gravação a um item. */
const SEM_CHAVE = "__sem_chave__";

/**
 * Fila que serializa gravações de rascunho, preservando a ordem de digitação.
 *
 * Sem serialização, dois autossalvamentos concorrentes da mesma pergunta podem
 * chegar ao banco fora de ordem e gravar o valor antigo por último.
 *
 * As falhas são rastreadas **por chave** (`enqueue(op, chave)`): o sucesso de
 * uma gravação só limpa a falha da mesma chave. Sem isso, a falha da pergunta A
 * seria mascarada pelo sucesso da pergunta B, o indicador de erro sumiria e
 * `flush()` liberaria o envio definitivo com a resposta A ausente no banco.
 */
export class ReliableSaveQueue {
  private tail: Promise<void> = Promise.resolve();
  private pending = 0;
  private failures = new Map<string, Error>();
  private listeners = new Set<Listener>();

  private lastFailure(): Error | null {
    let last: Error | null = null;
    for (const error of this.failures.values()) last = error;
    return last;
  }

  getSnapshot(): SaveQueueSnapshot {
    const lastError = this.lastFailure();
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
   * @param key identifica o item gravado (ex.: id da pergunta). O sucesso desta
   * operação limpa apenas a falha registrada para a **mesma** chave — regravar
   * o item que falhou é o que resolve o erro, não gravar qualquer outro.
   * @returns promessa que rejeita se **esta** operação falhar, para o chamador
   * exibir a mensagem. A fila interna continua avançando de qualquer forma.
   */
  enqueue(operation: SaveOperation, key: string = SEM_CHAVE) {
    this.pending += 1;
    this.emit();

    const run = async () => {
      try {
        await operation();
        this.failures.delete(key);
      } catch (error) {
        const failure = error instanceof Error ? error : new Error("Falha desconhecida ao salvar.");
        this.failures.set(key, failure);
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

  /**
   * Aguarda a fila esvaziar e relança a falha mais recente ainda não resolvida
   * (de qualquer chave). Use antes do envio definitivo: enquanto houver
   * gravação falhada sem retentativa bem-sucedida, o envio não pode prosseguir.
   */
  async flush() {
    await this.tail;
    const failure = this.lastFailure();
    if (failure) throw failure;
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
