import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Rota de infraestrutura, fora das quatro regras transversais de
// src/app/api/CLAUDE.md — existe só para o Playwright autenticar sem depender do
// Google OAuth real (única jornada de login da aplicação). Nunca fica
// alcançável fora de dev/CI: além de exigir a variável de ambiente dedicada,
// `VERCEL_ENV` só existe quando o processo roda numa implantação da Vercel
// (preview ou produção) — e nesse caso a rota se desliga, independente do
// valor de `NODE_ENV`.
const E2E_LOGIN_ENABLED = process.env.E2E_TEST_LOGIN_ENABLED === "true" && !process.env.VERCEL_ENV;

const ALLOWED_DOMAIN = "agenciasus.org.br";

function jsonResponse(body: unknown, status: number) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

export async function POST(request: Request) {
  if (!E2E_LOGIN_ENABLED) {
    return jsonResponse({ mensagem: "Não encontrado." }, 404);
  }

  const body = await request.json().catch(() => null) as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !email.endsWith(`@${ALLOWED_DOMAIN}`)) {
    return jsonResponse({ mensagem: "Informe um e-mail de teste do domínio institucional." }, 400);
  }

  const admin = createAdminSupabaseClient();

  // O usuário de auth precisa já existir (criado pela fixture do Playwright) —
  // esta rota só troca um e-mail conhecido por uma sessão, nunca cria conta.
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError || !linkData) {
    console.error("Falha ao gerar link de teste:", linkError);
    return jsonResponse({ mensagem: "Falha ao gerar sessão de teste." }, 500);
  }

  const supabase = await createServerSupabaseClient();
  // `token_hash` já identifica a sessão sozinho — `email` junto é rejeitado
  // ("Only the token_hash and type should be provided").
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: linkData.properties.hashed_token,
  });
  if (verifyError) {
    console.error("Falha ao verificar sessão de teste:", verifyError);
    return jsonResponse({ mensagem: "Falha ao estabelecer sessão de teste." }, 500);
  }

  return jsonResponse({ status: "OK" }, 200);
}
