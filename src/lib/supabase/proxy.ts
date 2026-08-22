import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Unica lista de rotas acessiveis sem sessao. Tudo o que nao estiver aqui exige
// autenticacao — o padrao e fechado, de modo que uma rota nova nasce protegida.
//
// `/api/observability/errors` esta aqui por necessidade, nao por descuido:
// `ClientErrorReporter` e montado em toda pagina, inclusive `/acesso`, que e
// anonima. Sem esta entrada, o relatorio do erro que impede alguem de entrar
// seria redirecionado para a propria tela de login e nunca chegaria. A rota se
// defende por outros meios — checagem de mesma origem e limite de 16 KB na
// propria rota — e grava numa tabela sem leitura para `authenticated`.
//
// `/api/tarefas/emails` tambem e necessidade: quem a chama e o cron da
// Vercel, que nao tem sessao institucional. A rota se defende sozinha pelo
// `CRON_SECRET` (sem o segredo correto, 401; sem o segredo configurado, 503)
// e toda a decisao de negocio fica em RPC restrita ao service role.
const PUBLIC_PATHS = new Set([
  "/",
  "/acesso",
  "/auth/confirm",
  "/api/health",
  "/api/observability/errors",
  "/api/tarefas/emails",
]);

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.has(pathname)
    || pathname.startsWith("/api/background/")
    || pathname.startsWith("/responder/")
    || pathname.startsWith("/api/pesquisas-anonimas/");
}

// Rota de API responde em JSON, inclusive quando recusa.
//
// Redirecionar `/api/**` para `/acesso` produz um defeito dificil de ler: o
// `fetch` do navegador **segue** o redirect sozinho, a resposta chega como 200
// com o HTML da tela de login, e `response.json()` falha com "Unexpected token
// '<'" — mensagem que nao menciona sessao expirada em lugar nenhum. Com 401 a
// tela distingue sessao perdida de falha de servidor e manda a pessoa entrar
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
 * Renova a sessao Supabase quando necessario e guarda as rotas privadas.
 *
 * Executada pelo middleware (`src/proxy.ts`). Tres efeitos:
 * 1. valida o JWT e atualiza cookies quando o SDK precisar renovar a sessao;
 * 2. redireciona anonimo em rota privada para `/acesso`, preservando o destino;
 * 3. aplica cabecalhos de seguranca em toda resposta.
 *
 * `getClaims()` valida a assinatura do token com JWKS cacheavel quando o projeto
 * usa chave assimetrica. Diferente de `getUser()`, isso evita uma chamada ao
 * Auth server em cada request privada — especialmente importante quando uma tela
 * dispara varias APIs em paralelo.
 *
 * Rotas publicas que nao precisam saber se existe sessao pulam a validacao por
 * completo. `/acesso` e a excecao porque redireciona uma sessao valida para
 * `/area`.
 *
 * Sem as variaveis publicas configuradas, rota privada responde 503 em vez de
 * falhar de forma opaca.
 */
export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const pathname = request.nextUrl.pathname;
  const publicPath = isPublicPath(pathname);

  if (!url || !publishableKey) {
    if (publicPath) return addResponseHeaders(NextResponse.next({ request }));

    return addResponseHeaders(new NextResponse("Servico temporariamente indisponivel.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    }));
  }

  let response = NextResponse.next({ request });

  // Nao ha motivo para consultar Auth em health checks, cron, observabilidade ou
  // jornadas anonimas. Alem de reduzir latencia, isso impede que trafego publico
  // concorra com o limite de Auth das jornadas autenticadas.
  if (publicPath && pathname !== "/acesso") {
    return addResponseHeaders(response);
  }

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      // Os cookies renovados precisam ser gravados na requisicao (para o restante
      // desta execucao) e numa resposta recriada (para chegarem ao navegador).
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

  if (!authenticated && !publicPath) {
    if (isApiPath(pathname)) {
      return addResponseHeaders(NextResponse.json(
        { mensagem: "Sua sessao expirou. Entre novamente para continuar." },
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
