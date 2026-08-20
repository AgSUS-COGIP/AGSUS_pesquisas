import { after } from "next/server";
import { dispatchParticipantEmails } from "./despachador";

type DispatchReason = "abertura" | "notificacao";

/** Agenda o mesmo despacho pós-resposta para todas as mutações de ciclo. */
export function scheduleParticipantEmailDispatch(reason: DispatchReason) {
  after(async () => {
    try {
      const result = await dispatchParticipantEmails();
      if (result.status === "skipped") {
        console.warn(
          `[emails] despacho pós-${reason} pulado; configuração ausente:`,
          result.missingConfiguration.join(", "),
        );
      }
    } catch (dispatchError) {
      console.error(`[emails] despacho pós-${reason} falhou:`, dispatchError);
    }
  });
}
