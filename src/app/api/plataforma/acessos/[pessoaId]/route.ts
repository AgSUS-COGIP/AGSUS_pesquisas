import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";
import type { DefinirPermissoesEntrada } from "@/lib/api/contratos-pessoas";

/**
 * Substitui o conjunto de permissões funcionais de uma pessoa. A role técnica
 * continua sendo `authenticated`; proteção do próprio administrador e do
 * último administrador permanece transacional na RPC.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ pessoaId: string }> },
) {
  const { pessoaId } = await params;

  if (!ehUuid(pessoaId)) {
    return respostaDeEntradaInvalida("Identificador de pessoa inválido.");
  }

  let corpo: DefinirPermissoesEntrada;
  try {
    corpo = await request.json() as DefinirPermissoesEntrada;
  } catch {
    return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido.");
  }

  if (!Array.isArray(corpo.permissoes)
      || corpo.permissoes.some((permissao) => typeof permissao !== "string")) {
    return respostaDeEntradaInvalida("Informe a lista de permissões da pessoa.");
  }

  const permissoes = [...new Set(corpo.permissoes
    .map((permissao) => permissao.trim().toUpperCase())
    .filter(Boolean))];

  const banco = await createServerRpcClient();
  const { data, error } = await banco.rpc("fc_definir_permissoes_pessoa", {
    p_pessoa: pessoaId,
    p_permissoes: permissoes,
  });

  if (error) return respostaDeErro(error, "PUT /api/plataforma/acessos/[pessoaId]");

  return NextResponse.json(data ?? { definido: true });
}
