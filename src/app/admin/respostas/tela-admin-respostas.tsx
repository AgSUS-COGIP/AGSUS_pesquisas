"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, EyeOff, Hourglass, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { PlatformShell } from "@/components/platform-shell";
import { PlatformGuardState } from "@/components/platform-guard-state";
import { useConfirm } from "@/components/confirmation-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Surface } from "@/components/ui/surface";
import { usePlatformGuard } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { errorMessageFromUnknown } from "@/lib/observability";

type Cycle = { applicationId: string; code: string; name: string; status: string; participants: number };
type Submission = {
  submissionId: string; personId: string | null; fullName: string | null;
  employeeNumber: string | null; institutionalEmail: string | null;
  submissionType: string; status: string; submittedAt: string | null;
  answers: number; subjectName: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  SUBMITTED: "Enviada",
  VALIDATED: "Validada",
  INVALIDATED: "Anulada",
  CANCELLED: "Cancelada",
};

function dateLabel(value: string | null) {
  if (!value) return "não enviada";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

export default function AdminRespostasPage() {
  // Sem módulo próprio no mapa de perfis: `ADMIN_TEAMS` é exclusivo do
  // Superadmin, e a RPC revalida com `is_platform_administrator()`. A guarda de
  // tela é usabilidade; a autorização real está no banco.
  const guard = usePlatformGuard(PLATFORM_MODULE.ADMIN_TEAMS);
  const confirm = useConfirm();
  const granted = guard.state === "granted";

  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cycleCode, setCycleCode] = useState("");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!granted) return;
    let active = true;
    void (async () => {
      try {
        const supabase = createBrowserSupabaseClient();
        // Sem lista de pesquisas própria: os ciclos vêm do catálogo administrativo,
        // e o seletor começa no mais recente.
        const { data, error } = await supabase.rpc("list_managed_surveys");
        if (error) throw error;
        const surveys = (Array.isArray(data) ? data : []) as Array<{ code: string }>;
        const found: Cycle[] = [];
        for (const survey of surveys) {
          // O `error` desta chamada era descartado. Quando a RPC não existia no
          // ambiente, a falha sumia e a tela dizia "Nenhum ciclo disponível" —
          // apresentando indisponibilidade como ausência de dados, que é o tipo
          // de mentira que faz procurar o defeito no lugar errado.
          const { data: cycleData, error: cycleError } = await supabase.rpc(
            "fc_listar_ciclos_pesquisa",
            { p_codigo_pesquisa: survey.code },
          );
          if (cycleError) throw cycleError;
          if (Array.isArray(cycleData)) found.push(...(cycleData as Cycle[]));
        }
        if (!active) return;
        setCycles(found);
        setCycleCode((current) => current || found[0]?.code || "");
      } catch (loadError) {
        if (active) toast.error(errorMessageFromUnknown(loadError));
      }
    })();
    return () => { active = false; };
  }, [granted]);

  async function loadSubmissions(code: string) {
    if (!code) return;
    setLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.rpc("fc_listar_respostas_ciclo", {
        p_codigo_ciclo: code, p_busca: null, p_limite: 500,
      });
      if (error) throw error;
      setSubmissions((Array.isArray(data) ? data : []) as Submission[]);
    } catch (loadError) {
      toast.error(errorMessageFromUnknown(loadError));
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (granted && cycleCode) void loadSubmissions(cycleCode);
  }, [granted, cycleCode]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return submissions;
    return submissions.filter((item) =>
      `${item.fullName ?? ""} ${item.employeeNumber ?? ""} ${item.institutionalEmail ?? ""}`.toLowerCase().includes(term),
    );
  }, [search, submissions]);

  /**
   * Remove a resposta no modo escolhido.
   *
   * A confirmação é diferente para cada modo porque as consequências são
   * diferentes: anular é reversível na prática (a pessoa responde de novo e o
   * registro anterior continua auditável), apagar não é. O motivo é digitado
   * dentro do próprio diálogo e vai para a auditoria — uma decisão só, em vez
   * de confirmar primeiro e descobrir depois que o motivo era obrigatório.
   */
  async function removeSubmission(submission: Submission, mode: "INVALIDATE" | "DELETE") {
    const anular = mode === "INVALIDATE";
    const reason = await confirm({
      title: anular
        ? `Anular a resposta de ${submission.fullName ?? "participante"}?`
        : `Apagar definitivamente a resposta de ${submission.fullName ?? "participante"}?`,
      description: anular
        ? "A resposta sai dos painéis e do cálculo, e a pessoa volta a constar como pendente. O conteúdo e o histórico permanecem registrados para auditoria."
        : `As ${submission.answers} resposta(s) serão removidas da base e não há como recuperar. Só o registro da operação permanece na auditoria. Prefira anular, salvo se o conteúdo não puder permanecer gravado.`,
      confirmLabel: anular ? "Anular resposta" : "Apagar definitivamente",
      tone: anular ? undefined : "danger",
      prompt: {
        label: "Motivo da operação",
        hint: "Fica registrado na auditoria, junto de quem executou e quando.",
        placeholder: anular
          ? "Ex.: respondeu no lugar de outra pessoa, a pedido da chefia da unidade."
          : "Ex.: o conteúdo trazia dado pessoal de terceiro e não pode permanecer gravado.",
        // O mesmo mínimo que `fc_remover_resposta_pessoa` exige. Validar aqui
        // evita confirmar o irreversível e só então descobrir que faltou motivo.
        minLength: 10,
      },
    });
    if (!reason) return;

    setBusyId(submission.submissionId);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.rpc("fc_remover_resposta_pessoa", {
        p_submissao: submission.submissionId,
        p_modo: mode,
        p_motivo: reason,
      });
      if (error) throw error;
      toast.success(anular ? "Resposta anulada e registrada na auditoria." : "Resposta apagada. A operação ficou registrada na auditoria.");
      await loadSubmissions(cycleCode);
    } catch (removeError) {
      toast.error(errorMessageFromUnknown(removeError));
    } finally {
      setBusyId(null);
    }
  }

  if (guard.state !== "granted") {
    return <PlatformGuardState
      guard={guard}
      title="respostas"
      restrictedTitle="Remoção de respostas restrita"
      restrictedDescription="Apagar ou anular a resposta de outra pessoa é administração global, disponível apenas para o Superadmin."
    />;
  }

  return (
    <PlatformShell user={guard.user} eyebrow="Administração" title="Respostas">
      <div className="mx-auto w-full max-w-[1400px] space-y-5">
        <PageHeader
          eyebrow="Administração global"
          title="Anular ou apagar resposta de participante"
          description="Use quando alguém respondeu por engano, no lugar de outra pessoa, ou quando o conteúdo não pode permanecer gravado. Toda operação exige motivo e fica registrada na auditoria."
        />

        <Surface className="p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">Ciclo</span>
              <select
                value={cycleCode}
                onChange={(event) => setCycleCode(event.target.value)}
                className="h-11 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--control-bg)] px-3 text-sm text-[var(--text-primary)]"
              >
                {cycles.length ? cycles.map((cycle) => (
                  <option key={cycle.code} value={cycle.code}>{cycle.name} ({cycle.code})</option>
                )) : <option value="">Nenhum ciclo disponível</option>}
              </select>
            </label>
            <label>
              <span className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">Buscar pessoa</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nome, matrícula ou e-mail"
                  className="search-sem-limpar-nativo h-11 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--control-bg)] pl-10 pr-10 text-sm text-[var(--text-primary)]"
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Limpar busca"
                    className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </label>
          </div>

          <p className="mt-4 flex items-start gap-2 rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-3 text-xs leading-5 text-[var(--status-warning-text)]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              <strong className="font-semibold">Anular</strong> tira a resposta dos painéis e do cálculo, mantendo o registro — é o caminho normal.{" "}
              <strong className="font-semibold">Apagar</strong> remove o conteúdo da base e não tem volta; reserve para dado que não podia ter sido gravado.
            </span>
          </p>
        </Surface>

        <Surface className="p-5 sm:p-6">
          <h3 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
            {loading ? "Carregando respostas..." : `${filtered.length} ${filtered.length === 1 ? "resposta" : "respostas"} no ciclo`}
          </h3>

          <div className="mt-4">
            {loading ? (
              <div className="space-y-3" aria-busy="true">
                {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-xl" />)}
              </div>
            ) : filtered.length ? (
              <ul className="divide-y divide-[var(--border-subtle)]">
                {filtered.map((item) => {
                  const anulada = item.status === "INVALIDATED";
                  const busy = busyId === item.submissionId;
                  return (
                    <li key={item.submissionId} className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-sm font-semibold text-[var(--text-primary)]">{item.fullName ?? "Pessoa não identificada"}</strong>
                          <Badge variant={anulada ? "neutral" : item.status === "DRAFT" ? "warning" : "success"} title={`Código interno: ${item.status}`}>
                            {STATUS_LABELS[item.status] ?? item.status}
                          </Badge>
                          {item.submissionType !== "STANDARD" ? <Badge variant="outline">{item.submissionType}</Badge> : null}
                        </div>
                        <p className="mt-1 text-xs text-[var(--text-secondary)]">
                          {item.employeeNumber ? `Matrícula ${item.employeeNumber}` : "sem matrícula"}
                          {item.subjectName ? ` · avaliando ${item.subjectName}` : ""}
                          {" · "}{item.answers} {item.answers === 1 ? "resposta" : "respostas"}
                          {" · "}enviada em {dateLabel(item.submittedAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => void removeSubmission(item, "INVALIDATE")}
                          disabled={busy || anulada}
                          title={anulada ? "Esta resposta já está anulada" : "Tirar dos painéis e do cálculo, preservando o registro"}
                        >
                          {busy ? <Hourglass className="h-4 w-4 animate-pulse" aria-hidden="true" /> : <EyeOff className="h-4 w-4" aria-hidden="true" />}
                          Anular
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => void removeSubmission(item, "DELETE")}
                          disabled={busy}
                          title="Remover o conteúdo da base — não há como recuperar"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                          Apagar
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                title={search ? "Nenhuma resposta corresponde à busca" : "Nenhuma resposta neste ciclo"}
                description={search ? "Ajuste o termo buscado ou limpe a busca." : "Assim que alguém responder, a resposta aparece aqui."}
                action={search ? <Button variant="secondary" onClick={() => setSearch("")}>Limpar busca</Button> : undefined}
              />
            )}
          </div>
        </Surface>
      </div>
    </PlatformShell>
  );
}
