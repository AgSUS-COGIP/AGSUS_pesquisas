import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ERRO_SESSAO_RENOVAVEL, type ErroApi } from "@/lib/api/contratos";
import { isLeituraDeArquivo, isPublicRequest } from "./public-request";
import { SUPABASE_DB_SCHEMA } from "./schema";

// Rota de API responde em JSON, inclusive quando recusa.
//
// Redirecionar `/api/**` para `/acesso` produz um defeito difícil de ler: o
// `fetch` do navegador **segue** o redirect sozinho, a resposta chega como 200
// com o HTML da tela de login, e `response.json()` falha com "Unexpected token
// '<'" — mensagem que não menciona sessão expirada em lugar nenhum. Com 401 a
// tela distingue sessão perdida de falha de servidor e manda a pessoa entrar
// de novo.
function isApiPath(pathname: string) {
  return pathname.startsWith("/api/");
}

function addResponseHeaders(response: NextResponse, preservarCache = false) {
  // Imagem pública define o próprio cache na rota; o resto nunca é cacheável.
  if (!preservarCache) response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  return response;
}

/**
 * Renova a sessão Supabase quando necessário e guarda as rotas privadas.
 *
 * Executada pelo middleware (`src/proxy.ts`). Três efeitos:
 * 1. valida o JWT e atualiza cookies quando o SDK precisar renovar a sessão;
 * 2. redireciona anônimo em rota privada para `/acesso`, preservando o destino;
 * 3. aplica cabeçalhos de segurança em toda resposta.
 *
 * `getClaims()` valida a assinatura do token com JWKS cacheável quando o projeto
 * usa chave assimétrica. Diferente de `getUser()`, isso evita uma chamada ao
 * Auth server em cada request privada — especialmente importante quando uma tela
 * dispara várias APIs em paralelo.
 *
 * Rotas públicas que não precisam saber se existe sessão pulam a validação por
 * completo. `/acesso` é a exceção porque redireciona uma sessão válida para
 * `/area`.
 *
 * Sem as variáveis públicas configuradas, rota privada responde 503 em vez de
 * falhar de forma opaca.
 */
export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const pathname = request.nextUrl.pathname;
  const publicRequest = isPublicRequest(request.method, pathname);

  if (!url || !publishableKey) {
    if (publicRequest) return addResponseHeaders(NextResponse.next({ request }));

    return addResponseHeaders(new NextResponse("Serviço temporariamente indisponível.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    }));
  }

  let response = NextResponse.next({ request });

  // Não há motivo para consultar Auth em health checks, cron, observabilidade,
  // leitura da marca ou jornadas anônimas. Além de reduzir latência, isso impede
  // que tráfego público concorra com o limite de Auth das jornadas autenticadas.
  if (publicRequest && pathname !== "/acesso") {
    return addResponseHeaders(response, isLeituraDeArquivo(request.method, pathname));
  }

  const supabase = createServerClient(url, publishableKey, {
    db: { schema: SUPABASE_DB_SCHEMA },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      // Os cookies renovados precisam ser gravados na requisição (para o restante
      // desta execução) e numa resposta recriada (para chegarem ao navegador).
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const authenticated = Boolean(data?.claims?.sub) && !error;

  if (!authenticated && !publicRequest) {
    if (isApiPath(pathname)) {
      /*
        Renovável de propósito: aqui o middleware não conseguiu **ler** uma
        sessão válida do cookie, e é exatamente o caso em que o refresh token
        guardado no navegador ainda pode valer. Diferente dos 401 vindos do
        PostgREST por assinatura inválida, que renovar não conserta.
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

  return addResponseHeaders(response);
}
