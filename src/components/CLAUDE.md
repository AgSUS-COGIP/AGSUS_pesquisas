# Módulo `src/components` — casca visual e design system

## Objetivo

Fornecer a linguagem visual institucional em três níveis: **primitivos** acessíveis (`ui/`), a **casca da aplicação** (`PlatformShell` e satélites) e **blocos de negócio** reutilizáveis (componentes `admin-*`, `avatar-*`, `cddi-*`).

Princípios e tokens em [../../docs/design-system.md](../../docs/design-system.md).

## Responsabilidades

- Encapsular acessibilidade (foco visível, `aria-*`, focus trap, alvo de 44 px, `prefers-reduced-motion`) para que as páginas não reimplementem.
- Manter estados visuais consistentes: carregando, vazio, erro, offline.
- **`ui/` não conhece Supabase nem regra de negócio.** Componentes de negócio consultam dados pelo cliente da API REST (`@/lib/api/cliente-*`), não por `supabase.rpc()`.

## Estrutura

```text
components/
├── platform-shell.tsx            casca: sidebar, cabeçalho, drawer, logout
├── platform-skeleton.tsx         skeleton no formato da casca
├── platform-icons.tsx            20 ícones SVG inline (navegação)
├── platform-theme-toggle.tsx     ciclo automático → claro → escuro
├── platform-interaction-layer.tsx barra de progresso, voltar ao topo, atalhos
├── platform-logo.tsx             logotipo institucional resolvido da marca
├── platform-branding-provider.tsx marca da plataforma (nome, cor, logotipo)
├── confirmation-provider.tsx     diálogo de confirmação + useConfirm()
├── app-providers.tsx             React Query, marca, confirmação, Toaster, reporter
├── client-error-reporter.tsx     captura window.error e unhandledrejection
├── network-status-banner.tsx     aviso de offline e de conexão restabelecida
├── full-page-state.tsx           tela inteira de acesso restrito / erro / vazio
├── platform-guard-state.tsx      renderiza os estados negados de usePlatformGuard()
├── external-image.tsx            next/image sem otimização, para host externo
├── person-avatar.tsx             foto do Google com fallback de ícone neutro
├── survey-banner.tsx             capa institucional com degradação
├── anonymity-notice.tsx          o que um ciclo anônimo garante — e o que não garante
├── survey-rule-editor.tsx        regra condicional de uma pergunta ou seção
├── cddi-loading-state.tsx        skeleton do formulário CDDI
├── cddi-platform-frame.tsx       moldura de página inteira das telas do CDDI
├── cddi-scroll-boundary.tsx      invólucro estático da rota /cddi
├── people-base-summary.tsx       retrato da base mestra de pessoas
├── admin-participant-management.tsx     participantes por pesquisa
├── admin-participant-bulk-selector.tsx  vinculação em lote
├── admin-people-teams-management.tsx    pessoas, dados funcionais, lideranças
└── ui/                           primitivos do design system
    ├── surface.tsx      Surface · PageHeader · StatCard
    ├── button.tsx       Button + buttonVariants (primary·secondary·ghost·danger)
    ├── badge.tsx        Badge + badgeVariants (neutral·info·success·warning·danger·outline)
    ├── form-controls.tsx Input · Textarea · Select · Choice · Checkbox · Radio
    ├── data-table.tsx   11 primitivos de tabela
    ├── feedback.tsx     ErrorSummary · EmptyState
    ├── overlay-panel.tsx OverlayPanel · Dialog · Drawer  (focus trap manual)
    ├── dialog.tsx       Dialog  (<dialog> nativo) — homônimo, comportamento diferente
    ├── page-navigation.tsx Breadcrumbs · PageActions
    ├── skeleton.tsx     Skeleton · TextSkeleton
    └── tabs.tsx         Tabs  (não utilizado)
```

## Interfaces públicas principais

