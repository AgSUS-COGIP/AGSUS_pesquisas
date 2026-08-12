"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Copy, FileEdit, FilePlus2, FileQuestion, Search, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { PlatformShell } from "@/components/platform-shell";
import { PlatformGuardState } from "@/components/platform-guard-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, StatCard } from "@/components/ui/surface";
import { usePlatformGuard } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type ManagedSurvey = {
  surveyId: string; code: string; name: string; description: string | null; status: string;
  versionNumber: number; versionStatus: string; applicationName: string | null;
  applicationCode: string | null;
  applicationStatus: string | null; opensAt: string | null; closesAt: string | null;
  sections: number; questions: number;
};

/**
 * Copia o link direto de resposta da avaliação.
 *
 * Quem abre o link entra pelo login institucional e o banco decide se pode
 * responder — o link não dá acesso por si só, apenas encurta o caminho.
 */
function copyResponseLink(survey: ManagedSurvey) {
  if (!survey.applicationCode) {
    toast.error("Este instrumento ainda não tem ciclo configurado.");
    return;
  }
  const path = survey.code === "CDDI" ? "/cddi" : `/pesquisas/${encodeURIComponent(survey.applicationCode)}`;
  const url = `${window.location.origin}${path}`;
  if (!navigator.clipboard) {
    toast.error(`Copie o link manualmente: ${url}`);
    return;
  }
  void navigator.clipboard.writeText(url).then(
    () => toast.success("Link de resposta copiado. Quem abrir entra pelo login institucional."),
    () => toast.error(`Não foi possível copiar. Link: ${url}`),
  );
}

/** Códigos do banco traduzidos: a interface fala português, o código fica no `title`. */
const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Agendado",
  OPEN: "Aberto",
  CLOSED: "Encerrado",
  CANCELLED: "Cancelado",
  ACTIVE: "Ativo",
  PUBLISHED: "Publicado",
  ARCHIVED: "Arquivado",
  RETIRED: "Descontinuado",
};

