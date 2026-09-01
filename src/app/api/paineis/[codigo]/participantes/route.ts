import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { normalizarFiltrosDeParticipantes } from "@/lib/filtros-de-participantes";

/**
 * Lista operacional de participantes de um ciclo.
 *
 * Separada do painel de resultados de propósito. São duas leituras com
 * naturezas diferentes: o resultado é agregado e cabe inteiro numa resposta; a
 * lista é longa, paginada e muda de recorte a cada clique. Juntá-las obrigaria
 * a recalcular todo o instrumento a cada troca de página.
 *
 * A separação também sustenta a regra de anonimato. A RPC daqui lê apenas
 * participação — nunca `submissions` nem `answers` —, então acompanhar quem
 * respondeu não abre caminho para o que a pessoa respondeu, mesmo em ciclo
 * anônimo.
 *
 * Autorização e paginação ficam no banco. Esta rota transporta e valida a forma
 * do que entra: filtro desconhecido é descartado antes de chegar à RPC, e não
 * repassado na esperança de que ela recuse.
 */
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ codigo: string }> },
) {
  const { codigo } = await params;
  const codigoAplicacao = decodeURIComponent(codigo).trim();

  if (!codigoAplicacao) {
    return respostaDeEntradaInvalida("Informe o código do ciclo.");
  }

  const url = new URL(request.url);
  const filtros = normalizarFiltrosDeParticipantes(url.searchParams);
  const pagina = Number.parseInt(url.searchParams.get("pagina") ?? "1", 10);
  const tamanho = Number.parseInt(url.searchParams.get("tamanho") ?? "50", 10);

  const banco = await createServerRpcClient();
  const { data, error } = await banco.rpc("FC_LISTAR_PARTIC_PAINEL", {
    target_application_code: codigoAplicacao,
    // A RPC já sanea página e tamanho; aqui apenas se evita mandar `NaN`, que
    // viraria `null` no JSON e perderia o default declarado no banco.
    p_filtros: filtros,
    p_pagina: Number.isFinite(pagina) ? pagina : 1,
    p_tamanho: Number.isFinite(tamanho) ? tamanho : 50,
  });

  if (error) return respostaDeErro(error, "GET /api/paineis/[codigo]/participantes");

  if (!data) {
    return NextResponse.json(
      { mensagem: "Lista de participantes não disponível para este ciclo." },
      { status: 404 },
    );
  }

  return NextResponse.json(data);
}
