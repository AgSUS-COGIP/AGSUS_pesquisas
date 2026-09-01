import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { PLATFORM_MODULE } from "@/lib/platform-modules";

export const dynamic = "force-dynamic";

/**
 * Responde uma única pergunta: **esta sessão pode atravessar a manutenção
 * global?**
 *
 * ## Por que uma rota, e não uma consulta dentro do proxy
 *
 * O proxy precisa do papel para decidir, e o papel mora no PostgreSQL. Abrir
 * pool de `pg` no proxy resolveria — ele roda em Node.js desde o Next 16 —, mas
 * o proxy executa em **toda** requisição, e um pool com esse ciclo de vida é
 * responsabilidade que não vale a pena colocar ali. Além disso
 * `createServerRpcClient()` lê a sessão por `next/headers`, que não existe no
 * proxy. A rota é a costura natural: o proxy pergunta, quem sabe responder
 * responde.
 *
 * ## Por que ela não é bloqueada pela manutenção que ajuda a aplicar
 *
 * O caminho fica sob `/api/plataforma/manutencao`, que já consta em
 * `ROTAS_SEMPRE_LIBERADAS` — e `ehRotaSempreLiberada` libera a rota e tudo
 * abaixo dela. Sem isso o proxy bloquearia a própria pergunta que faz, e a
 * resposta seria sempre "não".
 *
 * ## O que ela devolve, e o que não devolve
 *
 * Um booleano, e nada mais. Nem o motivo da manutenção, nem quem alterou, nem a
 * lista de módulos da pessoa — o proxy não precisa de nada disso, e o que não é
 * devolvido não vaza. A resposta é sobre a própria sessão de quem pergunta:
 * ninguém descobre daqui o papel de outra pessoa.
 *
 * Falha é `false`, sempre. Banco fora, sessão expirada, RPC recusada — todos
 * levam ao mesmo lugar, porque conceder desvio por não ter conseguido conferir
 * seria abrir a plataforma exatamente quando ela deveria estar fechada.
 */
export async function GET() {
  try {
    const banco = await createServerRpcClient();
    const { data, error } = await banco.rpc("FC_OBTER_CONTEXTO_PLATAFORMA");

    if (error) {
      console.warn("maintenance_bypass_check_failed", { codigo: error.code });
      return recusar();
    }

    const contexto = data as { status?: string; modules?: string[] } | null;
    if (contexto?.status === "AUTH_REQUIRED") return recusar();

    return NextResponse.json(
      { desvio: Boolean(contexto?.modules?.includes(PLATFORM_MODULE.ADMIN_ACCESS)) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (erro) {
    console.warn("maintenance_bypass_check_failed", {
      mensagem: erro instanceof Error ? erro.message : "erro-desconhecido",
    });
    return recusar();
  }
}

/*
  200 com `false`, e não 403: quem pergunta é o proxy, e para ele "não pode
  passar" é uma resposta bem-sucedida, não um erro. Reservar os códigos de falha
  para falha de verdade mantém o log legível quando algo quebrar.
*/
function recusar() {
  return NextResponse.json({ desvio: false }, { headers: { "Cache-Control": "no-store" } });
}
