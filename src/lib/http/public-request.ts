// Única lista de rotas acessíveis sem sessão. Tudo o que não estiver aqui exige
// autenticação — o padrão é fechado, de modo que uma rota nova nasce protegida.
//
// `/api/observability/errors` recebe erros inclusive da tela anônima de acesso e
// se defende por mesma origem, limite de corpo e uma tabela sem leitura pública.
// `/api/tarefas/emails` recebe o cron da Vercel e valida o `CRON_SECRET` na rota.
const PUBLIC_PATHS = new Set([
  "/",
  "/acesso",
  "/auth/confirm",
  "/api/health",
  "/api/health/readiness",
  "/api/observability/errors",
  "/api/tarefas/emails",
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

  // As imagens substituíram buckets públicos: a arte de fundo é exibida antes
  // do login e a capa aparece em `/responder/`. Só a leitura é aberta — PUT e
  // DELETE continuam passando pela guarda, e `/api/arquivos/listagem` fica de
  // fora porque devolve o acervo inteiro, não um arquivo endereçado.
  if (isLeituraDeArquivo(method, pathname)) return true;

  return isPublicPath(pathname);
}

/**
 * Leitura de uma imagem pública, pelo endereço que substituiu o bucket.
 *
 * Existe separado de `isPublicRequest` porque o proxy precisa da distinção por
 * outro motivo: ele carimba `Cache-Control: private, no-store` em toda
 * resposta, o que é certo para tela e API e errado para estas imagens — elas
 * eram servidas de um bucket com cache e voltariam a ser buscadas por inteiro a
 * cada carregamento de página. A rota define o próprio cache; aqui só é preciso
 * não sobrescrevê-lo.
 */
export function isLeituraDeArquivo(method: string, pathname: string) {
  return method === "GET"
    && pathname.startsWith("/api/arquivos/")
    && pathname !== "/api/arquivos/listagem";
}
