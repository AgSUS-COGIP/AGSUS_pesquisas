import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";
import {
  CorpoJsonExcedidoError,
  CorpoJsonInvalidoError,
  lerJsonLimitado,
} from "@/lib/api/corpo-json-limitado";
import type { PreviaDoPublico, RegraDePublico } from "@/lib/api/contratos-publico";

const MAX_REGRA_BYTES = 262_144;

/**
 * Prévia do público resolvido pela regra.
 *
 * É `POST` por transportar a regra no corpo, não por alterar estado: a RPC
 * chamada aqui é `stable`, e função não-volátil não consegue gravar no
 * PostgreSQL. A leitura pura é garantida pelo banco, não por convenção.
 *
 * Rota separada da aplicação de propósito. Um único endpoint decidindo entre
 * "só mostrar" e "gravar" por um campo do corpo transforma um erro de digitação
 * em mil vínculos criados sem confirmação.
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
  const { data, error } = await banco.rpc("fc_previsualizar_publico_avaliacao", {
    p_aplicacao: id,
    p_regra: regra,
  });

  if (error) return respostaDeErro(error, "POST /api/avaliacoes/[id]/publico/previa");

  return NextResponse.json(data as PreviaDoPublico);
}
