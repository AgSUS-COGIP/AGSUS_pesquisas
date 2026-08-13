"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Home, Hourglass, Info, Lock, Save, UserRoundCheck } from "lucide-react";
import { useParams } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useConfirm } from "@/components/confirmation-provider";
import { CddiLoadingState } from "@/components/cddi-loading-state";
import { CddiPlatformFrame } from "@/components/cddi-platform-frame";
import { PersonAvatar } from "@/components/person-avatar";
import { Badge } from "@/components/ui/badge";
import { cddiSectionCompletion, isCddiQuestionAnswered } from "@/lib/cddi-form-progress";
import { visibleCddiSections } from "@/lib/cddi-question-applicability";
import { formatDateTimePtBr } from "@/lib/date-format";
import { errorMessageFromUnknown } from "@/lib/observability";
import { ReliableSaveQueue, type SaveQueueSnapshot } from "@/lib/reliable-save-queue";

/**
 * Mesmas duas cores institucionais da autoavaliação (`../../tela-cddi-autoavaliacao.tsx`).
 * O restante da tela usa tokens, para acompanhar o tema claro/escuro.
 */
const CDDI_INK = "var(--cddi-ink)";
const CDDI_RULE = "var(--cddi-rule)";

type Option = { id: string; label: string; value: string; position: number };
type Question = { id: string; title: string; description: string | null; type: string; required: boolean; validation?: Record<string, unknown>; options: Option[] };
type Section = { id: string; code: string; title: string; description: string | null; questions: Question[] };
type FormDefinition = { application: { status: string; opensAt: string | null; closesAt: string | null }; sections: Section[] };
type StoredAnswer = { answerText?: string | null; answerNumber?: number | null; optionId?: string | null; optionValue?: string | null };
type SubmissionContext = { canEdit: boolean; submission: { id: string; status: string; submittedAt: string | null; updatedAt: string; result: number | null } | null; answers: Record<string, StoredAnswer> };
type Member = { personId: string; fullName: string; employeeNumber: string; institutionalEmail: string | null; jobTitle: string | null; unit: string | null; avatarUrl: string | null };
type AnswerValue = { value: string; optionId?: string };
type Answers = Record<string, AnswerValue>;

const dateLabel = (value: string | null | undefined) => formatDateTimePtBr(value, "Não informado");
const answered = isCddiQuestionAnswered;
const completion = cddiSectionCompletion;

