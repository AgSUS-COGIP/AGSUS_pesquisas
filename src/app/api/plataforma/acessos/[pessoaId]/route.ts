import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";
import type { DefinirPerfilEntrada } from "@/lib/api/contratos-pessoas";

/**
 * Define **o** perfil de uma pessoa.
 *
 * `PUT` porque os perfis são mutuamente exclusivos: `fc_definir_perfil_pessoa`
 * encerra os vigentes e concede o escolhido na mesma transação, então a
 * operação substitui o estado inteiro em vez de acrescentar a ele. `POST` num
 * subrecurso "perfis" sugeriria acumulação, que o índice `in_perfil_unico_vigente`
 * impede no banco.
 *
 * A recusa de retirar o próprio Superadmin é regra de negócio e continua na
 * RPC; a tela também a antecipa, para desabilitar o botão com explicação.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ pessoaId: string }> },
) {
  const { pessoaId } = await params;

  if (!ehUuid(pessoaId)) {
    return respostaDeEntradaInvalida("Identificador de pessoa inválido.");
  }

  let corpo: DefinirPerfilEntrada;
  try {
    corpo = await request.json() as DefinirPerfilEntrada;
  } catch {
    return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido.");
  }

  const perfil = typeof corpo.perfil === "string" ? corpo.perfil.trim() : "";
  if (!perfil) {
    return respostaDeEntradaInvalida("Informe o perfil a conceder.");
  }

  const banco = await createServerRpcClient();
  const { data, error } = await banco.rpc("fc_definir_perfil_pessoa", {
    p_pessoa: pessoaId,
    p_perfil: perfil,
  });

  if (error) return respostaDeErro(error, "PUT /api/plataforma/acessos/[pessoaId]");

  return NextResponse.json(data ?? { definido: true });
}
