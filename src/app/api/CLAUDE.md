# Módulo `src/app/api` — Route Handlers

## Objetivo

Expor o acesso ao banco como rotas REST e executar o que **não pode** acontecer no navegador: chave de serviço do Supabase, observabilidade sem sessão, diagnóstico de configuração e o callback OAuth.

## Responsabilidades

- Autorizar cada requisição pelo mecanismo que a classe dela pede — ver **Duas classes de rota**, abaixo.
- Nunca vazar detalhe interno na resposta — mensagens são curtas e em português; o diagnóstico completo vai para `console.error`.
- Sanitizar tudo que vem do cliente antes de persistir.

## Regras que valem para toda rota de domínio

Estas quatro decisões são **transversais**: valem para as ~50 rotas de domínio e por isso estão aqui, uma vez, em vez de repetidas no cabeçalho de cada arquivo. Um comentário local só se justifica quando a rota **foge** delas.

1. **Sessão do usuário, nunca service role.** Toda rota autenticada de domínio usa `createServerSupabaseClient()` — chave publicável com o cookie de quem chamou. RLS e as checagens dentro das RPCs continuam valendo, então defeito na rota não vira vazamento. `createAdminSupabaseClient()` fica restrito às rotas de infraestrutura que operam sem sessão por necessidade e à jornada pública anônima, descrita abaixo.
2. **A regra de negócio não sobe para a rota.** O handler valida **forma** (campo presente, UUID bem formado) e chama a RPC. Período, escopo, papel, anonimato e integridade são revalidados pelo banco, que é a autoridade. Repetir a regra aqui criaria duas fontes que divergiriam na primeira correção.
3. **Erro do Postgres vira status HTTP** por `respostaDeErro()` (`@/lib/api/resposta-http`), único tradutor. Em 4xx a mensagem do banco é repassada — as RPCs escrevem em português voltado ao operador; em 5xx não, porque pode carregar nome de coluna ou dado de outra pessoa.
4. **Leitura que materializa estado não é cacheável.** `get_survey_operations`, `list_my_survey_catalog` e `get_public_survey_form` chamam `fc_abrir_ciclos_agendados()` antes de responder — a abertura de ciclo agendado é preguiçosa, já que o projeto não tem job agendado. As rotas que as expõem declaram `export const dynamic = "force-dynamic"`.

## Rotas de infraestrutura

Não seguem as regras acima — cada uma tem autorização própria, pelo motivo indicado.

| Rota | Método | Runtime | Autorização | Finalidade |
|---|---|---|---|---|
| `/api/health` | `GET` | Node (`force-dynamic`) | pública | Verifica Supabase, SMTP, URL pública e cron sem expor valores. `200 ok` ou `503 degraded` com `missingConfiguration`. |
| `/api/observability/errors` | `POST` | Node | mesma origem + limite de 16 KB | Grava relatório de erro em `tl_erro_aplicacao`. Responde `202` com a referência. Usa service role. |
| `/api/tarefas/emails` | `GET` | Node (`force-dynamic`) | `Authorization: Bearer CRON_SECRET` | Envia abertura e lembrete de 24 h em lotes reivindicados por token, com pool SMTP e concorrência limitada. Também roda por `after()` ao abrir o ciclo ou ligar a opção. |
| `/api/background/[id]` | `GET` | **Edge** | pública | Proxy com cache das imagens de fundo da tela de acesso. |
| `/api/pesquisas-anonimas/**` | `GET/POST/PUT` | Node | token efêmero por submissão nas mutações | Jornada pública de ciclos anônimos. Usa service role apenas para chamar entradas `fc_srv_*`, inacessíveis ao navegador; as RPCs de domínio chamadas por elas também não concedem `EXECUTE` a `authenticated`. |
| `/auth/confirm` | `GET` | Node | pública | Callback OAuth. Fica em `src/app/auth/confirm/`, fora desta pasta, mas é um Route Handler. |

## Rotas de domínio

Todas exigem sessão e seguem as quatro regras transversais. Agrupadas por recurso; o cliente tipado de cada grupo está em `@/lib/api/`.

| Recurso | Rotas | Cliente |
|---|---|---|
| Avaliações | `/api/avaliacoes`, `/api/avaliacoes/[id]`, `…/copia` | `cliente.ts` |
| Construtor | `…/[id]/construtor`, `…/secoes`, `…/perguntas`, `…/itens/copia`, `…/itens/ordem`, `…/regras`, `…/identidade-visual`, `…/ciclo`, `…/notificacoes` | `cliente-construtor.ts` |
| Público e pessoas | `…/[id]/participantes`, `…/pessoas-disponiveis`, `/api/pessoas/**`, `/api/plataforma/**` | `cliente-pessoas.ts` |
| Central de e-mails | `/api/plataforma/emails`, `…/audiencia`, `…/enviar`, `…/despachar`, `…/textos` | `cliente-pessoas.ts` |
| Presença online | `/api/plataforma/presenca` (configuração), `…/batida` (registrar a própria), `…/online` (quem está) | `cliente-pessoas.ts` |
| Equipe | `/api/equipe`, `…/ciclos`, `…/candidatos`, `…/membros` | `cliente-pessoas.ts` |
| Jornada de resposta | `/api/formularios/[codigo]`, `/api/submissoes/**`, `/api/ciclos/[codigo]/regras`, `/api/meu/**` | `cliente-runtime.ts` |
| CDDI | `/api/cddi/ciclo-vigente`, `…/identidade`, `…/submissoes/**` | `cliente-runtime.ts` |
| Painéis | `/api/paineis/[codigo]`, `/api/paineis/cddi`, `/api/respostas/**`, `/api/modelos-avaliacao` | `cliente-paineis.ts` |

