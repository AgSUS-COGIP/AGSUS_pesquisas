import { Suspense } from "react";
import TelaDeParticipantes from "./tela-admin-participantes";

/*
 * O limite de Suspense existe por causa de `useSearchParams`.
 *
 * A tela lê `?ciclo=` e `?pesquisa=` para chegar já apontada para a avaliação
 * que a pessoa estava configurando. Parâmetro de busca só existe na requisição,
 * então o Next recusa pré-renderizar a página sem um limite que diga o que
 * mostrar enquanto ele não chega.
 *
 * `null` como espera: a própria tela já tem estado de carregamento, e um
 * segundo esqueleto por cima dele piscaria duas vezes para dizer a mesma coisa.
 */
export default function AdminParticipantsRoute() {
  return (
    <Suspense fallback={null}>
      <TelaDeParticipantes />
    </Suspense>
  );
}
