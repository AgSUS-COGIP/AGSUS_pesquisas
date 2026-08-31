import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";
import {
  CorpoJsonExcedidoError,
  CorpoJsonInvalidoError,
  lerJsonLimitado,
} from "@/lib/api/corpo-json-limitado";
import type { PessoasEncontradas, RegraDePublico } from "@/lib/api/contratos-publico";

const MAX_REGRA_BYTES = 262_144;

type EntradaDaBusca = { busca?: string | null; regra?: RegraDePublico };

/**
 * Busca de pessoa para inclusão e exclusão individual, dentro do contexto.
 *
 * Passou de `GET` com `?busca=` a `POST` quando a regra entrou na conta: os
 * filtros institucionais já escolhidos restringem quem é oferecido, e regra em
 * query string vira URL longa e ilegível. Continua sendo leitura — a RPC é
 * `stable`.
 *
 * A restrição vale para a oferta, não para o efeito: inclusão individual segue
 * adicional ao filtro. O que muda é que a tela para de sugerir alguém que
 * contradiz o critério montado logo acima sem dizer por quê.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!ehUuid(id)) {
    return respostaDeEntradaInvalida("Identificador de avaliação inválido.");
  }

  let corpo: EntradaDaBusca;
  try {
    corpo = await lerJsonLimitado<EntradaDaBusca>(request, MAX_REGRA_BYTES);
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
  const { data, error } = await banco.rpc("fc_buscar_pessoas_publico", {
    p_busca: corpo.busca?.trim() || null,
    p_limite: 20,
    p_regra: corpo.regra ?? {},
  });

  if (error) return respostaDeErro(error, "POST /api/avaliacoes/[id]/publico/pessoas");

  return NextResponse.json((data ?? { status: "OK", contextual: false, people: [] }) as PessoasEncontradas);
}
