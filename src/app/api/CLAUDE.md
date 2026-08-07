# Módulo `src/app/api` — Route Handlers

## Objetivo

Executar as operações que **não podem** acontecer no navegador: uso da chave de serviço do Supabase, verificação de segredo administrativo, gravação de observabilidade sem sessão do usuário e diagnóstico de configuração.

## Responsabilidades

- Autorizar cada requisição pelo seu próprio mecanismo (token administrativo, mesma origem, ou rota pública deliberada).
- Nunca vazar detalhe interno na resposta — mensagens são curtas e em português; o diagnóstico completo vai para `console.error`.
- Sanitizar tudo que vem do cliente antes de persistir.

## Rotas

| Rota | Método | Runtime | Autorização | Finalidade |
|---|---|---|---|---|
| `/api/health` | `GET` | Node (`force-dynamic`) | pública | Verifica se as variáveis públicas e administrativas do Supabase existem. `200 ok` ou `503 degraded` com `missingConfiguration`. |
| `/api/observability/errors` | `POST` | Node | mesma origem + limite de 16 KB | Grava relatório de erro em `tl_erro_aplicacao`. Responde `202` com a referência. |
| `/api/admin/import-participants` | `POST` | Node | header `x-admin-import-token` | Sincroniza a base institucional de pessoas em lotes. |
| `/api/background/[id]` | `GET` | **Edge** | pública | Proxy com cache das imagens de fundo da tela de acesso. |
| `/auth/confirm` | `GET` | Node | pública | Callback OAuth. Fica em `src/app/auth/confirm/`, fora desta pasta, mas é um Route Handler. |

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

### `/api/admin/import-participants` — sincronização da base

```text
1. isAuthorized(): compara x-admin-import-token com ADMIN_IMPORT_TOKEN
   usando timingSafeEqual, após checar igualdade de tamanho
2. valida lote: 1..250 linhas (MAX_ROWS_PER_REQUEST), fileName presente,
   totalRows inteiro e ≥ rows.length
3. isFirstChunk → insere data_import_batches (status RUNNING)
4. sync_people_base_rows(p_rows, p_batch_id)       base mestra
5. sync_cddi_manager_rows(p_rows, p_batch_id)      vínculos de gestor
   falha em 4 ou 5 → marca o lote FAILED com failure_message/failure_stage
6. deriva data_import_issues a partir dos warnings de cada linha
7. isLastChunk → fecha COMPLETED ou COMPLETED_WITH_WARNINGS
```

Códigos de pendência gerados: `MISSING_EMAIL`, `INVALID_EMAIL`, `DUPLICATE_EMAIL`, `INVALID_MANAGER_EMAIL`, `INVALID_ADMISSION_DATE` — todos com `severity: "WARNING"`, porque a pessoa é preservada mesmo sem identidade de acesso.

`surveyAssignmentsCreated: 0` e `survey_assignment: false` no retorno e nos metadados registram, explicitamente, que a importação não vincula ninguém a pesquisa.

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

- [@/lib/supabase/admin](../../lib/CLAUDE.md) — `createAdminSupabaseClient()`, `getAdminSupabaseConfigurationStatus()`. **Importado apenas aqui.**
- [@/lib/supabase/server](../../lib/CLAUDE.md) — cliente por cookie, usado pelo callback OAuth.
- [@/lib/auth-callback](../../lib/CLAUDE.md) — `safeAuthNext()`, `pkceExchangeOptions()`.
- `node:crypto` (`timingSafeEqual`) e `node:buffer` na rota de importação.

## Convenções específicas

- Todas as respostas de mutação levam `Cache-Control: no-store` e `X-Content-Type-Options: nosniff` (`securityHeaders()` na rota de importação).
- Códigos de status são semânticos: `401` sem token, `400` payload inválido, `403` origem não autorizada, `413` excede limite, `500` falha ao gravar, `502` origem externa indisponível, `503` configuração ausente.
- Nunca devolver `error.message` bruto do banco ao cliente quando puder revelar estrutura interna — a rota de importação abre exceção porque a mensagem é operacionalmente necessária ao administrador.
- Handler não confia em nada do cliente: valida tamanho, faixa, tipo e formato antes de usar.

## Pontos de atenção

- **A chave de serviço ignora RLS.** Todo `createAdminSupabaseClient()` roda com privilégio total. Nunca importe esse módulo em componente de cliente e nunca aceite `table`/`column` vindos da requisição.
- `createAdminSupabaseClient()` lança `AdminSupabaseConfigurationError` se faltar URL ou chave; aceita `SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SECRET_KEY`/`SUPABASE_SERVICE_ROLE_KEY` (nome moderno tem precedência).
- `/auth/confirm` fixa `ALLOWED_DOMAIN = "agenciasus.org.br"` no código, enquanto a camada SQL aceita a lista de `ALLOWED_INSTITUTIONAL_DOMAINS`. Uma conta `@agsus.org.br` passaria no banco e seria rejeitada aqui.
- `isSameOrigin()` aceita requisição sem header `Origin` — exigido por `fetch(keepalive)` durante o descarregamento da página.
- O corpo da rota de importação é convertido com `as RequestBody`, sem validação de esquema por linha. `zod` já está instalado, se a equipe decidir endurecer.
- `/api/background/*` é rota pública que consome um serviço externo (Unsplash) e existe apenas para o plano de fundo da tela de login.
