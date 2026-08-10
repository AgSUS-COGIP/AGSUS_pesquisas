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
| `/area` | `HOME` — sem o módulo, redireciona para `/pesquisas` | `list_my_survey_catalog` |
| `/pesquisas` (tela "Pesquisas") | `SURVEYS` | `list_my_survey_catalog` |
| `/pesquisas/[applicationCode]` | `SURVEYS` | `get_public_survey_form`, `start_or_resume_my_survey_submission`, `save_my_survey_answer`, `submit_my_survey_submission` |
| `/cddi` | participação no ciclo | `get_public_survey_form`, `start_or_resume_my_cddi_submission`, `get_my_cddi_identity`, `save_my_cddi_answer`, `submit_my_cddi_submission` |
| `/cddi/chefia/[personId]` (aceita `?ciclo=`) | vínculo de liderança ativo | `get_public_survey_form`, `start_or_resume_my_cddi_submission` (tipo `CHEFIA`), `fc_obter_minha_equipe`, `save_my_cddi_answer`, `submit_my_cddi_submission` |
| `/equipe` | `TEAM` | `fc_listar_ciclos_lideranca`, `fc_obter_minha_equipe`, `fc_pesquisar_equipe`, `add_person_to_my_team`, `remove_person_from_my_team` |
| `/paineis` | `DASHBOARDS` | `list_managed_surveys` |
| `/paineis/[applicationCode]` | `DASHBOARDS` | `get_survey_dashboard` |
| `/paineis/cddi` | `DASHBOARDS` | `get_cddi_monitoring_dashboard` |
| `/perfil` | autenticado | foto do Google sincronizada por `usePlatformContext()`; dados institucionais somente leitura |
| `/resultados` | `RESULTS` (Admin e Superadmin) | nenhuma — placeholder com `EmptyState` |
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
  if (!modules.includes("MODULO")) return <FullPageState tone="restricted" title="…" description="…" />;

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

**Roteamento do catálogo.** `surveyCode === "CDDI"` → `/cddi`; qualquer outro → `/pesquisas/[applicationCode]` com o código codificado por `encodeURIComponent`. A função canônica é `surveyApplicationHref()` em `@/lib/survey-catalog`, hoje importada por `/area` e `/pesquisas` — as duas telas também compartilham a consulta do catálogo pelo hook `useSurveyCatalog` (`src/hooks/use-survey-catalog.ts`).

**Estado de um item do catálogo**, na ordem de precedência:

1. `COMPLETED` — `submissionStatus` em (`SUBMITTED`, `VALIDATED`) **ou** `completedAt` preenchido
2. `IN_PROGRESS` — `submissionStatus === "DRAFT"`
3. `CLOSED` / `SCHEDULED` — pelo `applicationStatus`
4. `PENDING` — restante

A "próxima ação" de `/area` ordena por esse estado (`IN_PROGRESS` → `PENDING` → `SCHEDULED`) e desempata pelo prazo mais próximo (`closesAt ?? opensAt`).

**Edição só em rascunho.** `canEdit = submission.canEdit && submission.status === "DRAFT"`. Fora disso a tela vira somente leitura — os `fieldset` são desabilitados e o botão de envio desaparece.

**Envio é irreversível.** Confirmação explícita antes de `submit_*` por `await confirm({ … })` (`useConfirm()`, diálogo acessível da aplicação — não `window.confirm`), e as telas descarregam as gravações pendentes antes de enviar para não perder debounce em voo.

**Painéis não respondem formulários.** `/paineis` filtra o CDDI da lista de cartões (`isCddiSurvey`) e exibe um cartão dedicado ao painel de monitoramento. Nenhum link de painel inicia ou continua preenchimento.

### Específico de `/equipe`

- **Seleção da avaliação.** `fc_listar_ciclos_lideranca()` lista os ciclos em que a pessoa lidera equipe, do mais recente para o mais antigo. Com **um** ciclo (ou nenhum), não há seletor — o mais recente é carregado automaticamente (código `null` mantém a resolução do banco). Com **dois ou mais**, um `<select>` aparece no cabeçalho já com o mais recente selecionado; trocar o ciclo troca a `queryKey` do workspace e recarrega a tela inteira. Os links "Avaliar pessoa" levam o ciclo escolhido em `?ciclo=`.
- **Busca de integrantes.** Filtro client-side sobre a lista carregada, equivalente a `LIKE '%termo%'`: `normalizeSearchText()` remove acentos e força minúsculas nos dois lados (nome, matrícula, cargo, unidade, local e e-mail). Enter aplica a busca sem recarregar (form com `preventDefault`); não há botão Buscar.

