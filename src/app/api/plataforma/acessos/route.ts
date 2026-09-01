import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro } from "@/lib/api/resposta-http";
import type { AreaDeAcessos } from "@/lib/api/contratos-pessoas";
import { parseAccessPagination } from "@/lib/access-pagination";

/**
 * Matriz de permissões e pessoas.
 *
 * Devolve o agregado inteiro (`permissions` + `people`): as colunas da tabela
 * são o catálogo que acompanha cada página de pessoas.
 */
export async function GET(request: Request) {
  const { search, limit, offset } = parseAccessPagination(new URL(request.url).searchParams);

  const banco = await createServerRpcClient();
  const { data, error } = await banco.rpc("FC_LISTAR_ACESSOS_PAGINADOS", {
    p_busca: search,
    p_limite: limit,
    p_offset: offset,
  });

  if (error) return respostaDeErro(error, "GET /api/plataforma/acessos");

  return NextResponse.json(data as AreaDeAcessos);
}
