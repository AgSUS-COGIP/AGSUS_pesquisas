import { Suspense } from "react";
import TelaDeOperacao from "./tela-admin-operacao-ciclo";

/*
 * Mesmo motivo de `/admin/participantes`: a tela lê `?etapa=` para saber se é a
 * etapa "Ciclo" ou "Revisar e publicar" — duas ênfases da mesma página.
 */
export default function SurveyOperationsRoute({ params }: { params: Promise<{ surveyId: string }> }) {
  return (
    <Suspense fallback={null}>
      <TelaDeOperacao params={params} />
    </Suspense>
  );
}
