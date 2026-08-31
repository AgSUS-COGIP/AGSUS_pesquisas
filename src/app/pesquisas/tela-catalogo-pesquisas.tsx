"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, ClipboardList, FileText, Filter, Loader2, RefreshCw, Search, Settings2 } from "lucide-react";
import { PlatformGuardState } from "@/components/platform-guard-state";
import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { PlatformWelcome, useWelcomeState } from "@/components/platform-welcome";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Surface } from "@/components/ui/surface";
import { useSurveyCatalog } from "@/hooks/use-survey-catalog";
import { usePlatformGuard } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";
import { cn } from "@/lib/utils";
import { summarizeSurveyCatalog, surveyApplicationHref, surveyItemState, type SurveyCatalogItem } from "@/lib/survey-catalog";
import { deadlineLabel, deadlineStatus } from "@/lib/deadline";
import {
  BORDA_DO_TOM,
  TEXTO_DO_TOM,
  VARIANTE_DE_BADGE,
  tomDaSituacaoDoCiclo,
  tomDoEnvio,
  tomDoEstadoDaAvaliacao,
  tomDoPrazo,
} from "@/lib/tom-semantico";

type FilterKey = "ALL" | "OPEN" | "DRAFT" | "COMPLETED" | "SCHEDULED" | "CLOSED";

function statusLabel(status: string) {
  if (status === "OPEN") return "Aberta";
  if (status === "CLOSED") return "Fechado";
  if (status === "SCHEDULED") return "Agendada";
  return "Rascunho";
}

function itemFilterState(item: SurveyCatalogItem): FilterKey {
  const state = surveyItemState(item);
  if (state === "IN_PROGRESS") return "DRAFT";
  if (state === "PENDING") return "OPEN";
  return state;
}