```tsx
<PlatformShell user={PlatformUser} title="…" eyebrow="…" actions={…}>{children}</PlatformShell>
// PlatformUser: { fullName, profileLabel, institutionalEmail?, employeeNumber?,
//                 avatarUrl?, roles?, modules? }

<PlatformSkeleton title="Carregando …" />
<PersonAvatar fullName avatarUrl? className? imageClassName? fallbackClassName? alt? />
<PlatformIcon name={PlatformIconName} className? />
<SurveyBanner src fallbackSrc? alt className? />

<Drawer  open onOpenChange title description? side="left|right" … />
<Dialog  open onOpenChange title description? … />   // de overlay-panel.tsx
<EmptyState title description icon? action? />
<ErrorSummary errors={string[]} title? />
<Input label hint? error? … />                        // idem Textarea, Select, Checkbox, Radio

<FullPageState tone="restricted|error|empty" title description action? />
<PlatformGuardState guard={usePlatformGuard(…)} title restrictedTitle? restrictedDescription? unidentifiedTitle? />
<PlatformLogo src alt organizationName width height loading? … />
<CddiPlatformFrame title>{children}</CddiPlatformFrame>
<ExternalImage {...propsDeNextImage} />               // sem loader nem otimização

const confirm = useConfirm();                          // confirmation-provider.tsx
if (!(await confirm({ title, description, confirmLabel, tone: "danger" }))) return;

const { branding, loading } = usePlatformBranding();   // platform-branding-provider.tsx
```

## Fluxo interno

### `PlatformShell`

```text
1. modules = user.modules ?? PARTICIPANT_ROLE_MODULES (somente SURVEYS)
2. navigationGroupsForModules(modules) → grupos Principal / Atuação / Administração
3. usePlatformBranding() → nome, cor e logotipo; PlatformLogo cobre o intervalo
   de carregamento sem trocar o tamanho da caixa
4. estado compacto lido do atributo data-agsus-sidebar-compact no <html>
   (já definido pelo script beforeInteractive do layout raiz — sem flash)
5. alternar compacto grava em localStorage e no atributo do documento
6. PlatformCommandMenu recebe os mesmos `modules` — a paleta (Ctrl+K) nunca
   oferece destino que a navegação esconde
7. troca de rota fecha o drawer móvel (useEffect em pathname)
8. logout: auth.signOut({ scope: "local" }) → window.location.replace("/acesso")
```

Estrutura acessível: skip link (`#conteudo-principal`), `<aside aria-label="Navegação principal">`, `aria-current="page"` no item ativo, `<main tabIndex={-1}>`. Em modo compacto os rótulos somem e vão para `title` + `aria-label` (`"Rótulo: descrição"`).

`data-print-hidden="true"` marca sidebar e cabeçalho para exclusão na impressão.

### `PersonAvatar` — resolução da imagem

```text
1. Recebe `avatarUrl`, que os contratos do banco preenchem somente com a foto Google.
2. URL válida → renderiza a foto com `referrerPolicy="no-referrer"`.
3. URL ausente ou erro de carregamento → exibe ícone neutro, nunca iniciais.
4. Nova URL diferente da falhada → limpa o estado e tenta de novo.
```

`referrerPolicy="no-referrer"` é necessário para as URLs de foto do Google. A alteração da imagem acontece na conta Google e é sincronizada no carregamento do contexto.

### `PlatformThemeToggle`

Ciclo `system → light → dark → system`. Grava em `localStorage` e escreve três coisas no `<html>`: atributo de tema resolvido, atributo de preferência e `style.colorScheme`. Escuta `matchMedia("(prefers-color-scheme: dark)")` (só reage quando a preferência é `system`) e `storage` (sincroniza entre abas). `localStorage` indisponível degrada silenciosamente — o tema ainda vale para a aba atual.

### `SurveyBanner`

Capa de uma pesquisa, com degradação **em cadeia de três níveis**: `src` (a capa configurada pela administração) → `fallbackSrc` (a arte institucional) → bloco com gradiente e `role="img"`. A capa nunca deixa buraco no layout, mesmo quando a URL configurada sai do ar.

