import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";
import {
  CorpoJsonExcedidoError,
  CorpoJsonInvalidoError,
  lerJsonLimitado,
} from "@/lib/api/corpo-json-limitado";
import type { DimensoesDoPublico, RegraDePublico } from "@/lib/api/contratos-publico";

const MAX_REGRA_BYTES = 262_144;

/**
 * Opções de cada dimensão, restringidas pelo que já foi escolhido.
 *
 * É `POST` por transportar a regra no corpo, não por alterar estado: a RPC é
 * `stable`, e função não-volátil não grava no PostgreSQL. Mesmo desenho da
 * prévia.
 *
 * Rota própria em vez de acrescentar um verbo ao `/publico`, onde `POST` já
 * significa "aplicar o público". Dois significados no mesmo par
 * caminho + método é como um erro de digitação vira mil vínculos.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!ehUuid(id)) {
    return respostaDeEntradaInvalida("Identificador de avaliação inválido.");
  }

  let regra: RegraDePublico;
  try {
    regra = await lerJsonLimitado<RegraDePublico>(request, MAX_REGRA_BYTES);
  } catch (erro) {
    if (erro instanceof CorpoJsonExcedidoError) {
      return respostaDeEntradaInvalida("A regra de público excede o tamanho aceito.");
    }
    if (erro instanceof CorpoJsonInvalidoError) {
      return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido.");
    }
    throw erro;
  }

  const banco = await createServerRpcClient();
  const { data, error } = await banco.rpc("FC_LISTAR_DIMENSOES_PUBLICO", { p_regra: regra });

  if (error) return respostaDeErro(error, "POST /api/avaliacoes/[id]/publico/dimensoes");

  return NextResponse.json((data ?? { status: "OK", dimensions: {}, incompatible: {} }) as DimensoesDoPublico);
}
