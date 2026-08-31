"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, ArchiveRestore, CalendarDays, CopyPlus, Eye, FileEdit, FilePlus2, FileQuestion, Hourglass, Search, Share2, SlidersHorizontal, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/confirmation-provider";
import { errorMessageFromUnknown } from "@/lib/observability";
import { toast } from "sonner";
import { PlatformShell } from "@/components/platform-shell";
import { PlatformGuardState } from "@/components/platform-guard-state";
import { ActionMenu } from "@/components/ui/action-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, StatCard } from "@/components/ui/surface";
import { usePlatformGuard } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";
import { duplicarAvaliacao, excluirAvaliacaoArquivada, listarAvaliacoes, ErroDeApi } from "@/lib/api/cliente";
import { executarAcaoDoCiclo } from "@/lib/api/cliente-construtor";
import { listarModelosDeAvaliacao } from "@/lib/api/cliente-paineis";
import type { AvaliacaoGerenciada } from "@/lib/api/contratos";

/** Modelo da galeria, devolvido por `fc_listar_modelos_avaliacao`. */
type SurveyTemplate = {
  surveyId: string; code: string; name: string; description: string | null;
  category: string; sections: number; questions: number;
};

type ManagedSurvey = AvaliacaoGerenciada;

const ARCHIVE_RETENTION_DAYS = 30;

/** Dias restantes até a exclusão automática, nunca negativo — o banco também protege quem já venceu. */
function daysUntilExpiration(archivedAt: string) {
  const elapsedMs = Date.now() - new Date(archivedAt).getTime();
  const elapsedDays = Math.floor(elapsedMs / 86_400_000);
  return Math.max(0, ARCHIVE_RETENTION_DAYS - elapsedDays);
}

/**
 * Copia o link direto de resposta da avaliação.
 *
 * Ciclos anônimos abrem numa jornada pública; os demais exigem login.
 */