export default function LeaderEvaluationPage() {
  const confirm = useConfirm();
  const params = useParams<{ personId: string }>();
  const personId = params.personId;
  const [definition, setDefinition] = useState<FormDefinition | null>(null);
  const [submission, setSubmission] = useState<SubmissionContext | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const timers = useRef<Record<string, number>>({});
  const latestAnswers = useRef<Answers>({});
  const [saveQueue] = useState(() => new ReliableSaveQueue());
  const [saveSnapshot, setSaveSnapshot] = useState<SaveQueueSnapshot>(() => saveQueue.getSnapshot());
  const formTopRef = useRef<HTMLDivElement>(null);

  useEffect(() => saveQueue.subscribe(setSaveSnapshot), [saveQueue]);

  useEffect(() => {
    latestAnswers.current = answers;
  }, [answers]);

  useEffect(() => {
    // Navegar entre /cddi/chefia/X e /cddi/chefia/Y não desmonta o componente
    // (só o parâmetro muda): sem a flag, a resposta atrasada de X sobrescreveria
    // a tela — e o submissionId usado pelo autosave — já exibindo Y.
    let active = true;
    const load = async () => {
      try {
        // A tela Minha equipe informa o ciclo escolhido por query string; sem o
        // parâmetro, permanece o ciclo padrão do CDDI.
        const cycleFromQuery = new URLSearchParams(window.location.search).get("ciclo")?.trim();
        const applicationCode = cycleFromQuery || "CDDI-2026";
        const supabase = createBrowserSupabaseClient();
        const [formResponse, submissionResponse, teamResponse] = await Promise.all([
          supabase.rpc("get_public_survey_form", { target_application_code: applicationCode }),
          supabase.rpc("start_or_resume_my_cddi_submission", { target_application_code: applicationCode, target_submission_type: "CHEFIA", target_subject_person_id: personId }),
          supabase.rpc("fc_obter_minha_equipe", { target_application_code: applicationCode }),
        ]);
        if (formResponse.error) throw formResponse.error;
        if (submissionResponse.error) throw submissionResponse.error;
        if (teamResponse.error) throw teamResponse.error;
        const selected = ((teamResponse.data as { members?: Member[] })?.members ?? []).find((item) => item.personId === personId);
        if (!selected) throw new Error("A pessoa não está vinculada à sua equipe neste ciclo.");
        const context = submissionResponse.data as SubmissionContext;
        const restored: Answers = {};
        Object.entries(context.answers ?? {}).forEach(([questionId, answer]) => {
          const value = answer.answerText ?? answer.optionValue ?? (answer.answerNumber != null ? String(answer.answerNumber) : "");
          if (value !== "") restored[questionId] = { value, optionId: answer.optionId ?? undefined };
        });
        const rawDefinition = formResponse.data as FormDefinition;
        if (!active) return;
        setDefinition({ ...rawDefinition, sections: visibleCddiSections(rawDefinition.sections, "CHEFIA") });
        setSubmission(context);
        setMember(selected);
        latestAnswers.current = restored;
        setAnswers(restored);
      } catch (error) {
        if (!active) return;
        setMessage(errorMessageFromUnknown(error) || "Não foi possível abrir a avaliação.");
      } finally {
        if (active) setLoading(false);
      }
    };
    setLoading(true);
    void load();
    const timersToClear = timers.current;
    return () => {
      active = false;
      Object.values(timersToClear).forEach((timer) => window.clearTimeout(timer));
    };
  }, [personId]);

  const sections = useMemo(() => definition?.sections ?? [], [definition?.sections]);
  const totalSteps = sections.length + 1;
  const currentSection = step < sections.length ? sections[step] : null;
  const requiredQuestions = useMemo(() => sections.flatMap((section) => section.questions).filter((question) => question.required), [sections]);
  const questionsById = useMemo(() => new Map(sections.flatMap((section) => section.questions).map((question) => [question.id, question])), [sections]);
  const progress = requiredQuestions.length ? Math.round(requiredQuestions.filter((question) => answered(question, answers)).length / requiredQuestions.length * 100) : 0;
  const canEdit = Boolean(submission?.canEdit && submission.submission?.status === "DRAFT");
  const saving = saveSnapshot.pending > 0;

  function saveAnswer(question: Question, answer: AnswerValue) {
    if (!canEdit || !submission?.submission?.id) return Promise.resolve();
    const submissionId = submission.submission.id;
    return saveQueue.enqueue(async () => {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.rpc("save_my_cddi_answer", {
        target_submission_id: submissionId,
        target_question_id: question.id,
        target_option_id: question.type === "SCALE" ? answer.optionId ?? null : null,
        target_text: question.type === "SCALE" ? null : answer.value,
      });
      if (error) throw new Error(errorMessageFromUnknown(error));
    }, question.id).catch((error) => {
      setMessage(errorMessageFromUnknown(error) || "Não foi possível salvar a resposta.");
      throw error;
    });
  }
  function updateScale(question: Question, option: Option) {
    const answer = { value: option.value, optionId: option.id };
    latestAnswers.current = { ...latestAnswers.current, [question.id]: answer };
    setAnswers(latestAnswers.current);
    void saveAnswer(question, answer).catch(() => undefined);
  }
  function updateText(question: Question, value: string) {
    const answer = { value };
    latestAnswers.current = { ...latestAnswers.current, [question.id]: answer };
    setAnswers(latestAnswers.current);
    if (timers.current[question.id]) window.clearTimeout(timers.current[question.id]);
    timers.current[question.id] = window.setTimeout(() => {
      delete timers.current[question.id];
      void saveAnswer(question, latestAnswers.current[question.id] ?? answer).catch(() => undefined);
    }, 700);
  }
  async function flushPendingSaves() {
    Object.keys(timers.current).forEach((questionId) => {
      window.clearTimeout(timers.current[questionId]);
      delete timers.current[questionId];
      const question = questionsById.get(questionId);
      const answer = latestAnswers.current[questionId];
      if (question && answer) void saveAnswer(question, answer).catch(() => undefined);
    });
    await saveQueue.flush();
  }
  function goTo(target: number) {
    if (target > step && currentSection && canEdit) {
      const missing = currentSection.questions.filter((question) => question.required && !answered(question, answers));
      if (missing.length) { setMessage(`Preencha ${missing.length} pergunta(s) obrigatória(s) antes de avançar.`); return; }
    }
    setMessage("");
    setStep(Math.max(0, Math.min(target, totalSteps - 1)));
    window.requestAnimationFrame(() => formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
  async function submit() {
    if (!submission?.submission?.id || !canEdit) return;
    if (requiredQuestions.some((question) => !answered(question, answers))) { setMessage("Ainda existem perguntas obrigatórias sem resposta."); return; }
    if (!(await confirm({ title: "Enviar avaliação da chefia?", description: `A avaliação de ${member?.fullName ?? "esta pessoa"} será enviada definitivamente e bloqueada para edição.`, confirmLabel: "Enviar avaliação" }))) return;
    setSubmitting(true);
    try {
      await flushPendingSaves();
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.rpc("submit_my_cddi_submission", { target_submission_id: submission.submission.id });
      if (error) throw new Error(errorMessageFromUnknown(error));
      const result = data as { submittedAt?: string; result?: number } | null;
      setSubmission((current) => current ? { ...current, canEdit: false, submission: current.submission ? { ...current.submission, status: "SUBMITTED", submittedAt: result?.submittedAt ?? new Date().toISOString(), result: result?.result ?? null } : null } : current);
      setMessage("Avaliação da chefia enviada com sucesso.");
    } catch (error) {
      setMessage(errorMessageFromUnknown(error) || "Não foi possível enviar a avaliação.");
    } finally { setSubmitting(false); }
  }

  if (loading) return <CddiPlatformFrame title="Avaliação da chefia"><CddiLoadingState /></CddiPlatformFrame>;
  if (!definition || !member || !submission) return (
    <CddiPlatformFrame title="Avaliação da chefia">
      <div className="grid min-h-[60vh] place-items-center px-6">
        <section className="max-w-xl rounded-2xl border border-[var(--status-danger-border)] bg-[var(--surface-card)] p-8 shadow-[var(--shadow-card)]">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Avaliação indisponível</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{message || "Não foi possível abrir a avaliação desta pessoa."}</p>
          <Link href="/equipe" className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-[var(--brand-solid)] px-5 text-sm font-semibold text-[var(--text-on-brand)] transition hover:bg-[var(--brand-solid-hover)]">Voltar à equipe</Link>
        </section>
      </div>
    </CddiPlatformFrame>
  );

  const missingToSubmit = requiredQuestions.filter((question) => !answered(question, answers)).length;
  const isSubmitted = submission.submission?.status !== "DRAFT";

  return <CddiPlatformFrame title={`Avaliação de ${member.fullName}`}><div className="cddi-form-shell min-h-[60vh] pb-28 text-[var(--text-primary)]">
    <div ref={formTopRef} className="cddi-form-scroll-anchor mx-auto max-w-[960px] space-y-4 px-4 py-5 sm:px-6">
      <header className="rounded-2xl border border-[var(--border-subtle)] border-t-4 bg-[var(--surface-card)] p-5 shadow-[var(--shadow-card)] sm:p-6" style={{ borderTopColor: CDDI_RULE }}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <PersonAvatar fullName={member.fullName} avatarUrl={member.avatarUrl} className="h-16 w-16 rounded-2xl" fallbackClassName="text-xl" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--brand-secondary)]">Avaliação pela chefia</p>
            <h1 className="mt-1 break-words text-2xl font-semibold tracking-tight sm:text-3xl" style={{ color: CDDI_INK }}>{member.fullName}</h1>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">Matrícula {member.employeeNumber} · {member.jobTitle || "Cargo não informado"} · {member.unit || "Unidade não informada"}</p>
          </div>
          <Link href="/equipe" className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Voltar à equipe
          </Link>
        </div>
      </header>

      {!canEdit && (
        <p role="status" className="flex items-start gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 text-sm leading-6 text-[var(--text-secondary)]">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {isSubmitted
              ? <><strong className="font-semibold text-[var(--text-primary)]">Avaliação enviada.</strong> As respostas não podem mais ser alteradas.</>
              : <><strong className="font-semibold text-[var(--text-primary)]">Somente leitura.</strong> O período de preenchimento não está aberto.</>}
          </span>
        </p>
      )}

      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <strong className="text-sm font-semibold" style={{ color: CDDI_INK }}>{currentSection?.title || "Revisão final"}</strong>
          <span className="text-xs font-semibold text-[var(--text-secondary)]">Etapa {step + 1} de {totalSteps} · {progress}% preenchido</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progresso das perguntas obrigatórias"
          className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]"
        >
          <div className="h-full rounded-full bg-[var(--brand-secondary)] transition-all" style={{ width: `${progress}%` }} />
        </div>
        <nav aria-label="Etapas da avaliação" className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {Array.from({ length: totalSteps }).map((_, index) => {
            const complete = index < sections.length && completion(sections[index], answers) === 100;
            const current = index === step;
            return (
              <button
                key={index}
                type="button"
                onClick={() => goTo(index)}
                aria-current={current ? "step" : undefined}
                title={index === totalSteps - 1 ? "Revisão final" : sections[index]?.title}
                className={`inline-flex min-h-9 min-w-9 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-semibold transition ${
                  current
                    ? "bg-[var(--brand-solid)] text-[var(--text-on-brand)]"
                    : complete
                      ? "bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
                      : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                }`}
              >
                {complete && !current && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
                {index === totalSteps - 1 ? "Revisão" : String(index + 1).padStart(2, "0")}
              </button>
            );
          })}
        </nav>
      </section>

      {message && (
        <p role="status" className="flex items-start gap-3 rounded-xl border border-[var(--status-info-border)] bg-[var(--status-info-bg)] p-4 text-sm leading-6 text-[var(--status-info-text)]">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {message}
        </p>
      )}

      {currentSection && (
        <section className="rounded-2xl border border-[var(--border-subtle)] border-t-4 border-t-[var(--brand-secondary)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-card)] sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--brand-secondary)]">Competência {step + 1} de {sections.length}</p>
          <h2 className="mt-1 break-words text-xl font-semibold leading-snug tracking-tight sm:text-2xl" style={{ color: CDDI_INK }}>{currentSection.title}</h2>
          {currentSection.description && <p className="mt-3 whitespace-pre-line break-words rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 text-sm leading-7 text-[var(--text-secondary)]">{currentSection.description}</p>}
          <div className="mt-6 space-y-8">
            {currentSection.questions.map((question) => (
              <fieldset key={question.id} disabled={!canEdit} className="min-w-0">
                <legend className="block w-full whitespace-pre-line break-words text-sm font-semibold leading-relaxed text-[var(--text-primary)]">
                  {question.title}
                  {question.required && <span className="text-red-700" title="Resposta obrigatória"> *</span>}
                </legend>
                {question.description && <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-[var(--text-secondary)]">{question.description}</p>}
                {question.type === "SCALE" ? (
                  <div className="mt-3 grid grid-cols-5 gap-2">
                    {question.options.map((option) => {
                      const selected = answers[question.id]?.optionId === option.id || answers[question.id]?.value === option.value;
                      return (
                        <label
                          key={option.id}
                          title={option.label}
                          className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border py-3 text-center transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-sky-300/25 ${
                            selected
                              ? "border-[var(--brand-solid)] bg-[var(--brand-solid)] text-[var(--text-on-brand)]"
                              : "border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-primary)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
                          }`}
                        >
                          <input type="radio" className="sr-only" name={question.id} checked={selected} onChange={() => updateScale(question, option)} />
                          <span className="text-lg font-semibold">{option.value}</span>
                          <span className={`px-1 text-[10px] leading-3 ${selected ? "text-[var(--text-on-brand)]/80" : "text-[var(--text-muted)]"}`}>{option.label}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <textarea
                    rows={6}
                    value={answers[question.id]?.value ?? ""}
                    onChange={(event) => updateText(question, event.target.value)}
                    placeholder="Digite sua resposta..."
                    className="mt-3 w-full resize-y rounded-xl border border-[var(--border-subtle)] bg-[var(--control-bg)] p-4 text-sm leading-6 text-[var(--text-primary)] shadow-sm outline-none transition placeholder:text-[var(--text-muted)] hover:border-[var(--border-strong)] focus:border-[var(--focus-ring)] focus:ring-4 focus:ring-sky-300/15 disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)]"
                  />
                )}
              </fieldset>
            ))}
          </div>
        </section>
      )}

      {!currentSection && (
        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3">
            <UserRoundCheck className="h-7 w-7 shrink-0 text-[var(--brand-secondary)]" aria-hidden="true" />
            <div>
              <h2 className="text-xl font-semibold tracking-tight" style={{ color: CDDI_INK }}>Revisão da avaliação</h2>
              <p className="text-sm leading-6 text-[var(--text-secondary)]">Confira o preenchimento antes do envio definitivo.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {sections.map((section, index) => (
              <button
                key={section.id}
                type="button"
                onClick={() => goTo(index)}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 text-left transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <strong className="text-sm font-semibold" style={{ color: CDDI_INK }}>{section.title}</strong>
                  <Badge variant={completion(section, answers) === 100 ? "success" : "warning"}>{completion(section, answers)}%</Badge>
                </div>
              </button>
            ))}
          </div>
          {canEdit && <>
            <button
              type="button"
              onClick={submit}
              disabled={submitting || saving || missingToSubmit > 0}
              title={missingToSubmit > 0 ? `Faltam ${missingToSubmit} perguntas obrigatórias` : "Enviar definitivamente"}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--brand-solid)] px-5 text-sm font-semibold text-[var(--text-on-brand)] shadow-sm transition hover:bg-[var(--brand-solid-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <Hourglass className="h-5 w-5 animate-pulse" aria-hidden="true" /> : <CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
              {submitting ? "Enviando..." : "Confirmar e enviar avaliação da chefia"}
            </button>
            {missingToSubmit > 0 && (
              <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                Faltam {missingToSubmit} {missingToSubmit === 1 ? "pergunta obrigatória" : "perguntas obrigatórias"} para liberar o envio.
              </p>
            )}
          </>}
          {isSubmitted && (
            <p className="mt-5 flex items-center gap-2 rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] p-4 text-sm font-semibold text-[var(--status-success-text)]">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              Avaliação enviada em {dateLabel(submission.submission?.submittedAt)}.
            </p>
          )}
        </section>
      )}
    </div>

    <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-4 py-3 shadow-[0_-10px_30px_rgba(15,23,42,.12)] backdrop-blur">
      <div className="mx-auto flex max-w-[960px] items-center justify-between gap-3">
        <p role="status" className="hidden items-center gap-2 text-sm text-[var(--text-secondary)] sm:flex">
          {saving
            ? <><Hourglass className="h-4 w-4 animate-pulse" aria-hidden="true" />Salvando rascunho...</>
            : <><Save className="h-4 w-4" aria-hidden="true" />{canEdit ? "Salvamento automático ativo" : "Somente leitura"}</>}
        </p>
        <div className="ml-auto flex gap-2">
          <Link href="/equipe" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]">
            <Home className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Equipe</span>
          </Link>
          <button
            type="button"
            onClick={() => goTo(step - 1)}
            disabled={step === 0}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Anterior
          </button>
          <button
            type="button"
            onClick={() => goTo(step + 1)}
            disabled={step === totalSteps - 1}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--brand-solid)] px-4 text-sm font-semibold text-[var(--text-on-brand)] transition hover:bg-[var(--brand-solid-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Próxima
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </footer>
  </div></CddiPlatformFrame>;
}