function dateLabel(value: string | null) {
  if (!value) return "sem data";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

function statusLabel(status: string | null) {
  if (!status) return "Não configurado";
  return STATUS_LABELS[status] ?? status;
}

function statusVariant(status: string | null) {
  if (["OPEN", "ACTIVE", "PUBLISHED"].includes(status ?? "")) return "success" as const;
  if (["CLOSED", "ARCHIVED", "RETIRED"].includes(status ?? "")) return "neutral" as const;
  if (status === "CANCELLED") return "danger" as const;
  if (status === "SCHEDULED") return "info" as const;
  return "warning" as const;
}

export default function AdminSurveysPage() {
  const guard = usePlatformGuard(PLATFORM_MODULE.ADMIN_SURVEYS);
  const [surveys, setSurveys] = useState<ManagedSurvey[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [search, setSearch] = useState("");
  const granted = guard.state === "granted";

  // Só consulta depois que a guarda liberou: sem módulo, a RPC seria negada
  // pela RLS e o erro apareceria como toast numa tela que nem chega a abrir.
  useEffect(() => {
    if (!granted) return;
    const load = async () => {
      setDataLoading(true);
      try {
        const supabase = createBrowserSupabaseClient();
        const { data, error: listError } = await supabase.rpc("list_managed_surveys");
        if (listError) throw listError;
        setSurveys(Array.isArray(data) ? data as ManagedSurvey[] : []);
      } catch (loadError) {
        toast.error(loadError instanceof Error ? loadError.message : "Não foi possível carregar as avaliações.");
      } finally { setDataLoading(false); }
    };
    void load();
  }, [granted]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return surveys;
    return surveys.filter((item) => `${item.code} ${item.name} ${item.applicationName ?? ""}`.toLowerCase().includes(term));
  }, [search, surveys]);

  if (guard.state !== "granted") {
    return <PlatformGuardState
      guard={guard}
      title="avaliações"
      unidentifiedTitle="Não foi possível abrir as avaliações"
      restrictedTitle="Gestão de pesquisas restrita"
      restrictedDescription="Seu perfil não possui permissão para construir ou operar pesquisas."
    />;
  }

  const activeCycles = surveys.filter((item) => ["OPEN", "SCHEDULED"].includes(item.applicationStatus ?? "")).length;
  const totalQuestions = surveys.reduce((sum, item) => sum + Number(item.questions || 0), 0);
  const searching = search.trim().length > 0;

  return <PlatformShell
    user={guard.user}
    eyebrow="Administração"
    title="Avaliações e ciclos"
  >
    <div className="mx-auto w-full max-w-[1400px] space-y-5">
      {/* A criação é a ação da rota, não da casca: fica no topo do conteúdo,
          à direita, antes do cabeçalho da tela. */}
      <nav aria-label="Ações do catálogo" className="flex justify-end">
        <Link
          href="/admin/pesquisas/nova"
          title="Criar uma avaliação em rascunho"
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--brand-solid)] px-4 text-sm font-semibold text-[var(--text-on-brand)] shadow-sm transition hover:bg-[var(--brand-solid-hover)]"
        >
          <FilePlus2 className="h-4 w-4" aria-hidden="true" />
          Nova avaliação
        </Link>
      </nav>

      <PageHeader
        eyebrow="Estúdio e operação"
        title="Da construção à abertura do ciclo"
        description="Edite o instrumento, verifique a prontidão, configure o período e controle a publicação. Toda alteração é validada no banco."
      />

      <section aria-label="Resumo do catálogo" className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Avaliações" value={dataLoading ? "—" : surveys.length} description="instrumentos sob sua gestão" />
        <StatCard label="Perguntas cadastradas" value={dataLoading ? "—" : totalQuestions} description="somando todas as versões" />
        <StatCard label="Ciclos ativos" value={dataLoading ? "—" : activeCycles} description="abertos ou agendados" />
      </section>

      <section aria-label="Catálogo de avaliações" className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">Catálogo administrativo</h3>
            <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
              {dataLoading
                ? "Carregando as avaliações..."
                : searching
                  ? `${filtered.length} de ${surveys.length} ${surveys.length === 1 ? "avaliação" : "avaliações"} correspondem à busca.`
                  : `${surveys.length} ${surveys.length === 1 ? "avaliação cadastrada" : "avaliações cadastradas"}.`}
            </p>
          </div>
          <div className="w-full max-w-sm">
            <label htmlFor="busca-avaliacoes" className="sr-only">Buscar avaliação por código, nome ou ciclo</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
              <input
                id="busca-avaliacoes"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por código, nome ou ciclo"
                className="min-h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--control-bg)] py-2 pl-10 pr-10 text-sm font-medium text-[var(--text-primary)] shadow-sm outline-none transition placeholder:text-[var(--text-muted)] hover:border-[var(--border-strong)] focus:border-[var(--focus-ring)] focus:ring-4 focus:ring-sky-300/15"
              />
              {searching && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Limpar busca"
                  className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-[var(--text-muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6">
          {dataLoading ? (
            <div className="grid gap-4 xl:grid-cols-2" aria-live="polite" aria-busy="true">
              <span className="sr-only">Carregando o catálogo de avaliações.</span>
              {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-64 rounded-2xl" />)}
            </div>
          ) : filtered.length ? (
            <ul className="grid gap-4 xl:grid-cols-2">
              {filtered.map((survey) => <li key={survey.surveyId}><SurveyCard survey={survey} /></li>)}
            </ul>
          ) : searching ? (
            <EmptyState
              icon={<Search className="h-6 w-6" aria-hidden="true" />}
              title="Nenhum resultado para esta busca"
              description={`Nada corresponde a "${search.trim()}". Verifique o termo ou limpe a busca para ver todas as avaliações.`}
              action={<Button variant="secondary" onClick={() => setSearch("")}><X className="h-4 w-4" aria-hidden="true" />Limpar busca</Button>}
            />
          ) : (
            <EmptyState
              icon={<FileQuestion className="h-6 w-6" aria-hidden="true" />}
              title="Nenhuma avaliação cadastrada"
              description="Crie o primeiro instrumento da plataforma. Ele nasce como rascunho, então você pode montar a estrutura antes de publicar."
              action={<Link href="/admin/pesquisas/nova" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--brand-solid)] px-4 text-sm font-semibold text-[var(--text-on-brand)] shadow-sm transition hover:bg-[var(--brand-solid-hover)]"><FilePlus2 className="h-4 w-4" aria-hidden="true" />Criar avaliação</Link>}
            />
          )}
        </div>
      </section>
    </div>
  </PlatformShell>;
}

function SurveyCard({ survey }: { survey: ManagedSurvey }) {
  const cycleStatus = survey.applicationStatus ?? survey.status;

  return (
    <article className="flex h-full flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-card)] transition hover:border-[var(--border-strong)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{survey.code}</Badge>
            <Badge variant={statusVariant(cycleStatus)} title={`Código interno: ${cycleStatus}`}>{statusLabel(cycleStatus)}</Badge>
          </div>
          <h4 className="mt-3 text-lg font-semibold tracking-tight text-[var(--text-primary)]">{survey.name}</h4>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--text-secondary)]">{survey.description || "Sem descrição cadastrada."}</p>
        </div>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-[var(--brand-primary)]">
          <FileQuestion className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2">
        {[
          ["Versão", survey.versionNumber],
          ["Seções", survey.sections],
          ["Perguntas", survey.questions],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3 text-center">
            <dt className="text-[10px] font-semibold uppercase tracking-[.12em] text-[var(--text-secondary)]">{label}</dt>
            <dd className="mt-1 text-lg font-semibold text-[var(--brand-primary)]">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
          <CalendarDays className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
          {survey.applicationName ?? "Ciclo não configurado"}
        </p>
        <p className="mt-1.5 pl-6 text-xs leading-5 text-[var(--text-secondary)]">
          {survey.opensAt || survey.closesAt
            ? <>Abre {dateLabel(survey.opensAt)} · encerra {dateLabel(survey.closesAt)}</>
            : "Período ainda não definido."}
        </p>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Link
          href={`/admin/pesquisas/${survey.surveyId}`}
          title="Editar seções, perguntas e alternativas"
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
        >
          <FileEdit className="h-4 w-4" aria-hidden="true" />
          Editar formulário
        </Link>
        <button
          type="button"
          onClick={() => copyResponseLink(survey)}
          title="Copiar o link direto para responder esta avaliação"
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
        >
          <Copy className="h-4 w-4" aria-hidden="true" />
          Copiar link
        </button>
        <Link
          href={`/admin/pesquisas/${survey.surveyId}/operacao`}
          title="Publicar a versão, definir o período e abrir ou encerrar o ciclo"
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[var(--brand-solid)] px-4 text-sm font-semibold text-[var(--text-on-brand)] shadow-sm transition hover:bg-[var(--brand-solid-hover)]"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Propriedades
        </Link>
      </div>
    </article>
  );
}