`src` vem de `resolveSurveyVisualIdentity()`, que devolve a capa personalizada do ciclo quando existe uma e o modo é `CUSTOM`. A administração configura imagem, texto alternativo, título e subtítulo (ver [../app/admin/CLAUDE.md](../app/admin/CLAUDE.md)).

### `AnonymityNotice`

Componente de servidor, sem estado. Duas variantes com públicos opostos: `admin` descreve o que se está ligando ao marcar "Avaliação anônima" em `/admin/pesquisas/nova`; `respondent` é a promessa exibida a quem responde, antes das perguntas.

Todo o texto vem de [@/lib/anonymity](../lib/CLAUDE.md), e não das telas, **porque as duas frases precisam ser a mesma promessa** — se divergirem, uma das duas está mentindo para alguém.

**As ressalvas ficam no mesmo bloco das garantias, nunca atrás de um "saiba mais".** Quem lê só a primeira metade entende "ninguém nunca saberá", o que é falso enquanto o rascunho existe: o bilhete de `tb_bilhete_anonimo` liga pessoa e submissão até o envio. A segunda ressalva é que `application_participants` continua registrando **que** a pessoa participou, com data — necessário para cobrar quem falta e impedir resposta em dobro.

### `CddiScrollBoundary`

Hoje é só `<div className="cddi-route-shell">{children}</div>` — componente de servidor, sem hook nem efeito. A versão anterior adicionava classes em `<html>`/`<body>` e usava um `MutationObserver` para distinguir a tela inicial da de formulário; isso foi removido junto com a correção de rolagem dos formulários, e o comportamento passou a ser inteiramente do CSS de `src/app/cddi/cddi-route.css`. **Não reintroduza observação de DOM aqui**: se a rolagem quebrar, a correção é no CSS da rota.

### `PlatformBrandingProvider`

Carrega a marca institucional (nome da organização, nome do produto, cor principal, logotipo) por React Query sob `platformBrandingQueryKey`, com cache local em `localStorage` (`agsus-platform-branding-v1`) para não piscar o padrão na primeira pintura. `usePlatformBranding()` entrega `{ branding, loading }`; `/admin/configuracoes` grava e atualiza a chave por `setQueryData`, então a mudança aparece na casca sem recarregar. Valor inválido degrada para `DEFAULT_PLATFORM_BRANDING` via `normalizePlatformBranding()`.

### `ConfirmationProvider` e `useConfirm()`

Substitui `window.confirm` em toda a aplicação. `await confirm({ title, description?, confirmLabel?, tone? })` devolve `boolean`; `tone: "danger"` marca ação irreversível. É montado por `AppProviders`, portanto qualquer componente de cliente pode chamar o hook. Como devolve promise, o padrão nas telas é `if (!(await confirm({ … }))) return;`.

**Com `prompt`, o diálogo também colhe a justificativa** e devolve o texto no lugar de `true` — `false` continua significando desistência, então o mesmo `if (!(await confirm({ … }))) return;` serve aos dois casos, e nenhuma chamada existente muda. `prompt: { label, placeholder?, hint?, minLength? }`; a validação é `confirmationReasonError()` de [@/lib/confirmation-prompt](../lib/CLAUDE.md), função pura e testada. Isso substituiu o `window.prompt` que a tela de remoção de respostas usava: ele abre fora da aplicação, ignora o tema, pode estar bloqueado no navegador e — o pior — não validava nada, então a pessoa confirmava o irreversível e só depois o banco recusava o motivo curto. **`minLength` tem de espelhar o mínimo da RPC**; divergir devolve o erro ao ponto que a validação existe para evitar.

### `OverlayPanel`

Focus trap completo: guarda o elemento focado, trava o scroll do `body`, foca o primeiro elemento focável, circula `Tab`/`Shift+Tab`, fecha com `Escape` e restaura o foco anterior na desmontagem. `onOpenChange` é lido de um ref para não recriar os listeners a cada render.

## Regras de negócio nesta camada

