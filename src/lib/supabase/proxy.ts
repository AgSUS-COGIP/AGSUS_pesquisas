import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Única lista de rotas acessíveis sem sessão. Tudo o que não estiver aqui exige
// autenticação — o padrão é fechado, de modo que uma rota nova nasce protegida.
const PUBLIC_PATHS = new Set(["/", "/acesso", "/auth/confirm", "/api/health"]);

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.has(pathname);
}

function addResponseHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  // CSP deliberadamente restrita às diretivas que não dependem de inventariar
  // scripts/estilos inline (o layout raiz injeta scripts `beforeInteractive` de
  // tema e sidebar, que exigiriam `unsafe-inline` e anulariam o ganho de um
  // `script-src`). `frame-ancestors` reforça o X-Frame-Options em navegadores
  // modernos; `base-uri`/`form-action` fecham vetores de injeção de destino.
  response.headers.set("Content-Security-Policy", "frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  return response;
}

/**
 * Renova a sessão Supabase a cada requisição e guarda as rotas privadas.
 *
 * Executada pelo middleware (`proxy.ts` na raiz). Três efeitos:
 * 1. atualiza os cookies de sessão, para que a sessão não expire durante o uso;
 * 2. redireciona anônimo em rota privada para `/acesso`, preservando o destino;
 * 3. aplica cabeçalhos de segurança em toda resposta.
 *
 * Sem as variáveis públicas configuradas, rota privada responde 503 em vez de
 * falhar de forma opaca.
 */
export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const publicPath = isPublicPath(request.nextUrl.pathname);

  if (!url || !publishableKey) {
    if (publicPath) return addResponseHeaders(NextResponse.next({ request }));

    return addResponseHeaders(new NextResponse("Serviço temporariamente indisponível.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    }));
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
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

  const { data, error } = await supabase.auth.getUser();
  const authenticated = Boolean(data.user) && !error;

  if (!authenticated && !publicPath) {
    const destination = request.nextUrl.clone();
    destination.pathname = "/acesso";
    destination.search = "";
    destination.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return addResponseHeaders(NextResponse.redirect(destination));
  }

  if (authenticated && request.nextUrl.pathname === "/acesso") {
    const destination = request.nextUrl.clone();
    destination.pathname = "/area";
    destination.search = "";
    return addResponseHeaders(NextResponse.redirect(destination));
  }

  return addResponseHeaders(response);
}
