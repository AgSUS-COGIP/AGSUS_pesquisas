import { NextResponse } from "next/server";
import { verificarProntidao } from "@/lib/readiness";

export const dynamic = "force-dynamic";

/**
 * Readiness: o ambiente está pronto para receber tráfego desta versão?
 *
 * Três perguntas, nesta ordem — a primeira que falhar encerra:
 *
 * ```text
 * 1. as variáveis existem?          (barato, sem rede)
 * 2. o Supabase responde?           (uma ida ao banco)
 * 3. o esquema tem as RPCs desta versão?
 * ```
 *
 * A terceira é a que não existia, e é a que importa. Publicar a aplicação antes
 * das migrations produz `PGRST202` na frente de quem usa, e o health antigo
 * respondia `ok` nesse estado: ele só conferia configuração. Aconteceu duas
 * vezes em agosto de 2026.
 *
 * ## A verificação agora mora fora desta rota
 *
 * `verificarProntidao()` (`@/lib/readiness`) é a definição, e esta rota é
 * apenas um de seus consumidores — o outro é a tela de acesso, que antes
 * inferia saúde a partir da leitura da marca e por isso discordava daqui.
 * Duas regras para a mesma pergunta produziam login normal com o banco fora.
 *
 * ## O que a resposta revela — e o que não revela
 *
 * O corpo público traz apenas `ready` ou `degraded`. Nem nome de variável, nem
 * nome de função, nem mensagem do banco: a rota é anônima, e enumerar o que
 * falta entrega um mapa do ambiente a quem estiver olhando. O detalhe vai para
 * o log do servidor, onde quem opera já tem acesso.
 *
 * O smoke test do deploy usa a **mesma** verificação, mas pelo caminho interno,
 * onde o detalhe é justamente o que se quer ver.
 */
export async function GET() {
  const cabecalhos = {
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
  };

  const prontidao = await verificarProntidao();

  if (prontidao.estado !== "pronta") {
    console.warn("[readiness] degradado:", prontidao.estado, prontidao.detalhe);
    return NextResponse.json({ status: "degraded" }, { status: 503, headers: cabecalhos });
  }

  return NextResponse.json({ status: "ready" }, { status: 200, headers: cabecalhos });
}
