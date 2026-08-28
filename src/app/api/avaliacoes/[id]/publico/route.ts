import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";
import {
  CorpoJsonExcedidoError,
  CorpoJsonInvalidoError,
  lerJsonLimitado,
} from "@/lib/api/corpo-json-limitado";
import type { DimensoesDoPublico, RegraDePublico, ResultadoDaAplicacao } from "@/lib/api/contratos-publico";

/**
 * A regra é pequena por natureza: alguns rótulos por dimensão e listas de
 * identificadores. O limite existe para que uma lista de inclusão inflada não
 * vire um corpo de requisição sem teto — o desenho da Fase 1 é justamente o
 * cliente enviar a **regra**, não milhares de identificadores.
 */
const MAX_REGRA_BYTES = 262_144;

/** Opções disponíveis em cada dimensão institucional. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!ehUuid(id)) {
    return respostaDeEntradaInvalida("Identificador de avaliação inválido.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("fc_listar_dimensoes_publico");

  if (error) return respostaDeErro(error, "GET /api/avaliacoes/[id]/publico");

  return NextResponse.json((data ?? { status: "OK", dimensions: {} }) as DimensoesDoPublico);
}

/**
 * Aplica o público.
 *
 * Mutação explícita, e só ela: a prévia tem rota própria porque confundir as
 * duas é como se perde a garantia de que visualizar não altera nada.
 *
 * O servidor resolve a regra e materializa numa transação só, independentemente
 * de o resultado ter 5 ou 1.030 pessoas. Não há fatiamento em lotes.
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

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("fc_aplicar_publico_avaliacao", {
    p_aplicacao: id,
    p_regra: regra,
  });

  if (error) return respostaDeErro(error, "POST /api/avaliacoes/[id]/publico");

  return NextResponse.json(data as ResultadoDaAplicacao);
}
