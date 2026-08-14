# Módulo `src/app` — rotas e jornadas

## Objetivo

Expor as jornadas da plataforma como rotas do App Router. Cada pasta é uma jornada; o arquivo `tela-*.tsx` da pasta orquestra as RPCs necessárias e delega apresentação a [../components](../components/CLAUDE.md).

## Convenção de nomes de rota

`page.tsx` é nome reservado do App Router — a pasta define a URL e o arquivo marca "isto é uma página". Renomeá-lo apaga a rota. Para que o nome do arquivo diga qual tela ele contém, cada rota é dividida em dois arquivos:

```text
src/app/pesquisas/
├─ page.tsx                     # uma linha: export { default } from "./tela-catalogo-pesquisas";
└─ tela-catalogo-pesquisas.tsx  # a tela de verdade
```

O `page.tsx` só re-exporta; **toda edição de tela acontece no `tela-*.tsx`**. O prefixo `tela-` marca o componente de rota e o distingue de um componente comum de `components/`. Arquivos que não são `page.tsx` são ignorados pelo roteador, então o nome é livre — mantido em `kebab-case` como o resto do projeto.

Os demais arquivos reservados (`layout.tsx`, `error.tsx`, `loading.tsx`, `not-found.tsx`, `global-error.tsx`, `route.ts`) **não** seguem esse desdobramento: o nome reservado já descreve o papel, e há no máximo um de cada por pasta.

Submódulos com contexto próprio: [admin/](admin/CLAUDE.md) e [api/](api/CLAUDE.md).

## Responsabilidades

- Resolver identidade e permissões via `usePlatformContext()` e negar acesso quando o módulo exigido não estiver liberado.
- Chamar RPCs do Supabase, tratar erro/vazio/carregando e traduzir estados do banco em linguagem de interface.
- **Não** implementar regra de negócio: validação de escopo, período e papel acontece no banco ([../../supabase/CLAUDE.md](../../supabase/CLAUDE.md)).

## Arquivos importantes

| Arquivo | Papel |
|---|---|
| `layout.tsx` | Layout raiz. Metadados, viewport claro/escuro e dois scripts `beforeInteractive` que aplicam tema e sidebar antes da primeira pintura. Importa os cinco CSS globais. |
| `page.tsx` | Rota `/` — `redirect("/acesso")`. Única rota sem `tela-*.tsx`: são cinco linhas de redirecionamento, não uma tela. |
| `globals.css`, `theme-foundation.css`, `theme-enhancements.css`, `dark-theme.css`, `sidebar-monitora.css` | Tokens e temas. A ordem de import em `layout.tsx` importa: cascata posterior sobrescreve a anterior. |
| `error.tsx` / `global-error.tsx` | Boundaries de rota e de layout raiz. Ambos geram referência técnica e reportam via `reportApplicationError`. |
| `not-found.tsx`, `loading.tsx` | 404 institucional e skeleton global. |

## Rotas

A coluna **Tela** é o arquivo a abrir para editar a rota — o `page.tsx` ao lado dele só re-exporta.

