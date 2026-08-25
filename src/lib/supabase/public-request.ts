// Única lista de rotas acessíveis sem sessão. Tudo o que não estiver aqui exige
// autenticação — o padrão é fechado, de modo que uma rota nova nasce protegida.
//
// `/api/observability/errors` recebe erros inclusive da tela anônima de acesso e
// se defende por mesma origem, limite de corpo e uma tabela sem leitura pública.
// `/api/tarefas/emails` recebe o cron da Vercel e valida o `CRON_SECRET` na rota.
// `/api/teste-e2e/login` cria a sessão que o Playwright ainda não possui e se
// desliga fora do ambiente local pela variável dedicada e por `VERCEL_ENV`.
const PUBLIC_PATHS = new Set([
  "/",
  "/acesso",
  "/auth/confirm",
  "/api/health",
  "/api/health/readiness",
  "/api/observability/errors",
  "/api/tarefas/emails",
  "/api/teste-e2e/login",
]);

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.has(pathname)
    || pathname.startsWith("/api/background/")
    || pathname.startsWith("/responder/")
    || pathname.startsWith("/api/pesquisas-anonimas/");
}

export function isPublicRequest(method: string, pathname: string) {
  // A marca institucional precisa ser lida antes do login. Somente o GET é
  // público: o PUT continua atravessando a autenticação do proxy e a própria
  // RPC de escrita permanece restrita a `authenticated`/administradores.
  if (method === "GET" && pathname === "/api/plataforma/marca") return true;

  return isPublicPath(pathname);
}