**`/api/plataforma/emails/despachar` é a exceção que confirma a regra 1.** Ela não chama RPC de domínio — aciona o despachador, que usa **service role** e ignora RLS. Por isso é a única rota de domínio com guarda explícita no handler: lê `canManageSurveys` de `fc_obter_contexto_plataforma()`, avaliado pelo banco sob a sessão de quem chamou. Sem essa checagem, qualquer sessão autenticada dispararia e-mail institucional para mil pessoas. Ela processa **um lote** por chamada; quem drena a fila é a tela, chamando em laço — o SMTP é sequencial e mil mensagens não cabem numa invocação serverless.

**`/api/meu/…` é sempre relativo a quem chamou** e nunca recebe identificador de pessoa no caminho. Uma rota como `/api/pessoas/[id]/catalogo` precisaria verificar que `[id]` é o próprio chamador — verificação que se esquece. Aqui a identidade vem da sessão e não há parâmetro para forjar.

## Autorização: onde ela realmente mora

**A autorização não está na rota — está no banco.** As rotas de domínio autenticam como o usuário (regra 1 acima), então quem decide é `can_manage_surveys()`, `is_platform_administrator()` e a RLS de cada tabela. A rota é casca HTTP: não há guard de módulo aqui porque a checagem equivalente já roda dentro da RPC, e ela vale mesmo se o handler tiver defeito.

Isso é deliberado. Autorizar por service role e um `if` em TypeScript tornaria cada rota um ponto onde uma checagem esquecida expõe dados sem segunda barreira — foi o que aconteceu em produção quando `list_managed_surveys` perdeu a verificação e passou a enumerar todas as avaliações para qualquer pessoa autenticada (corrigido em `20260814090000_arquivar_pesquisa.sql`).

Cada rota se defende pelo mecanismo que a sua natureza permite: `/api/observability/errors` verifica mesma origem e limita o corpo a 16 KB, porque **não pode** exigir sessão — `ClientErrorReporter` é montado em toda página, inclusive `/acesso`, que é anônima, e exigir autenticação ali cegaria a instrumentação no erro que impede alguém de entrar. Por isso ela consta de `PUBLIC_PATHS`.

**O middleware é a camada anterior, e falha em silêncio.** `src/proxy.ts` precisa ficar ao lado de `app/` — como o app é `src/app`, o local é `src/`. Fora daí o Next 16 não o carrega e nenhuma guarda existe, sem erro algum: as páginas respondem `200` e os cabeçalhos de segurança somem. Esteve assim até 14/08/2026. O procedimento de verificação está no [README](../../../README.md).

## Fluxo interno

### `/auth/confirm` — callback OAuth

```text
1. next = safeAuthNext(query.next)          bloqueia destino externo → /area
2. sem `code`                               → /acesso?erro=oauth-invalido
3. exchangeCodeForSession(code, pkceExchangeOptions(sb_flow_id))
   falhou                                   → /acesso?erro=oauth-invalido
4. getUser() → domínio do e-mail
   ≠ agenciasus.org.br                      → signOut() + /acesso?erro=dominio-nao-autorizado
5. redirect(next)
```

`pkceExchangeOptions(flowId)` devolve `undefined` quando `sb_flow_id` está ausente, preservando compatibilidade com callbacks emitidos antes do parâmetro existir. Um `flowId` explícito e inválido **não** cai em fallback — é repassado, para que a troca falhe em vez de usar o verificador errado.

### `/api/observability/errors` — coleta de erros

```text
1. isSameOrigin(): sem header Origin → aceita (necessário para fetch keepalive);
   com Origin de host diferente → 403
2. content-length > 16.384 → 413
3. sanitiza: reference(80) route(200) message(1000) type(40)
   context: no máximo 12 chaves; valores não escalares → "[valor removido]"
4. type precisa estar em CLIENTE|SERVIDOR|REDE|BANCO|DESCONHECIDO, senão 400
5. ambiente derivado de VERCEL_ENV: production→PRODUCAO, preview→HOMOLOGACAO,
   demais→DESENVOLVIMENTO
6. upsert em tl_erro_aplicacao com onConflict co_referencia, ignoreDuplicates
```

