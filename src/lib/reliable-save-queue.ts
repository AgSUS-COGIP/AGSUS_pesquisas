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
  private lastError: Error | null = null;
  private listeners = new Set<Listener>();

  getSnapshot(): SaveQueueSnapshot {
    return {
      status: this.lastError ? "ERROR" : this.pending > 0 ? "SAVING" : "IDLE",
      pending: this.pending,
      lastError: this.lastError,
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
  enqueue(operation: SaveOperation) {
    this.pending += 1;
    this.lastError = null;
    this.emit();

    const run = async () => {
      try {
        await operation();
        this.lastError = null;
      } catch (error) {
        this.lastError = error instanceof Error ? error : new Error("Falha desconhecida ao salvar.");
        throw this.lastError;
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
    if (this.lastError) throw this.lastError;
  }

  clearError() {
    this.lastError = null;
    this.emit();
  }

  private emit() {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}
