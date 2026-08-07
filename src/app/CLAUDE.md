# Módulo `src/app` — rotas e jornadas

## Objetivo

Expor as jornadas da plataforma como rotas do App Router. Cada pasta é uma jornada; o arquivo `page.tsx` orquestra as RPCs necessárias e delega apresentação a [../components](../components/CLAUDE.md).

Submódulos com contexto próprio: [admin/](admin/CLAUDE.md) e [api/](api/CLAUDE.md).

## Responsabilidades

- Resolver identidade e permissões via `usePlatformContext()` e negar acesso quando o módulo exigido não estiver liberado.
- Chamar RPCs do Supabase, tratar erro/vazio/carregando e traduzir estados do banco em linguagem de interface.
- **Não** implementar regra de negócio: validação de escopo, período e papel acontece no banco ([../../supabase/CLAUDE.md](../../supabase/CLAUDE.md)).

## Arquivos importantes

| Arquivo | Papel |
|---|---|
| `layout.tsx` | Layout raiz. Metadados, viewport claro/escuro e dois scripts `beforeInteractive` que aplicam tema e sidebar antes da primeira pintura. Importa os cinco CSS globais. |
| `page.tsx` | Rota `/` — `redirect("/acesso")`. |
| `globals.css`, `theme-foundation.css`, `theme-enhancements.css`, `dark-theme.css`, `sidebar-monitora.css` | Tokens e temas. A ordem de import em `layout.tsx` importa: cascata posterior sobrescreve a anterior. |
| `error.tsx` / `global-error.tsx` | Boundaries de rota e de layout raiz. Ambos geram referência técnica e reportam via `reportApplicationError`. |
| `not-found.tsx`, `loading.tsx` | 404 institucional e skeleton global. |

## Rotas

| Rota | Módulo exigido | RPCs principais |
|---|---|---|
| `/acesso` | pública | `auth.signInWithOAuth` (Google, `hd=agenciasus.org.br`) |
| `/auth/confirm` | pública | `auth.exchangeCodeForSession` — Route Handler, não página |
| `/area` | `HOME` | `list_my_survey_catalog` |
| `/pesquisas` | `SURVEYS` | `list_my_survey_catalog` |
| `/pesquisas/[applicationCode]` | `SURVEYS` | `get_public_survey_form`, `start_or_resume_my_survey_submission`, `save_my_survey_answer`, `submit_my_survey_submission` |
| `/cddi` | participação no ciclo | `get_public_survey_form`, `start_or_resume_my_cddi_submission`, `get_my_cddi_identity`, `save_my_cddi_answer`, `search_cddi_leaders`, `set_my_cddi_leader`, `submit_my_cddi_submission` |
| `/cddi/chefia/[personId]` | vínculo de liderança ativo | `get_public_survey_form`, `start_or_resume_my_cddi_submission` (tipo `CHEFIA`), `get_my_team_workspace`, `save_my_cddi_answer`, `submit_my_cddi_submission` |
| `/equipe` | `TEAM` | `get_my_team_workspace`, `search_team_candidates`, `add_person_to_my_team`, `remove_person_from_my_team` |
| `/paineis` | `DASHBOARDS` | `list_managed_surveys` |
| `/paineis/[applicationCode]` | `DASHBOARDS` | `get_survey_dashboard` |
| `/paineis/cddi` | `DASHBOARDS` | `get_cddi_monitoring_dashboard` |
| `/perfil` | autenticado | `set_my_avatar_choice` (via `AvatarIdentityPicker`) |
| `/resultados` | `RESULTS` | nenhuma — placeholder com `EmptyState` |
| `/admin/**` | `ADMIN_*` | ver [admin/CLAUDE.md](admin/CLAUDE.md) |
| `/api/**` | ver módulo | ver [api/CLAUDE.md](api/CLAUDE.md) |

## Fluxo interno de uma página autenticada

```tsx
"use client";

export default function AlgumaPagina() {
  const { context, loading, error } = usePlatformContext();

  // 1. carregando
  if (loading) return <PlatformSkeleton title="Carregando …" />;
  // 2. sem identidade
  if (!context?.person) return <main className="p-10 text-red-700">{error || "Acesso não identificado."}</main>;

  // 3. guarda de módulo
  const modules = deriveModules(context);
  if (!modules.includes("MODULO")) return /* tela de acesso restrito */;

  // 4. montar o usuário da casca e renderizar
  const user = { fullName: …, profileLabel: profileLabel(context), roles: context.roles, modules };
  return <PlatformShell user={user} eyebrow="…" title="…">{/* conteúdo */}</PlatformShell>;
}
```