A sanitização remove e-mails, sequências de 5+ dígitos (matrícula, CPF) e tokens `Bearer`. A mesma lógica existe no cliente em `@/lib/observability` — **defesa em profundidade deliberada**: o cliente pode ser contornado, o servidor não.

### `/api/background/[id]` — proxy de imagens

Índice numérico validado contra a lista fixa de 6 URLs (fora da faixa → `404`). Resposta com cache agressivo (`max-age=86400`, `s-maxage=604800`, `stale-while-revalidate=2592000`) e cabeçalhos específicos de CDN da Vercel. Falha na origem → `502`. Roda no runtime **Edge**.

## Interfaces públicas

Handlers nomeados por método HTTP (`GET`, `POST`) exportados de `route.ts`. `/api/health` também exporta `export const dynamic = "force-dynamic"`; `/api/background/[id]` exporta `export const runtime = "edge"`.

Em Next.js 16 os parâmetros de rota dinâmica são assíncronos:

```ts
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
}
```

## Dependências

- [@/lib/supabase/server](../../lib/CLAUDE.md) — `createServerSupabaseClient()`, cliente por cookie. **É o cliente de toda rota de domínio.**
- [@/lib/api/resposta-http](../../lib/CLAUDE.md) — `respostaDeErro()`, `respostaDeEntradaInvalida()`, `statusDoErroPostgres()`.
- [@/lib/api/validacao](../../lib/CLAUDE.md) — `ehUuid()`.
- [@/lib/supabase/admin](../../lib/CLAUDE.md) — `createAdminSupabaseClient()`, `getAdminSupabaseConfigurationStatus()`. **Importado apenas aqui, por `/api/observability/errors`, `/api/health`, `/api/tarefas/emails` e `/api/pesquisas-anonimas/**`.**
- [@/lib/auth-callback](../../lib/CLAUDE.md) — `safeAuthNext()`, `pkceExchangeOptions()`.

## Convenções específicas

- Toda resposta de mutação leva `Cache-Control: no-store` e `X-Content-Type-Options: nosniff`.
- Códigos de status são semânticos: `400` payload malformado, `401` sessão expirada, `403` sem permissão, `404` recurso inexistente, `409` estado que não permite a operação, `413` excede limite, `422` dado inválido, `500` falha interna, `501` migration não aplicada neste ambiente, `502` origem externa indisponível, `503` configuração ausente. A tradução do erro do Postgres é de `statusDoErroPostgres()`, testada em `resposta-http.test.ts`.
- Nunca devolver `error.message` bruto do banco ao cliente quando puder revelar estrutura interna: mensagem curta na resposta, diagnóstico completo em `console.error`.
- Handler não confia em nada do cliente: valida tamanho, faixa, tipo e formato antes de usar.
- **Comentário no `route.ts` só para o que é específico daquela rota.** As quatro regras transversais estão neste arquivo; repeti-las no cabeçalho de cada handler cria cópias que divergem na primeira correção.

## Pontos de atenção

- **A chave de serviço ignora RLS.** Todo `createAdminSupabaseClient()` roda com privilégio total. Nunca importe esse módulo em componente de cliente e nunca aceite `table`/`column` vindos da requisição. **Rota autenticada de domínio não usa esse cliente.** A exceção pública `/api/pesquisas-anonimas/**` só chama as quatro entradas `fc_srv_*`, que delegam a RPCs de domínio e são restritas ao `service_role`.
- **Rota de API responde JSON, inclusive ao recusar.** O middleware devolve `401` em `/api/**` no lugar do redirecionamento para `/acesso`. Sem isso o `fetch` segue o redirect sozinho, a resposta chega `200` com o HTML do login e `response.json()` falha com `Unexpected token '<'` — mensagem que não menciona sessão expirada. A distinção está em `isApiPath()` (`@/lib/supabase/proxy`).
- `createAdminSupabaseClient()` lança `AdminSupabaseConfigurationError` se faltar URL ou chave; aceita `SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SECRET_KEY`/`SUPABASE_SERVICE_ROLE_KEY` (nome moderno tem precedência).
- `/auth/confirm` fixa `ALLOWED_DOMAIN = "agenciasus.org.br"` no código, enquanto a camada SQL aceita a lista de `ALLOWED_INSTITUTIONAL_DOMAINS`. Uma conta `@agsus.org.br` passaria no banco e seria rejeitada aqui.
- **`isSameOrigin()` aceita requisição sem header `Origin`** — exigido por `fetch(keepalive)` durante o descarregamento da página. A consequência é que a checagem filtra o navegador de terceiros, não o cliente que simplesmente omite o header: ela nunca pode ser a única defesa de rota que grava. Em `/api/observability/errors` a cota e o escopo mínimo no banco (`tl_erro_aplicacao` sem leitura para `authenticated`) é que completam a proteção.
- `/api/background/*` é rota pública que consome um serviço externo (Unsplash) e existe apenas para o plano de fundo da tela de login.