- **A navegação nunca mostra o que o usuário não pode acessar.** `PlatformShell` filtra por `modules`; grupos que ficam vazios desaparecem.
- **Fallback de módulos** é o conjunto do participante — jamais um módulo administrativo.
- **`PeopleBaseSummaryCard`** alerta quando `totalPeople <= 1`: sinal de base não carregada, com instrução explícita de reimportar.
- **Cor nunca é o único indicador de estado.** `Badge` e cartões sempre acompanham rótulo textual.

## Dependências

- [@/lib](../lib/CLAUDE.md) — `platform-navigation`, `platform-sidebar`, `platform-theme`, `platform-context`, `platform-branding`, `observability`, `utils`, `supabase/client`.
- `@tanstack/react-query` (contexto de marca e catálogo), `lucide-react` (ícones de conteúdo), `sonner` (toasts), `cmdk` (paleta de comandos), `class-variance-authority` (variantes).

`platform-icons.tsx` é um conjunto **próprio** de 20 SVGs usado apenas na navegação, para manter traço e peso consistentes. Ícones de conteúdo vêm de `lucide-react`.

## Convenções específicas

- `"use client"` em tudo que usa hook, `window` ou Supabase. `surface.tsx`, `badge.tsx`, `button.tsx`, `feedback.tsx`, `page-navigation.tsx`, `skeleton.tsx`, `platform-icons.tsx` e `cddi-scroll-boundary.tsx` são componentes de servidor — mantenha assim.
- Variantes por `cva`; a função de variantes é exportada junto (`buttonVariants`) para uso em `<Link>` que precisa parecer botão.
- Composição de classes sempre por `cn()`, com o `className` recebido por último para permitir sobrescrita.
- Todo primitivo aceita `className` e repassa o resto das props ao elemento nativo.
- Controles de formulário geram `id` com `useId()` e ligam `aria-describedby` a dica e erro, preservando qualquer `aria-describedby` recebido.
- Ícone decorativo leva `aria-hidden="true"`; botão só com ícone leva `aria-label`.
- Skeleton usa `motion-reduce:animate-none`.

## Pontos de atenção

- **Dois `Dialog` diferentes.** `ui/overlay-panel.tsx` (focus trap manual, aceita `footer`) e `ui/dialog.tsx` (`<dialog>` nativo, aceita `eyebrow`). Confira o caminho do import.
- **`useConfirm()` não aparece por cima de um `<dialog>` nativo.** O `<dialog>` de `ui/dialog.tsx` vive na camada superior do navegador; o diálogo do `ConfirmationProvider` é uma camada comum e fica **atrás** dele — presente no DOM, invisível e inalcançável, sem erro nenhum no console. Quem precisa confirmar a partir de um desses diálogos tem de fechá-lo antes e reabri-lo se a pessoa desistir; `removeRule()` em `tela-admin-construtor-pesquisa.tsx` é o exemplo.
- `PlatformInteractionLayer` é montado por `AppProviders` **sem** a prop `modules`, então os atalhos `Alt+1..4` / `Alt+A` nunca ativam.
- `PlatformInteractionLayer` e `NetworkStatusBanner` exibem, cada um, seu próprio aviso de offline — ambos ficam visíveis simultaneamente.
- `PersonAvatar` chama `usePlatformContext()`, portanto **cada instância** participa do ciclo do contexto. O cache de 2 min evita requisições repetidas, mas o componente não é adequado a listas muito longas fora do contexto autenticado.
- Não utilizados: `admin-participants-table.tsx`, `ui/tabs.tsx`. Ver melhorias no [README](../../README.md). `platform-command-menu.tsx` deixou de ser código morto — `PlatformShell` passou a renderizá-lo com os `modules` do usuário. `cddi-visual-banner.tsx` (sem consumidores) foi removido.
- **Removidos.** `admin-module-page.tsx`: a casca administrativa genérica que ele propunha virou a dupla `usePlatformGuard()` + `PlatformGuardState`, adotada por todas as rotas. `avatar-uploader.tsx`, `avatar-studio.tsx` e `avatar-identity-picker.tsx`: a foto de perfil passou a vir automaticamente da conta Google, sem escolha na interface — a migration `20260805194500_block_uploaded_profile_photos.sql` já bloqueava fotos enviadas no banco.