| Rota | Tela | Módulo exigido | RPCs principais |
|---|---|---|---|
| `/acesso` | `acesso/tela-acesso.tsx` | pública | `auth.signInWithOAuth` (Google, `hd=agenciasus.org.br`) |
| `/auth/confirm` | `auth/confirm/route.ts` | pública | `auth.exchangeCodeForSession` — Route Handler, não página |
| `/area` | `area/tela-area-participante.tsx` | `HOME` — sem o módulo, redireciona para `/pesquisas` | `list_my_survey_catalog` |
| `/pesquisas` (tela "Pesquisas") | `pesquisas/tela-catalogo-pesquisas.tsx` | `SURVEYS` | `list_my_survey_catalog` |
| `/pesquisas/[applicationCode]` | `pesquisas/[applicationCode]/tela-responder-pesquisa.tsx` | `SURVEYS` | `get_public_survey_form`, `start_or_resume_my_survey_submission`, `save_my_survey_answer`, `submit_my_survey_submission` |
| `/cddi` | `cddi/tela-cddi-autoavaliacao.tsx` | participação no ciclo | `get_public_survey_form`, `start_or_resume_my_cddi_submission`, `get_my_cddi_identity`, `save_my_cddi_answer`, `submit_my_cddi_submission` |
| `/cddi/chefia/[personId]` (aceita `?ciclo=`) | `cddi/chefia/[personId]/tela-cddi-avaliar-chefia.tsx` | vínculo de liderança ativo | `get_public_survey_form`, `start_or_resume_my_cddi_submission` (tipo `CHEFIA`), `fc_obter_minha_equipe`, `save_my_cddi_answer`, `submit_my_cddi_submission` |
| `/equipe` | `equipe/tela-equipe.tsx` | `TEAM` | `fc_listar_ciclos_lideranca`, `fc_obter_minha_equipe`, `fc_pesquisar_equipe`, `add_person_to_my_team`, `remove_person_from_my_team` |
| `/paineis` | `paineis/tela-lista-paineis.tsx` | `DASHBOARDS` | `list_managed_surveys` |
| `/paineis/[applicationCode]` | `paineis/[applicationCode]/tela-painel-pesquisa.tsx` | `DASHBOARDS` | `get_survey_dashboard` |
| `/paineis/cddi` | `paineis/cddi/tela-painel-cddi.tsx` | `DASHBOARDS` | `get_cddi_monitoring_dashboard` |
| `/perfil` | `perfil/tela-perfil.tsx` | autenticado | foto do Google sincronizada por `usePlatformContext()`; dados institucionais somente leitura |
| `/resultados` | `resultados/tela-resultados.tsx` | `RESULTS` (Admin e Superadmin) | nenhuma — placeholder com `EmptyState` |
| `/admin/**` | ver [admin/CLAUDE.md](admin/CLAUDE.md) | `ADMIN_*` | ver [admin/CLAUDE.md](admin/CLAUDE.md) |
| `/api/**` | `route.ts` por pasta | ver módulo | ver [api/CLAUDE.md](api/CLAUDE.md) |

## Fluxo interno de uma página autenticada

```tsx
"use client";

export default function AlgumaPagina() {
  // A guarda resolve os quatro desfechos de acesso de uma vez.
  const guard = usePlatformGuard(PLATFORM_MODULE.MODULO);

  if (guard.state !== "granted") {
    return <PlatformGuardState
      guard={guard}
      title="…"                       // "Carregando {title}" no skeleton
      restrictedTitle="…"
      restrictedDescription="…"
    />;
  }

  // `guard.user`, `guard.person` e `guard.modules` são não-nulos por tipo.
  return <PlatformShell user={guard.user} eyebrow="…" title="…">{/* conteúdo */}</PlatformShell>;
}
```

Detalhes de `usePlatformGuard()` e dos quatro estados em [../lib/CLAUDE.md](../lib/CLAUDE.md). Omitir o módulo deixa a página aberta a qualquer pessoa identificada.

**Consulta só depois da guarda.** Condicione a `guard.state === "granted"` — não a "existe pessoa". Disparar antes faz uma RPC restrita falhar na RLS e mostrar erro numa tela que seria negada de qualquer modo:

```tsx
const granted = guard.state === "granted";
const query = useQuery({ queryKey: [...], queryFn: …, enabled: granted });
```

Carregamento manual usa flag `active` + cleanup, para descartar resposta de componente desmontado:

```tsx
useEffect(() => {
  if (!granted) return;           // espera a guarda liberar antes de consultar
  let active = true;
  void (async () => { /* … */ if (!active) return; setDados(data); })();
  return () => { active = false; };
}, [granted]);
```

## Linguagem visual das telas

As telas usam os primitivos de [../components/ui](../components/CLAUDE.md) (`Surface`, `PageHeader`, `StatCard`, `Button`, `Badge`, `Breadcrumbs`, `EmptyState`, `Skeleton`) e **tokens CSS**, nunca hexadecimal literal — é assim que a aplicação inteira acompanha o tema escuro. Três consequências práticas:

