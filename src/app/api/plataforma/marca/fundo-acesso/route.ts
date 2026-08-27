import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import type { DefinirFundoAcessoEntrada } from "@/lib/api/contratos-pessoas";

/**
 * Arte de fundo da tela de acesso.
 *
 * Recurso próprio, separado de `/api/plataforma/marca`, porque a separação
 * corrige um defeito real: a função combinada gravava fundo, cor e nomes de uma
 * vez, e quem chamasse para mudar um deles apagava os outros a partir de um
 * estado desatualizado. Em produção, uma troca de cor apagou a arte enviada
 * quinze minutos antes. Reunir os três campos aqui traria o defeito de volta.
 *
 * `url` e `caminho` nulos restauram a arte institucional padrão. O upload fica
 * fora daqui: a tela envia o arquivo direto ao bucket antes de chamar a rota.
 */
export async function PUT(request: Request) {
  let corpo: DefinirFundoAcessoEntrada;
  try {
    corpo = await request.json() as DefinirFundoAcessoEntrada;
  } catch {
    return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido.");
  }

  const url = typeof corpo.url === "string" && corpo.url.trim() ? corpo.url.trim() : null;
  const caminho = typeof corpo.caminho === "string" && corpo.caminho.trim() ? corpo.caminho.trim() : null;

  const supabase = await createServerRpcClient();
  const { data, error } = await supabase.rpc("fc_definir_fundo_acesso", {
    p_url: url,
    p_caminho: caminho,
  });

  if (error) return respostaDeErro(error, "PUT /api/plataforma/marca/fundo-acesso");

  return NextResponse.json(data);
}
