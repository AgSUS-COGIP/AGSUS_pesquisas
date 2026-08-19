import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Única lista de rotas acessíveis sem sessão. Tudo o que não estiver aqui exige
// autenticação — o padrão é fechado, de modo que uma rota nova nasce protegida.
//
// `/api/observability/errors` está aqui por necessidade, não por descuido:
// `ClientErrorReporter` é montado em toda página, inclusive `/acesso`, que é
// anônima. Sem esta entrada, o relatório do erro que impede alguém de entrar
// seria redirecionado para a própria tela de login e nunca chegaria. A rota se
// defende por outros meios — checagem de mesma origem e limite de 16 KB na
// própria rota — e grava numa tabela sem leitura para `authenticated`.
//
// `/api/tarefas/emails` também é necessidade: quem a chama é o cron da
// Vercel, que não tem sessão institucional. A rota se defende sozinha pelo
// `CRON_SECRET` (sem o segredo correto, 401; sem o segredo configurado, 503)
// e toda a decisão de negócio fica em RPC restrita ao service role.
const PUBLIC_PATHS = new Set([
  "/",
  "/acesso",
  "/auth/confirm",
  "/api/health",
  "/api/observability/errors",
  "/api/tarefas/emails",
]);

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.has(pathname) || pathname.startsWith("/api/background/");
}

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

function addResponseHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  return response;
}

/**
 * Renova a sessão Supabase a cada requisição e guarda as rotas privadas.
 *
 * Executada pelo middleware (`src/proxy.ts`). Três efeitos:
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
    if (isApiPath(request.nextUrl.pathname)) {
      return addResponseHeaders(NextResponse.json(
        { mensagem: "Sua sessão expirou. Entre novamente para continuar." },
        { status: 401 },
      ));
    }

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
