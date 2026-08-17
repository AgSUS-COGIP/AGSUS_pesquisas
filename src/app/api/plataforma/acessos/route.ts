import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { respostaDeErro } from "@/lib/api/resposta-http";
import type { AreaDeAcessos } from "@/lib/api/contratos-pessoas";

/**
 * Matriz de perfis e pessoas.
 *
 * Devolve o agregado inteiro (`roles` + `people`): as colunas da tabela são os
 * perfis, e separá-los obrigaria a tela a esperar duas respostas por linha.
 */
export async function GET(request: Request) {
  const busca = new URL(request.url).searchParams.get("busca")?.trim() ?? "";

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("list_access_workspace", { search_term: busca });

  if (error) return respostaDeErro(error, "GET /api/plataforma/acessos");

  return NextResponse.json(data as AreaDeAcessos);
}