Carregamento de dados usa flag `active` + cleanup, para descartar resposta de componente desmontado:

```tsx
useEffect(() => {
  if (!context?.person) return;   // espera o contexto antes de consultar
  let active = true;
  void (async () => { /* … */ if (!active) return; setDados(data); })();
  return () => { active = false; };
}, [context?.person]);
```

## Regras de negócio visíveis nesta camada

**Roteamento do catálogo.** `surveyCode === "CDDI"` → `/cddi`; qualquer outro → `/pesquisas/[applicationCode]` com o código codificado por `encodeURIComponent`. A função canônica é `surveyApplicationHref()` em `@/lib/survey-catalog`, mas `/area` e `/pesquisas` reimplementam essa decisão inline (ver melhorias no [README](../../README.md)).

**Estado de um item do catálogo**, na ordem de precedência:

1. `COMPLETED` — `submissionStatus` em (`SUBMITTED`, `VALIDATED`) **ou** `completedAt` preenchido
2. `IN_PROGRESS` — `submissionStatus === "DRAFT"`
3. `CLOSED` / `SCHEDULED` — pelo `applicationStatus`
4. `PENDING` — restante

A "próxima ação" de `/area` ordena por esse estado (`IN_PROGRESS` → `PENDING` → `SCHEDULED`) e desempata pelo prazo mais próximo (`closesAt ?? opensAt`).

**Edição só em rascunho.** `canEdit = submission.canEdit && submission.status === "DRAFT"`. Fora disso a tela vira somente leitura — os `fieldset` são desabilitados e o botão de envio desaparece.

**Envio é irreversível.** Confirmação explícita antes de `submit_*`, e o runtime genérico chama `flushPendingSaves()` antes de enviar para não perder gravações com debounce pendente.

**Painéis não respondem formulários.** `/paineis` filtra o CDDI da lista de cartões (`isCddiSurvey`) e exibe um cartão dedicado ao painel de monitoramento. Nenhum link de painel inicia ou continua preenchimento.

### Específico do CDDI (`/cddi`)

- Etapas: `0` identificação e chefia → `1..N` uma competência por etapa → `N+1` revisão. Total = `sections.length + 2`.
- **A etapa 0 exige chefia selecionada** para avançar (`validateCurrentStep`) e para enviar.
- Só quem tem `identity.canChangeLeader` vê o campo de busca de chefia.
- Avançar valida as obrigatórias da etapa atual; voltar e navegar para etapa anterior não valida (`goToStep(target, false)`).
- Perguntas `SCALE` salvam imediatamente por `optionId`; texto salva com debounce de 700 ms por pergunta.
- Busca de chefia: mínimo 2 caracteres, debounce de 350 ms.
- A tela `home` do CDDI oferece autoavaliação e atalho para `/equipe`; a avaliação de chefia vive em `/cddi/chefia/[personId]`.

## Interfaces públicas

Cada `page.tsx` exporta apenas o componente padrão. `layout.tsx` exporta `metadata`, `viewport` e o layout. `cddi/layout.tsx` exporta `metadata` e envolve a rota em `CddiScrollBoundary` (que aplica classes de scroll observando mutações do DOM) e importa `cddi-route.css`.

## Dependências

- [@/lib](../lib/CLAUDE.md) — `usePlatformContext`, `deriveModules`, `profileLabel`, `createBrowserSupabaseClient`, helpers de domínio.
- [@/components](../components/CLAUDE.md) — `PlatformShell`, `PlatformSkeleton`, `PersonAvatar`, primitivos `ui/`.
- `sonner` (`toast`) para retorno de ação; `lucide-react` para ícones.

## Pontos de atenção

- Toda página que usa hooks precisa de `"use client"` na primeira linha.
- Guarde a rota **e** confie na RLS: a guarda de módulo é usabilidade, não segurança. A autorização real está no banco.
- `/cddi` fixa `"CDDI-2026"` como código de aplicação em todas as chamadas. Um novo ciclo exige revisar essas constantes.
- `/cddi` e `/admin/importacao` **não** usam `PlatformShell` — têm layout próprio de página inteira.
- Não pré-busque dados antes de `context.person` existir: sem sessão resolvida a RPC falha por `AUTH_REQUIRED`.
- Arquivos grandes (`admin/pesquisas/[surveyId]/page.tsx`, `paineis/cddi/page.tsx`) concentram muito JSX em poucas linhas; ao editar, mantenha a formatação existente para não gerar diff desnecessário.
