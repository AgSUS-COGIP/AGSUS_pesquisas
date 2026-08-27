import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";
import type { RegraEntrada } from "@/lib/api/contratos-construtor";

/**
 * Regras condicionais de uma versão da avaliação.
 *
 * O recurso mora sob a avaliação porque é lá que ele é editado, mas as RPCs
 * trabalham com a **versão** e com o **alvo**: uma regra pertence à versão do
 * instrumento, não ao ciclo. Por isso a versão vem por parâmetro de consulta —
 * o construtor já a tem em mãos (`ConstrutorAvaliacao.version.id`), e resolvê-la
 * aqui custaria uma chamada a mais a cada leitura.
 *
 * `[id]` é validado e não é repassado às RPCs: ele identifica o recurso no
 * caminho, enquanto a autorização real é de `can_manage_surveys()` dentro de
 * cada função, que também confere se a versão está em rascunho.
 */

/** Regras já gravadas na versão. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!ehUuid(id)) {
    return respostaDeEntradaInvalida("Identificador de avaliação inválido.");
  }

  const versao = new URL(request.url).searchParams.get("versao");
  if (!ehUuid(versao)) {
    return respostaDeEntradaInvalida("Informe a versão da avaliação.");
  }

  const supabase = await createServerRpcClient();
  const { data, error } = await supabase.rpc("fc_listar_regras_condicionais", {
    p_versao: versao,
  });

  if (error) return respostaDeErro(error, "GET /api/avaliacoes/[id]/regras");

  return NextResponse.json(data ?? []);
}

/**
 * Grava a regra do alvo, substituindo a anterior.
 *
 * As condições vão como JSON para a RPC, que valida cada uma antes de gravar:
 * pergunta de origem da mesma versão, alternativa da pergunta certa, e ausência
 * de dependência circular. Nada disso é reimplementado aqui — a rota só confere
 * a forma do pedido.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!ehUuid(id)) {
    return respostaDeEntradaInvalida("Identificador de avaliação inválido.");
  }

  let corpo: RegraEntrada;
  try {
    corpo = await request.json() as RegraEntrada;
  } catch {
    return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido.");
  }

  if (corpo.targetType !== "QUESTION" && corpo.targetType !== "SECTION") {
    return respostaDeEntradaInvalida("Informe se a regra vale para uma pergunta ou para uma seção.");
  }
  if (!ehUuid(corpo.targetId)) {
    return respostaDeEntradaInvalida("Identificador do alvo da regra inválido.");
  }
  if (!Array.isArray(corpo.conditions) || corpo.conditions.length === 0) {
    return respostaDeEntradaInvalida("Uma regra precisa de pelo menos uma condição.");
  }

  const supabase = await createServerRpcClient();
  const { data, error } = await supabase.rpc("fc_salvar_regra_condicional", {
    p_alvo_tipo: corpo.targetType,
    p_alvo: corpo.targetId,
    p_acao: corpo.action === "HIDE" ? "HIDE" : "SHOW",
    p_conector: corpo.connector === "ANY" ? "ANY" : "ALL",
    p_condicoes: corpo.conditions,
    p_descricao: typeof corpo.description === "string" ? corpo.description.trim() || null : null,
  });

  if (error) return respostaDeErro(error, "PUT /api/avaliacoes/[id]/regras");

  return NextResponse.json(data);
}

/** Remove a regra vigente do alvo; o alvo volta a aparecer sempre. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!ehUuid(id)) {
    return respostaDeEntradaInvalida("Identificador de avaliação inválido.");
  }

  const alvo = new URL(request.url).searchParams.get("alvo");
  if (!ehUuid(alvo)) {
    return respostaDeEntradaInvalida("Informe o alvo da regra.");
  }

  const supabase = await createServerRpcClient();
  const { data, error } = await supabase.rpc("fc_excluir_regra_condicional", {
    p_alvo: alvo,
  });

  if (error) return respostaDeErro(error, "DELETE /api/avaliacoes/[id]/regras");

  return NextResponse.json(data);
}
