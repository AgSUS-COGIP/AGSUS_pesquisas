import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import type { DefinirTextosEmailEntrada } from "@/lib/api/contratos-pessoas";

/**
 * Textos institucionais do e-mail aos participantes.
 *
 * Rota própria pela mesma razão das irmãs em `/api/plataforma/marca/*`: cada
 * conjunto de campos tem a sua função no banco, porque
 * `fc_atualizar_marca_plataforma` substitui a linha inteira e omitir um campo o
 * zeraria.
 *
 * Campo vazio significa **restaurar o padrão do código**, não apagar: nenhum
 * e-mail sai sem instrução de acesso nem sem assinatura. Quem transforma vazio
 * em nulo é esta rota; quem transforma nulo em texto padrão é
 * `participantEmailContent`, no momento do envio.
 */
export async function PUT(request: Request) {
  let corpo: DefinirTextosEmailEntrada;
  try {
    corpo = await request.json() as DefinirTextosEmailEntrada;
  } catch {
    return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido.");
  }

  const texto = (valor: unknown) =>
    typeof valor === "string" && valor.trim() ? valor.trim() : null;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("fc_definir_textos_email", {
    p_instrucao: texto(corpo.instrucao),
    p_rodape: texto(corpo.rodape),
  });

  if (error) return respostaDeErro(error, "PUT /api/plataforma/emails/textos");

  return NextResponse.json(data);
}
