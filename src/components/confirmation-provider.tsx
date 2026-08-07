"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay-panel";

export type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
};

type ConfirmRequest = ConfirmOptions & { resolve: (confirmed: boolean) => void };
type ConfirmFunction = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmationContext = createContext<ConfirmFunction | null>(null);

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const activeRequestRef = useRef<ConfirmRequest | null>(null);

  const finish = useCallback((confirmed: boolean) => {
    const activeRequest = activeRequestRef.current;
    if (!activeRequest) return;
    activeRequestRef.current = null;
    setRequest(null);
    activeRequest.resolve(confirmed);
  }, []);

  const confirm = useCallback<ConfirmFunction>((options) => new Promise((resolve) => {
    activeRequestRef.current?.resolve(false);
    const nextRequest = { ...options, resolve };
    activeRequestRef.current = nextRequest;
    setRequest(nextRequest);
  }), []);

  useEffect(() => () => {
    activeRequestRef.current?.resolve(false);
    activeRequestRef.current = null;
  }, []);

  const danger = request?.tone === "danger";

  return (
    <ConfirmationContext.Provider value={confirm}>
      {children}
      <Dialog
        open={Boolean(request)}
        onOpenChange={(open) => { if (!open) finish(false); }}
        title={request?.title ?? "Confirmar ação"}
        description={request?.description}
        footer={request ? (
          <>
            <Button variant="secondary" onClick={() => finish(false)}>{request.cancelLabel ?? "Cancelar"}</Button>
            <Button variant={danger ? "danger" : "primary"} onClick={() => finish(true)}>
              {danger ? <AlertTriangle className="h-4 w-4" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
              {request.confirmLabel ?? "Confirmar"}
            </Button>
          </>
        ) : undefined}
      >
        {request ? (
          <div className={`flex items-start gap-3 rounded-xl border p-4 text-sm leading-6 ${danger ? "border-red-200 bg-red-50 text-red-900" : "border-blue-200 bg-blue-50 text-blue-950"}`}>
            {danger ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />}
            <p>Revise as informações antes de continuar. A ação só será executada depois da confirmação.</p>
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