- **Código do banco não é rótulo.** `DRAFT`, `OPEN`, `SUBMITTED` são vocabulário interno; a tela mostra "Rascunho", "Aberto", "Enviada", e guarda o código no `title` do selo para quem precisa correlacionar com o banco.
- **Botão indisponível explica o motivo.** Vale para toda a aplicação, não só para a administração: quando uma ação está desabilitada, a razão aparece junto (`title` + `aria-describedby` + nota visível).
- **Estado nunca depende só de cor.** Todo selo, cartão de alternativa e etapa de progresso leva rótulo textual ou ícone além da cor.

**Três exceções deliberadas ao uso de tokens**, todas por identidade institucional fixa:

| Onde | O quê | Por quê |
|---|---|---|
| `cddi/tela-cddi-autoavaliacao.tsx` e `cddi/chefia/[personId]/…` | `CDDI_INK` (`#26368d`) e `CDDI_RULE` (`#2d3f97`) | Azul do instrumento CDDI, independente do tema da plataforma. São constantes nomeadas no topo de cada arquivo — não espalhe literais novos. |
| `acesso/tela-acesso.tsx` | paleta institucional literal | Tela pública, sempre clara, fora da casca temática. |
| Barra de cinco cores | `#003b70 · #0b8f58 · #f2b705 · #d92d3a · #00a8d6` | Marca institucional, não é cor de interface. |

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

Cada `tela-*.tsx` exporta apenas o componente padrão, e o `page.tsx` da mesma pasta o re-exporta. `layout.tsx` exporta `metadata`, `viewport` e o layout. `cddi/layout.tsx` exporta `metadata`, importa `cddi-route.css` e envolve a rota em `CddiScrollBoundary` — hoje um invólucro estático que só aplica a classe `cddi-route-shell`; o comportamento de scroll ficou por conta do CSS da rota.

## Dependências

- [@/lib](../lib/CLAUDE.md) — `usePlatformGuard` (guarda de página), `usePlatformContext`, `metadataText`, `createBrowserSupabaseClient`, helpers de domínio.
- [@/components](../components/CLAUDE.md) — `PlatformShell`, `PlatformGuardState` (os estados negados da guarda), `PlatformSkeleton`, `PersonAvatar`, `FullPageState`, `useConfirm`, primitivos `ui/`.
- [@/hooks/use-survey-catalog](../hooks/use-survey-catalog.ts) — consulta cacheada de `list_my_survey_catalog`, compartilhada por `/area` e `/pesquisas`.
- `sonner` (`toast`) para retorno de ação; `lucide-react` para ícones.

## Pontos de atenção

- Toda página que usa hooks precisa de `"use client"` na primeira linha.
- Guarde a rota **e** confie na RLS: a guarda de módulo é usabilidade, não segurança. A autorização real está no banco.
- `/cddi` fixa `"CDDI-2026"` como código de aplicação em todas as chamadas; `/cddi/chefia/[personId]` usa o mesmo padrão, mas aceita outro ciclo por `?ciclo=` (é assim que `/equipe` propaga o ciclo selecionado). Um novo ciclo exige revisar essas constantes.
- `/cddi` **não** usa `PlatformShell` — tem layout próprio de página inteira.
- Não pré-busque dados antes de `context.person` existir: sem sessão resolvida a RPC falha por `AUTH_REQUIRED`.
- Arquivos grandes (`admin/pesquisas/[surveyId]/tela-admin-construtor-pesquisa.tsx`, `paineis/cddi/tela-painel-cddi.tsx`) concentram muito JSX em poucas linhas; ao editar, mantenha a formatação existente para não gerar diff desnecessário.
- Ao criar uma rota nova, crie os **dois** arquivos: a `tela-*.tsx` com o componente e o `page.tsx` de uma linha que a re-exporta. Só `page.tsx` não basta para o nome ser descritivo; só `tela-*.tsx` não cria rota alguma.
