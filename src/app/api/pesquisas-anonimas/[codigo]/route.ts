import { after, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { publicRateLimitResponse } from "@/lib/public-rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const codigo = (await params).codigo.trim();
  if (!codigo || codigo.length > 120) return respostaDeEntradaInvalida("Informe um código de avaliação válido.");

  const limitResponse = await publicRateLimitResponse(request, {
    scope: "anon-form-read",
    limit: 600,
    windowSeconds: 300,
    discriminator: codigo,
  });
  if (limitResponse) return limitResponse;

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.rpc("fc_srv_obter_form_anonimo", { target_application_code: codigo });
  if (error) return respostaDeErro(error, "GET /api/pesquisas-anonimas/[codigo]");
  if (!data) return NextResponse.json({ mensagem: "A avaliação anônima não está disponível." }, { status: 404 });

  /*
    Expira rascunhos anônimos abandonados **depois** de responder.

    Este é o caminho que cria esses rascunhos: quem abre o link sem login deixa
    um DRAFT para trás quando desiste, e ninguém volta para limpar. O projeto
    não tem job agendado, então a materialização acontece no caminho de uso —
    mesmo desenho de `fc_abrir_ciclos_agendados()`.

    Dentro de `after()` de propósito: quem está esperando o formulário não
    pode pagar, no tempo de carregamento, por uma faxina que não é dele. Falha
    aqui é registrada e ignorada — limpeza não pode derrubar a jornada.
  */
  after(async () => {
    const { error: erroLimpeza } = await supabase.rpc("fc_srv_expirar_rascunhos_anon");
    if (erroLimpeza) console.warn("[anonimas] expiração de rascunhos falhou:", erroLimpeza.message);
  });

  return NextResponse.json(data);
}
