import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import type { DefinirTextosMarcaEntrada } from "@/lib/api/contratos-pessoas";

/**
 * Textos institucionais da tela de acesso.
 *
 * Rota própria, como a cor do painel e a arte de fundo — e pelo mesmo motivo:
 * `fc_atualizar_marca_plataforma` substitui a linha inteira, então omitir um
 * campo o zeraria. Cada conjunto de campos tem a sua função no banco.
 *
 * Campo vazio significa **restaurar o padrão do código**, não apagar: a tela de
 * entrada não pode ficar sem título nem sem instrução. Quem transforma vazio em
 * nulo é esta rota; quem transforma nulo em texto padrão é
 * `normalizePlatformBranding`.
 */
export async function PUT(request: Request) {
  let corpo: DefinirTextosMarcaEntrada;
  try {
    corpo = await request.json() as DefinirTextosMarcaEntrada;
  } catch {
    return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido.");
  }

  const texto = (valor: unknown) =>
    typeof valor === "string" && valor.trim() ? valor.trim() : null;

  const banco = await createServerRpcClient();
  const { data, error } = await banco.rpc("fc_definir_textos_marca", {
    p_expansao: texto(corpo.expansao),
    p_saudacao: texto(corpo.saudacao),
    p_instrucao: texto(corpo.instrucao),
  });

  if (error) return respostaDeErro(error, "PUT /api/plataforma/marca/textos");

  return NextResponse.json(data);
}
