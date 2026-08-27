import NextAuth from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { ERRO_SESSAO_RENOVAVEL, type ErroApi } from "@/lib/api/contratos";
import { isPublicRequest } from "@/lib/supabase/public-request";
import { configBase } from "./config-base";

/**
 * Guarda de rotas para o provedor Auth.js, equivalente ao que
 * `lib/supabase/proxy.ts` faz para o Supabase Auth.
 *
 * Monta o Auth.js **só com a configuração base**, sem o callback que acessa o
 * Postgres: isto roda no runtime Edge do `proxy.ts` (Next 16), onde `pg` não
 * existe. Verificar a assinatura do cookie e ler `sub` é operação de CPU e
 * dispensa banco — é justamente por isso que a estratégia de sessão é `jwt`.
 */
const { auth: lerSessao } = NextAuth(configBase);

function isApiPath(pathname: string) {
  return pathname.startsWith("/api/");
}

function addResponseHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  return response;
}

export async function updateSessionAuthJs(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const publicRequest = isPublicRequest(request.method, pathname);

  // As rotas do próprio Auth.js precisam passar sem guarda, ou o fluxo de login
  // nunca chegaria ao callback do Google.
  if (pathname.startsWith("/api/auth/")) {
    return addResponseHeaders(NextResponse.next({ request }));
  }

  // Tráfego público que não precisa saber se existe sessão não paga o custo de
  // verificação. `/acesso` é exceção porque manda sessão válida para `/area`.
  if (publicRequest && pathname !== "/acesso") {
    return addResponseHeaders(NextResponse.next({ request }));
  }

  const sessao = await lerSessao();
  const authenticated = Boolean(sessao?.user?.id);

  if (!authenticated && !publicRequest) {
    if (isApiPath(pathname)) {
      /*
        Mesma distinção que o caminho do Supabase faz: rota de API responde em
        JSON, nunca com redirect. Redirecionar `/api/**` para `/acesso` faz o
        `fetch` do navegador seguir o redirect sozinho, a resposta chega 200 com
        HTML, e `response.json()` falha com "Unexpected token '<'" — mensagem que
        não menciona sessão expirada em lugar nenhum.

        Aqui o código de sessão renovável é enviado porque o cookie pode ter
        expirado com o refresh ainda válido; o cliente tenta uma renovação antes
        de mandar a pessoa entrar de novo.
      */
      return addResponseHeaders(NextResponse.json(
        {
          mensagem: "Sua sessão expirou. Entre novamente para continuar.",
          codigo: ERRO_SESSAO_RENOVAVEL,
        } satisfies ErroApi,
        { status: 401 },
      ));
    }

    const destination = request.nextUrl.clone();
    destination.pathname = "/acesso";
    destination.search = "";
    destination.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return addResponseHeaders(NextResponse.redirect(destination));
  }

  if (authenticated && pathname === "/acesso") {
    const destination = request.nextUrl.clone();
    destination.pathname = "/area";
    destination.search = "";
    return addResponseHeaders(NextResponse.redirect(destination));
  }

  return addResponseHeaders(NextResponse.next({ request }));
}