function copyResponseLink(survey: ManagedSurvey) {
  if (!survey.applicationCode) {
    toast.error("Este instrumento ainda não tem ciclo configurado.");
    return;
  }
  const path = survey.code === "CDDI" ? "/cddi" : survey.anonymous ? `/responder/${encodeURIComponent(survey.applicationCode)}` : `/pesquisas/${encodeURIComponent(survey.applicationCode)}`;
  const url = `${window.location.origin}${path}`;
  if (!navigator.clipboard) {
    toast.error(`Copie o link manualmente: ${url}`);
    return;
  }
  void navigator.clipboard.writeText(url).then(
    () => toast.success(survey.anonymous ? "Link anônimo copiado. O formulário abre sem login." : "Link de resposta copiado. Quem abrir entra pelo login institucional."),
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
  const confirm = useConfirm();
  const router = useRouter();
  const [surveys, setSurveys] = useState<ManagedSurvey[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [archiveActionId, setArchiveActionId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showingArchived, setShowingArchived] = useState(false);
  const [templates, setTemplates] = useState<SurveyTemplate[]>([]);
  const granted = guard.state === "granted";

  /** Carrega o catálogo na visão pedida — vigentes ou arquivadas. */
  const loadSurveys = useCallback(async (archivedView: boolean) => {
    setDataLoading(true);
    try {
      setSurveys(await listarAvaliacoes({ arquivadas: archivedView }));
    } catch (loadError) {
      // 501 é a migration de arquivamento não aplicada neste ambiente: a tela
      // diz o que falta e volta para a visão que funciona, em vez de deixar o
      // operador diante de um catálogo vazio sem explicação.
      if (loadError instanceof ErroDeApi && loadError.indisponivelNoAmbiente && archivedView) {
        toast.error("As avaliações arquivadas ainda não estão disponíveis neste ambiente: a migration de arquivamento não foi aplicada ao banco.");
        setShowingArchived(false);
        return;
      }
      if (archivedView) setShowingArchived(false);
      toast.error(errorMessageFromUnknown(loadError));
    } finally { setDataLoading(false); }
  }, []);

  /**
   * Duplica o instrumento e leva direto para o construtor da cópia.
   *
   * A confirmação diz o que **não** é copiado, porque é a parte contraintuitiva:
   * quem duplica uma avaliação com ciclo aberto tende a esperar o ciclo junto.
   * Copiar o período e o público criaria um segundo ciclo ativo sem ninguém ter
   * pedido — a cópia nasce em rascunho, para ser configurada de propósito.
   */
  async function cloneSurvey(survey: ManagedSurvey) {
    const confirmed = await confirm({
      title: `Duplicar "${survey.name}"?`,
      description: "A cópia leva seções, perguntas, alternativas e regras condicionais, e nasce como rascunho. Ciclo, participantes e respostas não são copiados.",
      confirmLabel: "Duplicar avaliação",
    });
    if (!confirmed) return;
    await runClone(survey.surveyId, null);
  }

  /**
   * Usar um modelo **é** duplicar — mesma RPC, mesmo remapeamento de regras.
   *
   * A galeria não ganhou mecanismo de cópia próprio de propósito: um segundo
   * caminho para a mesma operação divergiria do primeiro na primeira correção.
   * O clone nasce fora da galeria, porque `st_modelo` não é copiado.
   */
  async function startFromTemplate(template: SurveyTemplate) {
    const confirmed = await confirm({
      title: `Criar avaliação a partir de "${template.name}"?`,
      description: `Uma avaliação nova nasce em rascunho com as ${template.questions} perguntas do modelo, pronta para você ajustar o texto e configurar o ciclo. O modelo continua intacto na galeria.`,
      confirmLabel: "Usar este modelo",
    });
    if (!confirmed) return;
    await runClone(template.surveyId, template.name.replace(/^Modelo\s*[—-]\s*/i, ""));
  }

  async function runClone(surveyId: string, name: string | null) {
    setCloningId(surveyId);
    try {
      const result = await duplicarAvaliacao(surveyId, { name }) as
        { surveyId: string; code: string; questions: number } | null;
      if (!result?.surveyId) throw new Error("A cópia não foi criada.");
      toast.success(`Criada como ${result.code}, com ${result.questions} ${result.questions === 1 ? "pergunta" : "perguntas"}.`);
      router.push(`/admin/pesquisas/${result.surveyId}`);
    } catch (cloneError) {
      toast.error(errorMessageFromUnknown(cloneError));
      setCloningId(null);
    }
  }

  /**
   * Arquiva ou desarquiva uma avaliação. Arquivar é irreversível na prática
   * (a avaliação expira em até 30 dias se ninguém agir), então pede
   * confirmação como as demais ações destrutivas da tela; desarquivar é
   * inofensivo — só devolve a avaliação ao catálogo padrão — e não pede.
   */
  async function toggleArchive(survey: ManagedSurvey) {
    const archiving = !survey.archivedAt;
    if (archiving) {
      const confirmed = await confirm({
        title: `Arquivar "${survey.name}"?`,
        description: `A avaliação sai do catálogo padrão e fica disponível por ${ARCHIVE_RETENTION_DAYS} dias em "Avaliações arquivadas". Depois desse prazo, se ninguém desarquivar, ela é excluída automaticamente.`,
        confirmLabel: "Arquivar avaliação",
        tone: "danger",
      });
      if (!confirmed) return;
    }

    setArchiveActionId(survey.surveyId);
    try {
      await executarAcaoDoCiclo(survey.surveyId, {
        action: archiving ? "ARCHIVE" : "UNARCHIVE",
      });
      toast.success(archiving ? "Avaliação arquivada." : "Avaliação restaurada para o catálogo.");
      await loadSurveys(showingArchived);
    } catch (actionError) {
      toast.error(errorMessageFromUnknown(actionError));
    } finally {
      setArchiveActionId(null);
    }
  }

  async function deleteArchivedSurvey(survey: ManagedSurvey) {
    const confirmed = await confirm({
      title: `Apagar definitivamente "${survey.name}"?`,
      description: "Esta ação não pode ser desfeita. O ciclo, as respostas e todos os dados associados a esta avaliação serão removidos.",
      confirmLabel: "Apagar definitivamente",
      tone: "danger",
    });
    if (!confirmed) return;

    setDeletingId(survey.surveyId);
    try {
      await excluirAvaliacaoArquivada(survey.surveyId);
      toast.success("Avaliação apagada definitivamente.");
      await loadSurveys(true);
    } catch (deleteError) {
      toast.error(errorMessageFromUnknown(deleteError));
    } finally {
      setDeletingId(null);
    }
  }

  // Só consulta depois que a guarda liberou: sem módulo, a RPC seria negada
  // pela RLS e o erro apareceria como toast numa tela que nem chega a abrir.
  useEffect(() => {
    if (!granted) return;
    void loadSurveys(showingArchived);
  }, [granted, showingArchived, loadSurveys]);

  // A galeria de modelos é acessório e **independe da visão escolhida**: fica
  // num efeito próprio, carregado uma vez quando a guarda libera, em vez de ser
  // rebuscada a cada alternância entre ativas e arquivadas.
  //
  // Falha dela não derruba o catálogo: num ambiente sem a migration de modelos
  // a RPC não existe (404), e a galeria apenas não aparece.
  useEffect(() => {
    if (!granted) return;
    let active = true;
    void (async () => {
      try {
        const modelos = await listarModelosDeAvaliacao();
        if (active) setTemplates(modelos as SurveyTemplate[]);
      } catch (templateError) {
        if (active) console.warn("Galeria de modelos indisponível:", errorMessageFromUnknown(templateError));
      }
    })();
    return () => { active = false; };
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
          à direita, antes do cabeçalho da tela. Ao lado, a alternância para a
          lista de arquivadas — não é ação de criação, mas também não pertence
          à casca, então divide a mesma nav. */}
      <nav aria-label="Ações do catálogo" className="flex flex-wrap justify-end gap-2">
        <Button
          variant="secondary"
          onClick={() => setShowingArchived((value) => !value)}
          title={showingArchived ? "Voltar para as avaliações ativas" : "Ver avaliações arquivadas nos últimos 30 dias"}
        >
          {showingArchived ? <ArchiveRestore className="h-4 w-4" aria-hidden="true" /> : <Archive className="h-4 w-4" aria-hidden="true" />}
          {showingArchived ? "Ver avaliações ativas" : "Avaliações arquivadas"}
        </Button>
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
        eyebrow={showingArchived ? "Retenção temporária" : "Estúdio e operação"}
        title={showingArchived ? "Avaliações arquivadas" : "Da construção à abertura do ciclo"}
        description={showingArchived
          ? `Avaliações finalizadas ficam aqui por ${ARCHIVE_RETENTION_DAYS} dias. Desarquive para devolver ao catálogo, ou aguarde o prazo — a exclusão automática preserva quem já tem respostas registradas.`
          : "Edite o instrumento, verifique a prontidão, configure o período e controle a publicação. Toda alteração é validada no banco."}
      />

      {!showingArchived && (
        <section aria-label="Resumo do catálogo" className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Avaliações" value={dataLoading ? "—" : surveys.length} description="instrumentos sob sua gestão" />
          <StatCard label="Perguntas cadastradas" value={dataLoading ? "—" : totalQuestions} description="somando todas as versões" />
          <StatCard label="Ciclos ativos" value={dataLoading ? "—" : activeCycles} description="abertos ou agendados" />
        </section>
      )}

      {/*
        Galeria antes do catálogo: quem chega para criar uma avaliação decide
        primeiro se parte de um modelo ou do zero. Depois do catálogo, ela
        chegaria tarde demais para essa escolha.
      */}
      {templates.length > 0 && (
        <section aria-label="Modelos de avaliação" className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--shadow-card)]">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--brand-secondary)]">Comece a partir de um modelo</p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight text-[var(--text-primary)]">Galeria de modelos</h3>
              <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                Instrumentos prontos para adaptar. Usar um modelo cria uma avaliação nova em rascunho — o modelo continua intacto.
              </p>
            </div>
          </div>

          <ul className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {templates.map((template) => (
              <li key={template.surveyId}>
                <article className="flex h-full flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4">
                  <Badge variant="info" className="w-fit">{template.category}</Badge>
                  <strong className="mt-3 block text-base font-semibold leading-snug text-[var(--text-primary)]">{template.name}</strong>
                  <p className="mt-2 line-clamp-3 flex-1 text-sm leading-6 text-[var(--text-secondary)]">{template.description}</p>
                  <p className="mt-3 text-xs text-[var(--text-muted)]">
                    {template.sections} {template.sections === 1 ? "seção" : "seções"} · {template.questions} {template.questions === 1 ? "pergunta" : "perguntas"}
                  </p>
                  <Button
                    variant="secondary"
                    className="mt-3 w-full justify-center"
                    onClick={() => void startFromTemplate(template)}
                    disabled={cloningId === template.surveyId}
                  >
                    {cloningId === template.surveyId
                      ? <><Hourglass className="h-4 w-4 animate-pulse" aria-hidden="true" />Criando...</>
                      : <><CopyPlus className="h-4 w-4" aria-hidden="true" />Usar este modelo</>}
                  </Button>
                </article>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Catálogo de avaliações" className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">{showingArchived ? "Arquivadas" : "Catálogo administrativo"}</h3>
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
                className="search-sem-limpar-nativo min-h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--control-bg)] py-2 pl-10 pr-10 text-sm font-medium text-[var(--text-primary)] shadow-sm outline-none transition placeholder:text-[var(--text-muted)] hover:border-[var(--border-strong)] focus:border-[var(--focus-ring)] focus:ring-4 focus:ring-sky-300/15"
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
              {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-64 rounded-xl" />)}
            </div>
          ) : filtered.length ? (
            <ul className="grid gap-4 xl:grid-cols-2">
              {filtered.map((survey) => (
                <li key={survey.surveyId}>
                  <SurveyCard
                    survey={survey}
                    onClone={cloneSurvey}
                    cloning={cloningId === survey.surveyId}
                    onToggleArchive={toggleArchive}
                    archiving={archiveActionId === survey.surveyId}
                    onDeleteArchived={deleteArchivedSurvey}
                    deleting={deletingId === survey.surveyId}
                  />
                </li>
              ))}
            </ul>
          ) : searching ? (
            <EmptyState
              icon={<Search className="h-6 w-6" aria-hidden="true" />}
              title="Nenhum resultado para esta busca"
              description={`Nada corresponde a "${search.trim()}". Verifique o termo ou limpe a busca para ver todas as avaliações.`}
              action={<Button variant="secondary" onClick={() => setSearch("")}><X className="h-4 w-4" aria-hidden="true" />Limpar busca</Button>}
            />
          ) : showingArchived ? (
            <EmptyState
              icon={<Archive className="h-6 w-6" aria-hidden="true" />}
              title="Nenhuma avaliação arquivada"
              description="Avaliações finalizadas aparecem aqui por até 30 dias antes da exclusão automática."
              action={<Button variant="secondary" onClick={() => setShowingArchived(false)}><ArchiveRestore className="h-4 w-4" aria-hidden="true" />Ver avaliações ativas</Button>}
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

function SurveyCard({ survey, onClone, cloning, onToggleArchive, archiving, onDeleteArchived, deleting }: {
  survey: ManagedSurvey;
  onClone: (survey: ManagedSurvey) => void;
  cloning: boolean;
  onToggleArchive: (survey: ManagedSurvey) => void;
  archiving: boolean;
  onDeleteArchived: (survey: ManagedSurvey) => void;
  deleting: boolean;
}) {
  const cycleStatus = survey.applicationStatus ?? survey.status;
  // Mesma regra do construtor (`version.status === "DRAFT"`), lida do campo que
  // `list_managed_surveys` já devolve. Sem duplicar critério nem inventar outro.
  const versionIsDraft = survey.versionStatus === "DRAFT";
  const archived = Boolean(survey.archivedAt);
  const busy = cloning || archiving || deleting;

  return (
    <article className={`flex h-full flex-col rounded-xl border p-5 transition ${archived ? "border-dashed border-[var(--border-subtle)] bg-[var(--surface-muted)]" : "border-[var(--border-subtle)] bg-[var(--surface-card)] hover:border-[var(--border-strong)]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{survey.code}</Badge>
            <Badge variant={statusVariant(cycleStatus)} title={`Código interno: ${cycleStatus}`}>{statusLabel(cycleStatus)}</Badge>
            {archived && survey.archivedAt && (
              <Badge variant="warning" title={`Arquivada em ${dateLabel(survey.archivedAt)}`}>
                <Archive className="h-3 w-3" aria-hidden="true" />
                Expira em {daysUntilExpiration(survey.archivedAt)} {daysUntilExpiration(survey.archivedAt) === 1 ? "dia" : "dias"}
              </Badge>
            )}
          </div>
          <h4 className="mt-3 break-words text-lg font-semibold tracking-tight text-[var(--text-primary)]">{survey.name}</h4>
          <p className="mt-2 line-clamp-2 break-words text-sm leading-6 text-[var(--text-secondary)]">{survey.description || "Sem descrição cadastrada."}</p>
        </div>
        <ActionMenu
          label="Mais ações desta avaliação"
          items={[
            {
              key: "archive",
              label: archived ? "Desarquivar" : "Arquivar",
              icon: archived ? ArchiveRestore : Archive,
              onSelect: () => onToggleArchive(survey),
              disabled: busy,
              title: archived
                ? "Devolve a avaliação ao catálogo padrão"
                : `Move para "Avaliações arquivadas" por até ${ARCHIVE_RETENTION_DAYS} dias`,
            },
            {
              key: "share",
              label: "Compartilhar",
              icon: Share2,
              onSelect: () => copyResponseLink(survey),
              disabled: busy,
              title: "Copiar o link direto para responder esta avaliação",
            },
            {
              key: "clone",
              label: "Duplicar",
              icon: CopyPlus,
              onSelect: () => onClone(survey),
              disabled: busy,
              title: "Criar um rascunho novo com a mesma estrutura — sem ciclo, participantes ou respostas",
            },
            ...(archived ? [{
              key: "delete-permanently",
              label: "Apagar definitivamente",
              icon: Trash2,
              onSelect: () => onDeleteArchived(survey),
              disabled: busy,
              tone: "danger" as const,
              title: "Remove a avaliação arquivada de forma irreversível",
            }] : []),
          ]}
        />
      </div>

      {/*
        Três números numa linha de texto, no lugar de três caixas.

        Cada cartão trazia `VERSÃO`, `SEÇÕES` e `PERGUNTAS` em quadros próprios,
        com rótulo em maiúsculas espaçadas e o valor em destaque. Numa lista de
        cinco avaliações, isso são quinze caixas competindo pela atenção para
        dizer números que ninguém compara entre cartões — quem olha o catálogo
        procura *qual* avaliação abrir, não quantas seções ela tem.

        Como frase, os mesmos números ocupam uma linha e continuam legíveis.
        Sobra espaço para o ciclo e o período, que é o que decide a escolha.
      */}
      <p className="mt-3 text-sm text-[var(--text-secondary)]">
        Versão {survey.versionNumber} · {survey.sections} {survey.sections === 1 ? "seção" : "seções"} · {survey.questions} {survey.questions === 1 ? "pergunta" : "perguntas"}
      </p>

      {/*
        O ciclo perdeu a caixa cinza e ganhou uma borda superior. A informação é
        a mesma; o que sai é uma superfície dentro de outra superfície — o padrão
        que fazia o cartão parecer um painel em vez de um item de lista.
      */}
      <div className="mt-3 flex-1 border-t border-[var(--border-subtle)] pt-3">
        <p className="flex min-w-0 items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
          <CalendarDays className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
          <span className="min-w-0 truncate">{survey.applicationName ?? "Ciclo não configurado"}</span>
        </p>
        <p className="mt-1 pl-6 text-xs leading-5 text-[var(--text-secondary)]">
          {survey.opensAt || survey.closesAt
            ? <>Abre {dateLabel(survey.opensAt)} · encerra {dateLabel(survey.closesAt)}</>
            : "Período ainda não definido."}
        </p>
      </div>

      {(archiving || deleting) && (
        <p role="status" className="mt-4 flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
          <Hourglass className="h-3.5 w-3.5 animate-pulse" aria-hidden="true" />
          {deleting ? "Apagando definitivamente..." : archived ? "Restaurando..." : "Arquivando..."}
        </p>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {/*
          O construtor só edita enquanto a versão está em rascunho — é o que ele
          próprio decide, por `version.status === "DRAFT"`. Com a versão
          publicada, "Editar formulário" prometia o que a tela seguinte não
          entrega: quem clicava chegava ao construtor protegido, sem ação útil.

          O destino continua existindo, porque consultar o instrumento publicado
          é legítimo. O que muda é o que o botão diz. A ação principal do cartão
          já é "Propriedades", que leva à operação do ciclo — onde de fato há o
          que fazer depois de publicado.
        */}
        <Link
          href={`/admin/pesquisas/${survey.surveyId}`}
          title={versionIsDraft
            ? "Editar seções, perguntas e alternativas"
            : "Consultar o instrumento publicado. A versão está protegida e não aceita edição."}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
        >
          {versionIsDraft
            ? <><FileEdit className="h-4 w-4" aria-hidden="true" />Editar formulário</>
            : <><Eye className="h-4 w-4" aria-hidden="true" />Ver instrumento</>}
        </Link>
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
