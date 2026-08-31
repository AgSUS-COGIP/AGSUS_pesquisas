import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro } from "@/lib/api/resposta-http";
import type { PessoaAdministrativa } from "@/lib/api/contratos-pessoas";

/**
 * Busca na base institucional de pessoas.
 *
 * É a rota de maior alcance da plataforma — dados funcionais de todo mundo. O
 * que a protege é a checagem dentro da RPC somada à RLS, não código daqui.
 */
export async function GET(request: Request) {
  const parametros = new URL(request.url).searchParams;
  const busca = parametros.get("busca")?.trim() ?? "";
  const limiteBruto = Number(parametros.get("limite"));
  // Limite fora de faixa vira o padrão em vez de erro: recusar a busca inteira
  // por um refinamento de apresentação seria desproporcional. O valor vai
  // sempre no corpo, mesmo quando é o padrão — o PostgREST resolve a função
  // pelo conjunto de argumentos, e alternar entre dois conjuntos faria a mesma
  // rota depender de duas resoluções distintas.
  const limite = Number.isFinite(limiteBruto) && limiteBruto > 0 && limiteBruto <= 250
    ? Math.trunc(limiteBruto)
    : 50;

  const banco = await createServerRpcClient();
  const { data, error } = await banco.rpc("fc_pesquisar_pessoa_admin", {
    target_search: busca,
    target_limit: limite,
  });

  if (error) return respostaDeErro(error, "GET /api/pessoas");

  const pessoas = Array.isArray(data) ? data as PessoaAdministrativa[] : [];
  return NextResponse.json(pessoas);
}
