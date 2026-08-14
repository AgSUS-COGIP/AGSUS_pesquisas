"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { confirmationReasonError, confirmationReasonValue } from "@/lib/confirmation-prompt";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form-controls";
import { Dialog } from "@/components/ui/overlay-panel";

/**
 * Justificativa exigida junto da confirmação.
 *
 * Existe porque as ações que pedem motivo são justamente as destrutivas, e elas
 * usavam `window.prompt` — que abre fora da aplicação, ignora o tema, não é
 * estilizável, pode estar bloqueado no navegador e não valida nada antes de
 * enviar. Validar aqui evita o pior caso: a pessoa confirma o irreversível, o
 * banco recusa o motivo curto e ela recomeça sem saber o que faltou.
 */
export type ConfirmPrompt = {
  label: string;
  placeholder?: string;
  hint?: string;
  /** Espelha o mínimo que o banco exige, para o erro aparecer antes da viagem. */
  minLength?: number;
};

export type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  prompt?: ConfirmPrompt;
};

type ConfirmOutcome = boolean | string;
type ConfirmRequest = ConfirmOptions & { resolve: (outcome: ConfirmOutcome) => void };

/**
 * Com `prompt`, devolve o texto digitado — ou `false` se a pessoa desistiu.
 * Sem `prompt`, devolve `boolean`, exatamente como antes: nenhuma das chamadas
 * já existentes muda. Texto vazio nunca é devolvido como sucesso, então
 * `if (!(await confirm(…))) return;` continua sendo o padrão nos dois casos.
 */
type ConfirmFunction = {
  (options: ConfirmOptions & { prompt: ConfirmPrompt }): Promise<string | false>;
  (options: ConfirmOptions): Promise<boolean>;
};

const ConfirmationContext = createContext<ConfirmFunction | null>(null);

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const activeRequestRef = useRef<ConfirmRequest | null>(null);

  const finish = useCallback((outcome: ConfirmOutcome) => {
    const activeRequest = activeRequestRef.current;
    if (!activeRequest) return;
    activeRequestRef.current = null;
    setRequest(null);
    setReason("");
    setReasonError(null);
    activeRequest.resolve(outcome);
  }, []);

  const confirmRequest = useCallback(() => {
    const activeRequest = activeRequestRef.current;
    if (!activeRequest) return;
    if (!activeRequest.prompt) {
      finish(true);
      return;
    }

    const problem = confirmationReasonError(reason, activeRequest.prompt.minLength ?? 1);
    if (problem) {
      // O diálogo permanece aberto com o texto preservado: o erro é do campo,
      // não da decisão que a pessoa já tomou.
      setReasonError(problem);
      return;
    }
    finish(confirmationReasonValue(reason));
  }, [finish, reason]);

  const confirm = useCallback((options: ConfirmOptions) => new Promise<ConfirmOutcome>((resolve) => {
    activeRequestRef.current?.resolve(false);
    const nextRequest = { ...options, resolve };
    activeRequestRef.current = nextRequest;
    setReason("");
    setReasonError(null);
    setRequest(nextRequest);
  }), []);

  useEffect(() => () => {
    activeRequestRef.current?.resolve(false);
    activeRequestRef.current = null;
  }, []);

  const danger = request?.tone === "danger";
  const prompt = request?.prompt;

  // A conversão de `confirm` acontece ao fornecer o contexto, e não no
  // `useCallback`: as duas sobrecargas descrevem a mesma implementação —
  // devolve texto quando há `prompt`, booleano quando não há — e o TypeScript
  // não deriva isso sozinho a partir do corpo.
  return (
    <ConfirmationContext.Provider value={confirm as ConfirmFunction}>
      {children}
      <Dialog
        open={Boolean(request)}
        onOpenChange={(open) => { if (!open) finish(false); }}
        title={request?.title ?? "Confirmar ação"}
        description={request?.description}
        footer={request ? (
          <>
            <Button variant="secondary" onClick={() => finish(false)}>{request.cancelLabel ?? "Cancelar"}</Button>
            <Button variant={danger ? "danger" : "primary"} onClick={confirmRequest}>
              {danger ? <AlertTriangle className="h-4 w-4" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
              {request.confirmLabel ?? "Confirmar"}
            </Button>
          </>
        ) : undefined}
      >
        {request ? (
          <div className="space-y-4">
            <div className={`flex items-start gap-3 rounded-xl border p-4 text-sm leading-6 ${danger ? "border-red-200 bg-red-50 text-red-900" : "border-blue-200 bg-blue-50 text-blue-950"}`}>
              {danger ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />}
              <p>Revise as informações antes de continuar. A ação só será executada depois da confirmação.</p>
            </div>

            {prompt ? (
              <Textarea
                label={prompt.label}
                hint={prompt.hint}
                error={reasonError ?? undefined}
                placeholder={prompt.placeholder}
                value={reason}
                required
                rows={3}
                onChange={(event) => {
                  setReason(event.target.value);
                  if (reasonError) setReasonError(null);
                }}
              />
            ) : null}
          </div>
        ) : null}
      </Dialog>
    </ConfirmationContext.Provider>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmationContext);
  if (!confirm) throw new Error("useConfirm precisa ser utilizado dentro de ConfirmationProvider.");
  return confirm;
}
