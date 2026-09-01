import { NextResponse } from "next/server";
import { getEmailConfigurationStatus } from "@/config/email";
import { createAdminRpcClient } from "@/lib/db/rpc-adapter";
import { getEmpresaDbConfigurationStatus } from "@/lib/db/pool";
import { RPCS_CRITICAS } from "@/lib/rpc-criticas";

export const dynamic = "force-dynamic";

/**
 * Readiness: o ambiente está pronto para receber tráfego desta versão?
 *
 * Três perguntas, nesta ordem — a primeira que falhar encerra:
 *
 * ```text
 * 1. as variáveis existem?          (barato, sem rede)
 * 2. o PostgreSQL responde?         (uma ida ao banco)
 * 3. o esquema tem as RPCs desta versão?
 * ```
 *
 * A terceira é a que não existia, e é a que importa. Publicar a aplicação antes
 * das migrations produz `PGRST202` na frente de quem usa, e o health antigo
 * respondia `ok` nesse estado: ele só conferia configuração. Aconteceu duas
 * vezes em agosto de 2026.
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
  const degradado = (motivo: string, detalhe?: unknown) => {
    console.warn("[readiness] degradado:", motivo, detalhe ?? "");
    return NextResponse.json({ status: "degraded" }, { status: 503, headers: cabecalhos });
  };

  const faltando = [
    ...getEmpresaDbConfigurationStatus().missingVariables,
    ...getEmailConfigurationStatus().missingVariables,
  ];
  if (!process.env.CRON_SECRET?.trim()) faltando.push("CRON_SECRET");

  if (faltando.length) return degradado("configuração ausente", faltando.join(", "));

  try {
    const banco = createAdminRpcClient();
    const { data, error } = await banco.rpc("FC_SRV_VERIFICAR_CONTRATO_RPC", {
      p_nomes: [...RPCS_CRITICAS],
    });

    // A própria função de verificação pode faltar — é o caso de um ambiente
    // atrás da migration que a criou. Isso **é** incompatibilidade de esquema,
    // e não uma falha a ser engolida.
    if (error) return degradado("verificação de contrato falhou", `${error.code} ${error.message}`);

    const resultado = data as { compatible?: boolean; missing?: string[] } | null;
    if (!resultado?.compatible) {
      return degradado("RPCs ausentes no esquema", resultado?.missing?.join(", ") ?? "desconhecido");
    }

    return NextResponse.json({ status: "ready" }, { status: 200, headers: cabecalhos });
  } catch (erro) {
    return degradado("banco inacessível", erro);
  }
}