function dateLabel(value: string | null) {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

function actionLabel(item: SurveyCatalogItem) {
  if (["SUBMITTED", "VALIDATED"].includes(item.submissionStatus ?? "")) return "Consultar";
  // O ciclo fechado vem antes do rascunho pela mesma razão que em
  // `surveyItemState`: "Continuar" num ciclo que o banco não aceita mais é
  // convite para uma ação que termina em recusa.
  if (item.applicationStatus === "CLOSED") return "Visualizar";
  if (item.submissionStatus === "DRAFT") return "Continuar";
  if (item.applicationStatus === "OPEN") return "Responder";
  return "Visualizar";
}

const filters: Array<{ key: FilterKey; label: string }> = [
  { key: "ALL", label: "Todas" },
  { key: "OPEN", label: "Abertas" },
  { key: "DRAFT", label: "Em andamento" },
  { key: "COMPLETED", label: "Concluídas" },
  { key: "SCHEDULED", label: "Agendadas" },
  { key: "CLOSED", label: "Fechadas" },
];

/*
  O tom do cartão — usado pelo selo e pelo traço superior, que dizem a mesma
  coisa — vem da gramática compartilhada.

  O mapa anterior contrariava o resto do produto em três pontos: "Em andamento"
  era âmbar e "Concluída" era azul — as duas famílias trocadas —, e "Fechada"
  era vermelha.

  O vermelho vinha da intenção certa: não deixar o prazo perdido passar
  despercebido. Mas ele marcava o **ciclo encerrado**, que é o desfecho normal
  de toda avaliação, e não o prazo perdido. O resultado era vermelho em quase
  todo cartão antigo, e vermelho que aparece sempre deixa de significar
  problema. Quem cuida da urgência agora é o tom do prazo, que distingue
  "encerrou" de "venceu com resposta pendente".
*/
function tomDoCartao(estado: Exclude<FilterKey, "ALL">) {
  if (estado === "OPEN") return tomDaSituacaoDoCiclo("OPEN");
  if (estado === "DRAFT") return tomDoEstadoDaAvaliacao("IN_PROGRESS");
  if (estado === "COMPLETED") return tomDoEstadoDaAvaliacao("COMPLETED");
  if (estado === "SCHEDULED") return tomDoEstadoDaAvaliacao("SCHEDULED");
  return tomDoEstadoDaAvaliacao("CLOSED");
}

function filterFromQuery(value: string | null): FilterKey {
  const normalized = value?.toUpperCase();
  return filters.some((item) => item.key === normalized) ? normalized as FilterKey : "ALL";
}

function SurveysPageContent() {
  const guard = usePlatformGuard(PLATFORM_MODULE.SURVEYS);
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const requestedFilter = filterFromQuery(searchParams.get("situacao"));
  const [filter, setFilter] = useState<FilterKey>(requestedFilter);
  const catalogQuery = useSurveyCatalog(guard.state === "granted");
  const items = useMemo(() => catalogQuery.data ?? [], [catalogQuery.data]);
  const catalogLoading = catalogQuery.isLoading;
  // Matrícula: é como este projeto identifica a pessoa, e é a chave que faz a
  // recepção ser dispensada uma vez só, valendo para as duas telas de entrada.
  const welcome = useWelcomeState();

  useEffect(() => {
    setFilter(requestedFilter);
  }, [requestedFilter]);

  const firstName = guard.state === "granted"
    ? guard.person.fullName.split(/\s+/).filter(Boolean)[0] ?? guard.person.fullName
    : "";

  const counts = useMemo(() => {
    const result: Record<FilterKey, number> = { ALL: items.length, OPEN: 0, DRAFT: 0, COMPLETED: 0, SCHEDULED: 0, CLOSED: 0 };
    items.forEach((item) => { result[itemFilterState(item)] += 1; });
    return result;
  }, [items]);

  const metrics = useMemo(() => summarizeSurveyCatalog(items), [items]);

  // Rótulos e legendas vieram da #19; aqui eles só deixaram de ser quatro
  // `StatCard` para virar uma faixa. `alert` liga o realce de urgência sem que a
  // cor seja o único indicador — a legenda continua dizendo quantas vencem.
  const metricTiles = [
    { label: "Disponíveis", value: metrics.total, description: "total destinado ao seu perfil", alert: false, tom: "info" as const },
    {
      label: "Pendentes",
      // `metrics.pending`, não `metrics.actionable`. `actionable` é
      // `pending + inProgress`, então uma avaliação já iniciada era contada aqui
      // **e** no indicador ao lado: a mesma avaliação aparecia como "ainda não
      // iniciada" e "em andamento" ao mesmo tempo, e a soma dos dois passava do
      // total de "Disponíveis". `/area` sempre usou `pending` — as duas telas
      // discordavam sobre o mesmo catálogo.
      value: metrics.pending,
      description: metrics.urgent > 0
        ? `${metrics.urgent} ${metrics.urgent === 1 ? "vence" : "vencem"} em até 7 dias`
        : "ainda não iniciadas",
      alert: !catalogLoading && metrics.urgent > 0,
      tom: "warning" as const,
    },
    { label: "Em andamento", value: metrics.inProgress, description: "iniciadas e ainda não enviadas", alert: false, tom: "info" as const },
    {
      label: "Finalizadas",
      value: metrics.completed,
      description: metrics.total ? `${metrics.completionRate}% do total` : "respondidas e enviadas",
      alert: false,
      tom: "success" as const,
    },
  ];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesTerm = !term || `${item.surveyCode} ${item.surveyName} ${item.applicationCode} ${item.applicationName}`.toLowerCase().includes(term);
      const matchesFilter = filter === "ALL" || itemFilterState(item) === filter;
      return matchesTerm && matchesFilter;
    });
  }, [items, search, filter]);

  if (guard.state !== "granted") {
    return <PlatformGuardState
      guard={guard}
      title="avaliações"
      restrictedTitle="Módulo indisponível"
      restrictedDescription="Seu perfil não possui acesso ao módulo de avaliações. Fale com a administração se acredita que isso é um engano."
    />;
  }

  return (
    <PlatformShell
      user={guard.user}
      title="Avaliações"
    >
      <div className="space-y-5">
        {/*
          A recepção mora aqui **e** na Visão geral porque as duas são "primeira
          tela" para públicos diferentes. O Participante não tem o módulo `HOME`:
          `/area` o redireciona para cá. Colocar as boas-vindas só lá deixava a
          mensagem invisível justamente para quem ela foi escrita — quem abre um
          formulário de 52 perguntas pela primeira vez.

          Dispensar numa tela dispensa na outra: a chave é a matrícula, não a
          rota.
        */}
        <PlatformWelcome visible={welcome.visible} onDismiss={welcome.dismiss} firstName={firstName} />
        <section aria-labelledby="catalogo-avaliacoes-titulo" className="border-b border-[var(--border-subtle)] pb-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 id="catalogo-avaliacoes-titulo" className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">Avaliações disponíveis</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Acompanhe prazos e retome os formulários que você já iniciou.</p>
            </div>
            <label className="relative block w-full md:w-80">
              <span className="sr-only">Buscar avaliação</span>
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" aria-hidden="true" />
              <input
                type="search"
                enterKeyHint="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome ou código"
                className="h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] pl-10 pr-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--focus-ring)]/20"
              />
            </label>
          </div>

          {/*
            Resolução de conflito com a #19, que reescreveu os rótulos destes
            indicadores. Os textos de lá foram mantidos na íntegra — "Pendentes",
            "Finalizadas" e as legendas novas —, e daqui veio só o tratamento
            visual: sem moldura de cartão, porque eram caixas dentro da caixa do
            cabeçalho. É o mesmo padrão da Visão geral, com régua fina separando
            os números.
          */}
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-[var(--border-subtle)] pt-4 sm:grid-cols-4 sm:divide-x sm:divide-[var(--border-subtle)]">
            {metricTiles.map((tile, index) => (
              /*
                O número carrega o tom do que ele conta, em vez de todos serem
                azul institucional. Antes, "Pendentes" e "Finalizadas" tinham a
                mesma cor: dois estados opostos, visualmente iguais.

                Só o número muda de cor. A régua que separa os indicadores
                continua neutra — colori-la também somaria um segundo separador
                ao `divide-x` que já existe, e a faixa ganharia peso sem ganhar
                informação. Rótulo e legenda seguem dizendo tudo, então quem não
                distingue as cores não perde nada.
              */
              <div key={tile.label} className={index > 0 ? "sm:pl-6" : undefined}>
                <dt className="text-xs font-medium text-[var(--text-secondary)]">{tile.label}</dt>
                <dd>
                  <strong className={`mt-1.5 block text-2xl font-semibold leading-none tabular-nums ${TEXTO_DO_TOM[tile.tom]}`}>
                    {catalogLoading ? "—" : tile.value}
                  </strong>
                  <span className={`mt-2 block text-xs leading-4 ${tile.alert ? `font-semibold ${TEXTO_DO_TOM.warning}` : "text-[var(--text-secondary)]"}`}>
                    {catalogLoading ? "carregando" : tile.description}
                  </span>
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-4" role="tablist" aria-label="Filtrar avaliações por situação">
            <Filter className="mr-1 h-4 w-4 shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />
            {filters.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={filter === item.key}
                onClick={() => setFilter(item.key)}
                className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-md border px-3 text-xs font-semibold transition ${filter === item.key ? "border-[var(--brand-primary)] bg-[var(--control-active)] text-[var(--brand-primary)]" : "border-transparent bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"}`}
              >
                {item.label}
                <span className="rounded px-1.5 py-0.5 text-[11px] tabular-nums bg-[var(--surface-card)]">{counts[item.key]}</span>
              </button>
            ))}
          </div>
        </section>

        {(catalogLoading || filtered.length !== items.length) ? (
          <p className="text-sm text-[var(--text-secondary)]" aria-live="polite">
            {catalogLoading ? "Atualizando avaliações..." : `Mostrando ${filtered.length} de ${items.length}`}
          </p>
        ) : null}

        {catalogLoading ? (
          <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-64 animate-pulse rounded-2xl bg-[var(--surface-card)] ring-1 ring-[var(--border-subtle)]" />)}
          </section>
        ) : catalogQuery.isError ? (
          <EmptyState
            icon={<RefreshCw className="h-6 w-6" aria-hidden="true" />}
            title="Não foi possível carregar as avaliações"
            description={catalogQuery.error instanceof Error ? catalogQuery.error.message : "Tente novamente em alguns instantes."}
            action={<Button variant="secondary" onClick={() => void catalogQuery.refetch()}><RefreshCw className="h-4 w-4" aria-hidden="true" />Tentar novamente</Button>}
          />
        ) : filtered.length ? (
          <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {filtered.map((item) => {
              const state = itemFilterState(item);
              const completed = state === "COMPLETED";
              const deadline = deadlineStatus(item.closesAt, new Date());
              const showCountdown = item.applicationStatus === "OPEN" && (deadline.state === "counting" || deadline.state === "today");
              /*
                A contagem era sempre âmbar, faltassem 3 dias ou 60. Cor que não
                varia com a urgência não informa urgência — só ocupa a mesma
                atenção em todo cartão, e some no meio dos demais quando o prazo
                de fato aperta.

                `tomDoPrazo` lê o que `deadlineStatus` já apurou; nada é
                recalculado aqui.
              */
              const tomDoContador = tomDoPrazo(deadline);
              const tomDoEnvioDoItem = tomDoEnvio(item.submissionStatus, completed);
              /*
                Traço e selo dizem a mesma coisa, de propósito.

                Tentei antes fazer o traço seguir o estado do item — o que a
                pessoa tem a fazer — enquanto o selo seguia a situação do ciclo.
                Medido na tela, o resultado foi um cartão com selo verde
                "Aberta" e traço âmbar: duas cores concorrentes afirmando coisas
                diferentes no mesmo canto, e nenhuma legenda explicando a
                distinção. O traço é reforço do selo, não um segundo canal.

                A urgência de quem ainda não começou continua sendo dita — pelo
                contador de prazo, que tem tom próprio e um texto ao lado.
              */
              const tom = tomDoCartao(state === "ALL" ? "OPEN" : state);
              return (
                /*
                  Cartão enxugado. Saíram a faixa de gradiente (repetida em todo
                  cartão, virava ruído em vez de marca), os dois selos de código
                  no topo — que competiam com o selo de situação, o único que
                  informa algo acionável — e as caixas cinza em volta dos metadados.
                  Os códigos continuam visíveis, como texto secundário.
                */
                /*
                  Traço superior de 3px, e não cartão colorido: a situação fica
                  legível de longe sem que o conteúdo perca a superfície neutra
                  em que se lê. `border-t-[3px]` é a mesma espessura que a tela
                  de Configurações já usa para marcar seção.

                  Não substitui o selo — é redundância deliberada. Quem não
                  distingue as cores continua lendo "Aberta", "Agendada" ou
                  "Fechado" no selo ao lado do título.
                */
                <Surface
                  key={item.applicationId}
                  className={`group flex min-h-56 flex-col overflow-hidden rounded-lg border-t-[3px] transition-colors hover:border-[var(--border-strong)] ${BORDA_DO_TOM[tom]}`}
                >
  {/* ↓ min-w-0 é obrigatório aqui para que o flex respeite a largura do card */}
  <div className="flex min-w-0 flex-1 flex-col p-5 sm:p-6">
    <div className="flex items-start justify-between gap-3">
      <h3 className="min-w-0 line-clamp-2 break-words text-lg font-semibold leading-snug tracking-tight text-[var(--text-primary)]">
        {item.applicationName}
      </h3>
      <Badge variant={VARIANTE_DE_BADGE[tom]} className="shrink-0">
        {completed ? "Concluída" : state === "DRAFT" ? "Em andamento" : statusLabel(item.applicationStatus)}
      </Badge>
    </div>

    <p className="mt-2 line-clamp-2 break-words text-sm font-medium leading-5 text-[var(--text-secondary)]">{item.surveyName}</p>

    <p className="mt-1 truncate text-xs text-[var(--text-muted)]" title={`${item.surveyCode} · ${item.applicationCode}`}>
      {item.surveyCode} · {item.applicationCode}
    </p>

    {/* ↓ overflow-hidden reforça o line-clamp; break-all pega strings sem espaços */}
    <p className="mt-3 line-clamp-2 overflow-hidden break-words text-sm leading-6 text-[var(--text-secondary)]">
      {item.description || "Instrumento institucional disponível conforme seu perfil."}
    </p>

    {/* ↓ min-w-0 aqui também, para os metadados não estourarem */}
    <div className="mt-4 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[var(--text-secondary)]">
      <span className="inline-flex min-w-0 items-center gap-1.5 break-words">
        <ClipboardList className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{item.sections} seções · {item.questions} perguntas</span>
      </span>
      <span className="inline-flex min-w-0 items-center gap-1.5 break-words">
        <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">Prazo: {dateLabel(item.closesAt)}</span>
      </span>
      {showCountdown ? (
        <span className={`inline-flex min-w-0 items-center gap-1.5 break-words font-semibold ${TEXTO_DO_TOM[tomDoContador]}`} aria-label={`Prazo: ${deadlineLabel(deadline)}`}>
          <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{deadlineLabel(deadline)}</span>
        </span>
      ) : null}
    </div>

    <div className="mt-auto flex min-w-0 items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
      {/*
        O ícone acompanha o tom, e o texto continua dizendo tudo: quem não
        distingue as cores lê "Envio concluído", "Rascunho salvo" ou "Não
        iniciada" exatamente como antes.
      */}
      <span className={`inline-flex min-w-0 items-center gap-2 truncate text-xs font-semibold ${TEXTO_DO_TOM[tomDoEnvioDoItem]}`}>
        {completed ? (
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        ) : (
          <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
        )}
        <span className="truncate">
          {completed ? "Envio concluído" : item.submissionStatus === "DRAFT" ? "Rascunho salvo" : "Não iniciada"}
        </span>
      </span>
      <div className="flex shrink-0 gap-2">
        {/*
          O atalho administrativo leva à operação do ciclo, não ao construtor.

          Este catálogo só lista ciclos que já estão publicados — é o que a
          pessoa pode responder. Para esses, o construtor está protegido: quem
          clicava chegava a uma tela sem ação possível. A operação do ciclo é o
          destino que sempre tem o que fazer: período, público, abertura e
          encerramento.

          O rótulo acompanha o destino. "Configurar" prometia edição do
          instrumento; "Gerenciar ciclo" diz o que a próxima tela entrega.
        */}
        {item.canManage ? (
          <Link href={`/admin/pesquisas/${item.surveyId}/operacao`} aria-label={`Gerenciar ciclo de ${item.surveyName}`} className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "h-10 w-10 px-0")}>
            <Settings2 className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : null}
        <Link href={surveyApplicationHref(item)} className={cn(buttonVariants({ variant: "primary", size: "sm" }), "institutional-action")}>
          {actionLabel(item)}
        </Link>
      </div>
    </div>
  </div>
</Surface>
              );
            })}
          </section>
        ) : items.length ? (
          <EmptyState
            icon={<Search className="h-6 w-6" aria-hidden="true" />}
            title="Nenhuma avaliação corresponde aos critérios"
            description="Ajuste o texto da busca ou escolha outro filtro de situação para ver os ciclos disponíveis."
            action={<Button variant="secondary" onClick={() => { setSearch(""); setFilter("ALL"); }}>Limpar busca e filtros</Button>}
          />
        ) : (
          <EmptyState
            title="Nenhuma avaliação disponível no momento"
            description="Quando um novo ciclo for liberado para o seu perfil, ele aparecerá aqui automaticamente."
          />
        )}

        {catalogQuery.isFetching && !catalogLoading ? <p className="flex items-center justify-center text-sm text-[var(--text-secondary)]"><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />Atualizando catálogo...</p> : null}
      </div>
    </PlatformShell>
  );
}

export default function SurveysPage() {
  return (
    <Suspense fallback={<PlatformSkeleton title="Carregando avaliações" />}>
      <SurveysPageContent />
    </Suspense>
  );
}