### Específico do CDDI (`/cddi`)

- Etapas: `0` identificação e chefia → `1..N` uma competência por etapa → `N+1` revisão. Total = `sections.length + 2`.
- **A chefia não é selecionada pelo participante.** Vem do vínculo institucional (`cddi_leadership_links`, exibida por `get_my_cddi_identity`) e aparece somente leitura na etapa 0. Sem vínculo, a etapa 0 orienta a procurar a administração e bloqueia o avanço (`validateCurrentStep`) e o envio — a correção é administrativa (`/admin/equipes`) ou por reimportação da base.
- **Na etapa 0 o rodapé exibe um único botão "Iniciar avaliação"** (avança para a primeira competência). A partir da etapa 1 valem os botões Tela inicial / Anterior / Próxima.
- Avançar valida as obrigatórias da etapa atual; voltar e navegar para etapa anterior não valida (`goToStep(target, false)`).
- **A definição é filtrada por tipo de submissão** antes de renderizar: `visibleCddiSections(sections, "AUTO" | "CHEFIA")` remove perguntas `PERSON` (a chefia é vínculo institucional, não campo do formulário) e as que declaram `validation.allowed_submission_types` sem o tipo atual. Seção que fica sem pergunta desaparece — logo `sections.length` **não** é o número de competências do instrumento, e sim o das aplicáveis àquela jornada.
- Perguntas `SCALE` salvam imediatamente por `optionId`; texto salva com debounce de 700 ms por pergunta. As gravações passam por `ReliableSaveQueue`, e `flushPendingSaves()` descarrega os debounces pendentes antes de validar ou enviar.
- A tela `home` do CDDI oferece autoavaliação e atalho para `/equipe`; a avaliação de chefia vive em `/cddi/chefia/[personId]`, que lê o ciclo do parâmetro `?ciclo=` (padrão `CDDI-2026`).

## Interfaces públicas

Cada `page.tsx` exporta apenas o componente padrão. `layout.tsx` exporta `metadata`, `viewport` e o layout. `cddi/layout.tsx` exporta `metadata`, importa `cddi-route.css` e envolve a rota em `CddiScrollBoundary` — hoje um invólucro estático que só aplica a classe `cddi-route-shell`; o comportamento de scroll ficou por conta do CSS da rota.

## Dependências

- [@/lib](../lib/CLAUDE.md) — `usePlatformContext`, `deriveModules`, `profileLabel`, `createBrowserSupabaseClient`, helpers de domínio.
- [@/components](../components/CLAUDE.md) — `PlatformShell`, `PlatformSkeleton`, `PersonAvatar`, `FullPageState` (telas de acesso restrito e erro de página inteira), `useConfirm`, primitivos `ui/`.
- [@/hooks/use-survey-catalog](../hooks/use-survey-catalog.ts) — consulta cacheada de `list_my_survey_catalog`, compartilhada por `/area` e `/pesquisas`.
- `sonner` (`toast`) para retorno de ação; `lucide-react` para ícones.

## Pontos de atenção

- Toda página que usa hooks precisa de `"use client"` na primeira linha.
- Guarde a rota **e** confie na RLS: a guarda de módulo é usabilidade, não segurança. A autorização real está no banco.
- `/cddi` fixa `"CDDI-2026"` como código de aplicação em todas as chamadas; `/cddi/chefia/[personId]` usa o mesmo padrão, mas aceita outro ciclo por `?ciclo=` (é assim que `/equipe` propaga o ciclo selecionado). Um novo ciclo exige revisar essas constantes.
- `/cddi` e `/admin/importacao` **não** usam `PlatformShell` — têm layout próprio de página inteira.
- Não pré-busque dados antes de `context.person` existir: sem sessão resolvida a RPC falha por `AUTH_REQUIRED`.
- Arquivos grandes (`admin/pesquisas/[surveyId]/page.tsx`, `paineis/cddi/page.tsx`) concentram muito JSX em poucas linhas; ao editar, mantenha a formatação existente para não gerar diff desnecessário.
