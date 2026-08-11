"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, BadgeCheck, CheckCircle2, Home, Hourglass, Info, Lock, Save, UserRound, UsersRound } from "lucide-react";
import { CddiLoadingState } from "@/components/cddi-loading-state";
import { CddiPlatformFrame } from "@/components/cddi-platform-frame";
import { PersonAvatar } from "@/components/person-avatar";
import { useConfirm } from "@/components/confirmation-provider";
import { Badge } from "@/components/ui/badge";
import { visibleCddiSections } from "@/lib/cddi-question-applicability";
import { errorMessageFromUnknown } from "@/lib/observability";
import { ReliableSaveQueue, type SaveQueueSnapshot } from "@/lib/reliable-save-queue";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { resolveSurveyVisualIdentity } from "@/lib/survey-visual-identity";

type Option = { id: string; code: string; label: string; value: string; score: number | null; position: number };
type Question = { id: string; code: string; title: string; description: string | null; type: string; required: boolean; position: number; validation?: Record<string, unknown>; settings: Record<string, unknown>; options: Option[] };
type Section = { id: string; code: string; title: string; description: string | null; position: number; questions: Question[] };
type FormDefinition = { application: { id: string; code: string; name: string; status: string; opensAt: string | null; closesAt: string | null; settings?: unknown }; survey: { name: string; description: string | null }; sections: Section[] };
type StoredAnswer = { answerText?: string | null; answerNumber?: number | null; optionId?: string | null; optionValue?: string | null };
type SubmissionContext = { status: string; canEdit: boolean; submission: { id: string; status: string; startedAt: string; submittedAt: string | null; updatedAt: string; result: number | null; type: string } | null; answers: Record<string, StoredAnswer> };
type PersonIdentity = { id: string; employeeNumber: string; fullName: string; institutionalEmail: string | null; jobTitle: string | null; directorate: string | null; unit: string | null; coordination: string | null; metadata: Record<string, unknown> };
type Leader = { personId: string; fullName: string; institutionalEmail: string | null; employeeNumber: string; jobTitle: string | null; unit: string | null; coordination: string | null };
type IdentityContext = { person: PersonIdentity; leader: Leader | null; canChangeLeader: boolean };
type AnswerValue = { value: string; optionId?: string };
type Answers = Record<string, AnswerValue>;
type Screen = "home" | "auto";

/**
 * O CDDI tem identidade visual própria (azul institucional do instrumento),
 * independente do tema da plataforma. Só estas duas cores são fixas; todo o
 * resto usa tokens, para a jornada acompanhar o tema claro/escuro.
 */
const CDDI_INK = "#26368d";
const CDDI_RULE = "#2d3f97";

function dateLabel(value: string | null | undefined) {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}
function answered(question: Question, answers: Answers) { return Boolean(answers[question.id]?.value?.trim()); }
/** Percentual das perguntas obrigatórias da competência já respondidas. Seção sem obrigatórias conta como completa. */
function sectionCompletion(section: Section, answers: Answers) {
  const required = section.questions.filter((question) => question.required);
  if (!required.length) return 100;
  return Math.round(required.filter((question) => answered(question, answers)).length / required.length * 100);
}
function scaleBoundary(question: Question, side: "start" | "end") {
  const explicit = question.settings?.[side === "start" ? "scale_start_label" : "scale_end_label"];
  if (typeof explicit === "string" && explicit.trim()) return explicit;
  return (side === "start" ? question.options[0] : question.options.at(-1))?.label ?? "";
}
function institutionalAvatarUrl(person: PersonIdentity) {
  const candidate = person.metadata?.avatar_url;
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
}

/** Bloco de dado funcional somente leitura, repetido no cabeçalho e na etapa 0. */
function IdentityField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-[var(--text-secondary)]">{label}</dt>
      <dd className="break-words font-semibold" style={{ color: CDDI_INK }}>{value}</dd>
    </div>
  );
}

export default function CddiFormPage() {
  const confirm = useConfirm();
  const [definition, setDefinition] = useState<FormDefinition | null>(null);
  const [submission, setSubmission] = useState<SubmissionContext | null>(null);
  const [identity, setIdentity] = useState<IdentityContext | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [screen, setScreen] = useState<Screen>("home");
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"info" | "warning" | "error" | "success">("info");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const saveTimers = useRef<Record<string, number>>({});
  const latestAnswers = useRef<Answers>({});
  const [saveQueue] = useState(() => new ReliableSaveQueue());
  const [saveSnapshot, setSaveSnapshot] = useState<SaveQueueSnapshot>(() => saveQueue.getSnapshot());
  const formTopRef = useRef<HTMLDivElement>(null);

  useEffect(() => saveQueue.subscribe(setSaveSnapshot), [saveQueue]);

  useEffect(() => {
    latestAnswers.current = answers;
  }, [answers]);

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createBrowserSupabaseClient();
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) { window.location.replace("/acesso"); return; }
        const [formResponse, submissionResponse, identityResponse] = await Promise.all([
          supabase.rpc("get_public_survey_form", { target_application_code: "CDDI-2026" }),
          supabase.rpc("start_or_resume_my_cddi_submission", { target_application_code: "CDDI-2026", target_submission_type: "AUTO", target_subject_person_id: null }),
          supabase.rpc("get_my_cddi_identity", { target_application_code: "CDDI-2026" }),
        ]);
        if (formResponse.error) throw formResponse.error;
        if (submissionResponse.error) throw submissionResponse.error;
        if (identityResponse.error) throw identityResponse.error;
        const context = submissionResponse.data as SubmissionContext;
        const restored: Answers = {};
        Object.entries(context.answers ?? {}).forEach(([questionId, answer]) => {
          const value = answer.answerText ?? answer.optionValue ?? (answer.answerNumber != null ? String(answer.answerNumber) : "");
          if (value !== "") restored[questionId] = { value, optionId: answer.optionId ?? undefined };
        });
        const rawDefinition = formResponse.data as FormDefinition;
        setDefinition({ ...rawDefinition, sections: visibleCddiSections(rawDefinition.sections, "AUTO") });
        setSubmission(context);
        setIdentity(identityResponse.data as IdentityContext);
        latestAnswers.current = restored;
        setAnswers(restored);
        setSavedAt(context.submission?.updatedAt ?? null);
        if (context.status === "PERIOD_CLOSED") {
          setMessageType("warning");
          setMessage("O período do CDDI 2026 está encerrado. O modo de consulta permanece disponível conforme suas permissões.");
        }
      } catch (error) {
        setMessageType("error");
        setMessage(error instanceof Error ? error.message : "Não foi possível carregar o CDDI.");
      } finally { setLoading(false); }
    };
    void load();
    const timersToClear = saveTimers.current;
    return () => {
      Object.values(timersToClear).forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  const sections = useMemo(() => definition?.sections ?? [], [definition?.sections]);
  // Etapa 0 = identificação e chefia; 1..N = uma competência cada; N+1 = revisão.
  const totalSteps = sections.length + 2;
  const currentSection = step > 0 && step <= sections.length ? sections[step - 1] : null;
  const requiredQuestions = useMemo(() => sections.flatMap((section) => section.questions).filter((question) => question.required), [sections]);
  const questionsById = useMemo(() => new Map(sections.flatMap((section) => section.questions).map((question) => [question.id, question])), [sections]);
  const answeredRequired = requiredQuestions.filter((question) => answered(question, answers)).length;
  const progress = requiredQuestions.length ? Math.round(answeredRequired / requiredQuestions.length * 100) : 0;
  // Respostas só mudam enquanto a submissão está em rascunho. Fora disso a tela
  // vira consulta: os fieldsets são desabilitados e o envio desaparece.
  const canEdit = Boolean(submission?.canEdit && submission.submission?.status === "DRAFT");
  const isSubmitted = submission?.submission?.status === "SUBMITTED" || submission?.submission?.status === "VALIDATED";

  function saveAnswer(question: Question, answer: AnswerValue) {
    if (!canEdit || !submission?.submission?.id) return Promise.resolve();
    const submissionId = submission.submission.id;
    return saveQueue.enqueue(async () => {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.rpc("save_my_cddi_answer", { target_submission_id: submissionId, target_question_id: question.id, target_option_id: question.type === "SCALE" ? answer.optionId ?? null : null, target_text: question.type === "SCALE" ? null : answer.value });
      if (error) throw new Error(errorMessageFromUnknown(error));
      setSavedAt((data as { savedAt?: string } | null)?.savedAt ?? new Date().toISOString());
    }).catch((error) => {
      setMessageType("error");
      setMessage(errorMessageFromUnknown(error) || "Não foi possível salvar a resposta.");
      throw error;
    });
  }
  function updateScale(question: Question, option: Option) {
    const answer = { value: option.value, optionId: option.id };
    latestAnswers.current = { ...latestAnswers.current, [question.id]: answer };
    setAnswers(latestAnswers.current);
    setMessage("");
    void saveAnswer(question, answer).catch(() => undefined);
  }
  // Escala salva na hora (um clique = uma decisão); texto salva com atraso para
  // não gravar a cada tecla digitada.
  function updateText(question: Question, value: string) {
    const answer = { value };
    latestAnswers.current = { ...latestAnswers.current, [question.id]: answer };
    setAnswers(latestAnswers.current);
    setMessage("");
    if (saveTimers.current[question.id]) window.clearTimeout(saveTimers.current[question.id]);
    saveTimers.current[question.id] = window.setTimeout(() => {
      delete saveTimers.current[question.id];
      void saveAnswer(question, latestAnswers.current[question.id] ?? answer).catch(() => undefined);
    }, 700);
  }
  async function flushPendingSaves() {
    Object.keys(saveTimers.current).forEach((questionId) => {
      window.clearTimeout(saveTimers.current[questionId]);
      delete saveTimers.current[questionId];
      const question = questionsById.get(questionId);
      const answer = latestAnswers.current[questionId];
      if (question && answer) void saveAnswer(question, answer).catch(() => undefined);
    });
    await saveQueue.flush();
  }
  function validateCurrentStep() {
    // A chefia vem do vínculo institucional (cddi_leadership_links) e precisa
    // existir antes de qualquer competência: é ela que avaliará esta pessoa no
    // ciclo. Sem vínculo, a correção é administrativa — não há seleção manual.
    if (step === 0 && !identity?.leader) {
      setMessageType("warning");
      setMessage("Sua chefia responsável ainda não está registrada na base institucional. Procure a administração para atualizar o vínculo antes de iniciar.");
      return false;
    }
    if (!currentSection || !canEdit) return true;
    const missing = currentSection.questions.filter((question) => question.required && !answered(question, answers));
    if (missing.length) {
      setMessageType("warning");
      setMessage(`Preencha ${missing.length} ${missing.length === 1 ? "pergunta obrigatória" : "perguntas obrigatórias"} desta etapa antes de continuar.`);
      return false;
    }
    return true;
  }
  /** Navega entre etapas. Só valida ao avançar — voltar para revisar é sempre livre. */
  function goToStep(target: number, validateAdvance = true) {
    if (validateAdvance && target > step && !validateCurrentStep()) return;
    setMessage("");
    setStep(Math.max(0, Math.min(target, totalSteps - 1)));
    window.requestAnimationFrame(() => formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
  /**
   * Envio definitivo da autoavaliação — irreversível.
   *
   * As três condições (chefia registrada no vínculo institucional, todas as
   * obrigatórias respondidas, confirmação explícita) espelham a validação da
   * RPC; o banco recusa de novo se qualquer uma falhar.
   */
  async function submitEvaluation() {
    if (!submission?.submission?.id || !canEdit) return;
    if (!identity?.leader) { setMessageType("warning"); setMessage("Sua chefia responsável ainda não está registrada na base institucional. Procure a administração para atualizar o vínculo antes de enviar."); return; }
    if (answeredRequired !== requiredQuestions.length) { setMessageType("warning"); setMessage("Ainda existem perguntas obrigatórias sem resposta."); return; }
    if (!(await confirm({ title: "Enviar autoavaliação?", description: "Depois do envio, suas respostas serão bloqueadas para edição e encaminhadas para consolidação.", confirmLabel: "Enviar autoavaliação" }))) return;
    setSubmitting(true);
    try {
      await flushPendingSaves();
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.rpc("submit_my_cddi_submission", { target_submission_id: submission.submission.id });
      if (error) throw new Error(errorMessageFromUnknown(error));
      const result = data as { submittedAt?: string; result?: number } | null;
      setSubmission((current) => current ? { ...current, canEdit: false, submission: current.submission ? { ...current.submission, status: "SUBMITTED", submittedAt: result?.submittedAt ?? new Date().toISOString(), result: result?.result ?? null } : null } : current);
      setMessageType("success");
      setMessage("Autoavaliação enviada com sucesso.");
    } catch (error) {
      setMessageType("error");
      setMessage(errorMessageFromUnknown(error) || "Não foi possível enviar a avaliação.");
    } finally { setSubmitting(false); }
  }

  if (loading) return <CddiPlatformFrame title="CDDI 2026"><CddiLoadingState /></CddiPlatformFrame>;
  if (!definition || !identity) return (
    <CddiPlatformFrame title="CDDI 2026">
      <div className="grid min-h-[60vh] place-items-center px-6">
        <section className="max-w-xl rounded-2xl border border-[var(--status-danger-border)] bg-[var(--surface-card)] p-8 shadow-[var(--shadow-card)]">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Não foi possível abrir o CDDI</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{message}</p>
          <Link href="/area" className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-[var(--brand-solid)] px-5 text-sm font-semibold text-[var(--text-on-brand)] transition hover:bg-[var(--brand-solid-hover)]">Voltar à área</Link>
        </section>
      </div>
    </CddiPlatformFrame>
  );

  const periodClosed = definition.application.status !== "OPEN";
  const person = identity.person;
  const avatarUrl = institutionalAvatarUrl(person);
  const visualIdentity = resolveSurveyVisualIdentity(definition.application.settings);

  const identityFields = (
    <>
      <IdentityField label="Participante" value={person.fullName} />
      <IdentityField label="Matrícula" value={person.employeeNumber} />
      <IdentityField label="Cargo" value={person.jobTitle || "Não informado"} />
    </>
  );

  if (screen === "home") return (
    <CddiPlatformFrame title="CDDI 2026">
      <div className="min-h-[60vh] text-[var(--text-primary)]">
        <div className="mx-auto max-w-[960px] space-y-4">
          <section className="rounded-2xl border border-[var(--border-subtle)] border-t-[5px] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-card)] sm:p-7" style={{ borderTopColor: CDDI_RULE }}>
            <h1 className="break-words text-2xl font-semibold tracking-tight sm:text-3xl" style={{ color: CDDI_INK }}>{visualIdentity.heroTitle}</h1>
            <p className="mt-3 max-w-3xl whitespace-pre-line break-words leading-7 text-[var(--text-secondary)]">{visualIdentity.heroSubtitle}</p>
            <p className="mt-2 leading-7 text-[var(--text-secondary)]">Você fará uma <strong className="font-semibold text-[var(--text-primary)]">autoavaliação</strong>, e sua <strong className="font-semibold text-[var(--text-primary)]">chefia direta</strong> fará a avaliação correspondente. As respostas são consolidadas para apoiar o diálogo e o desenvolvimento contínuo.</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">Ciclo 2026 · acesso restrito aos participantes cadastrados.</p>

            <dl className="mt-5 grid gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 sm:grid-cols-[auto_1fr_1fr_1fr_1fr] sm:items-center">
              <PersonAvatar fullName={person.fullName} avatarUrl={avatarUrl} className="h-16 w-16 rounded-2xl" fallbackClassName="text-xl" />
              {identityFields}
              <IdentityField label="Unidade" value={person.unit || "Não informada"} />
            </dl>
          </section>

          <section className={`rounded-2xl border border-l-4 p-5 shadow-[var(--shadow-card)] ${periodClosed
            ? "border-[var(--status-danger-border)] border-l-[var(--status-danger-text)] bg-[var(--status-danger-bg)]"
            : "border-[var(--status-success-border)] border-l-[var(--status-success-text)] bg-[var(--status-success-bg)]"}`}>
            <h2 className={`flex items-center gap-2 text-lg font-semibold ${periodClosed ? "text-[var(--status-danger-text)]" : "text-[var(--status-success-text)]"}`}>
              {periodClosed ? <Lock className="h-5 w-5" aria-hidden="true" /> : <CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
              {periodClosed ? "Período encerrado" : "Período aberto"}
            </h2>
            <p className={`mt-2 text-sm leading-6 ${periodClosed ? "text-[var(--status-danger-text)]" : "text-[var(--status-success-text)]"}`}>
              {periodClosed
                ? `O período de participação foi encerrado em ${dateLabel(definition.application.closesAt)}. O modo de consulta permanece disponível.`
                : "O ciclo está disponível para preenchimento. Suas respostas são salvas automaticamente."}
            </p>
            <p className="mt-2 text-xs text-[var(--text-secondary)]">Abertura: {dateLabel(definition.application.opensAt)} · Encerramento: {dateLabel(definition.application.closesAt)}</p>
          </section>

          <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: CDDI_INK }}>Escolha o que fazer agora</h2>
                <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">Quem tem equipe pode responder a própria autoavaliação e avaliar as pessoas vinculadas.</p>
              </div>
              <Link href="/area" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]">
                <Home className="h-4 w-4" aria-hidden="true" />
                Tela inicial
              </Link>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => { setScreen("auto"); setStep(0); }}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-5 text-left transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
              >
                <UserRound className="h-6 w-6" style={{ color: CDDI_INK }} aria-hidden="true" />
                <strong className="mt-3 block text-base font-semibold" style={{ color: CDDI_INK }}>Responder minha autoavaliação</strong>
                <span className="mt-1 block text-sm leading-6 text-[var(--text-secondary)]">Avalie suas próprias competências neste ciclo.</span>
              </button>
              <Link
                href="/equipe"
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-5 text-left transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
              >
                <UsersRound className="h-6 w-6" style={{ color: CDDI_INK }} aria-hidden="true" />
                <strong className="mt-3 block text-base font-semibold" style={{ color: CDDI_INK }}>Avaliar minha equipe</strong>
                <span className="mt-1 block text-sm leading-6 text-[var(--text-secondary)]">Veja pendentes, rascunhos e avaliações já concluídas.</span>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </CddiPlatformFrame>
  );

  const stepTitle = step === 0 ? "Identificação e estrutura" : step === totalSteps - 1 ? "Revisão final" : currentSection?.title;
  const missingToSubmit = requiredQuestions.length - answeredRequired;

  return (
    <CddiPlatformFrame title="Autoavaliação CDDI">
      <div className="cddi-form-shell min-h-[60vh] pb-28 text-[var(--text-primary)]">
        <div ref={formTopRef} className="cddi-form-scroll-anchor mx-auto max-w-[960px] space-y-4 px-4 py-4 sm:px-6">
          <section className="rounded-2xl border border-[var(--border-subtle)] border-t-[5px] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-card)] sm:p-6" style={{ borderTopColor: CDDI_RULE }}>
            <h1 className="break-words text-2xl font-semibold tracking-tight sm:text-3xl" style={{ color: CDDI_INK }}>{visualIdentity.heroTitle}</h1>
            <p className="mt-2 max-w-3xl whitespace-pre-line break-words leading-7 text-[var(--text-secondary)]">{visualIdentity.heroSubtitle}</p>
            <dl className="mt-4 grid gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 sm:grid-cols-[auto_1fr_1fr_1fr_1fr] sm:items-center">
              <PersonAvatar fullName={person.fullName} avatarUrl={avatarUrl} className="h-16 w-16 rounded-2xl" fallbackClassName="text-lg" />
              {identityFields}
              <IdentityField label="Tipo" value="Autoavaliação" />
            </dl>
          </section>

          {(periodClosed || !canEdit) && (
            <p role="status" className="flex items-start gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 text-sm leading-6 text-[var(--text-secondary)]">
              <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                {isSubmitted
                  ? <><strong className="font-semibold text-[var(--text-primary)]">Autoavaliação enviada.</strong> As respostas ficaram registradas e não podem mais ser alteradas.</>
                  : <><strong className="font-semibold text-[var(--text-primary)]">Somente leitura.</strong> O período de preenchimento não está aberto.</>}
              </span>
            </p>
          )}

          <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <strong className="text-sm font-semibold" style={{ color: CDDI_INK }}>{stepTitle}</strong>
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
            <nav aria-label="Etapas da autoavaliação" className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {Array.from({ length: totalSteps }).map((_, index) => {
                const complete = index === 0
                  ? Boolean(identity.leader)
                  : index <= sections.length
                    ? sectionCompletion(sections[index - 1], answers) === 100
                    : answeredRequired === requiredQuestions.length;
                const current = index === step;
                const label = index === 0 ? "Início" : index === totalSteps - 1 ? "Revisão" : String(index).padStart(2, "0");
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => goToStep(index, index > step)}
                    aria-current={current ? "step" : undefined}
                    title={index === 0 ? "Identificação e chefia" : index === totalSteps - 1 ? "Revisão final" : sections[index - 1]?.title}
                    className={`inline-flex min-h-9 min-w-9 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-semibold transition ${
                      current
                        ? "bg-[var(--brand-solid)] text-[var(--text-on-brand)]"
                        : complete
                          ? "bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
                          : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                    }`}
                  >
                    {complete && !current && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
                    {label}
                  </button>
                );
              })}
            </nav>
          </section>

          {message && (
            <p role="status" className={`flex items-start gap-3 rounded-xl border p-4 text-sm leading-6 ${
              messageType === "error" ? "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]"
                : messageType === "warning" ? "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]"
                : messageType === "success" ? "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
                : "border-[var(--status-info-border)] bg-[var(--status-info-bg)] text-[var(--status-info-text)]"
            }`}>
              {messageType === "error" || messageType === "warning"
                ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                : messageType === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                : <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
              {message}
            </p>
          )}

          {step === 0 && (
            <div className="space-y-4">
              <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-card)]">
                <h2 className="break-words text-lg font-semibold" style={{ color: CDDI_INK }}>1. Chefia responsável pela avaliação</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">O vínculo vem da base institucional e é preenchido automaticamente — você não precisa indicá-lo. É essa chefia que avaliará você neste ciclo.</p>
                {identity.leader ? (
                  <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] p-4">
                    <div className="min-w-0">
                      <span className="text-xs text-[var(--status-success-text)]">Chefia registrada</span>
                      <strong className="block break-words font-semibold text-[var(--status-success-text)]">{identity.leader.fullName}</strong>
                      <span className="block break-words text-sm text-[var(--status-success-text)]">{[identity.leader.jobTitle, identity.leader.unit].filter(Boolean).join(" · ") || "Dados funcionais não informados"}</span>
                    </div>
                    <BadgeCheck className="h-7 w-7 shrink-0 text-[var(--status-success-text)]" aria-hidden="true" />
                  </div>
                ) : (
                  <div className="mt-4 flex items-start gap-3 rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-4">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--status-warning-text)]" aria-hidden="true" />
                    <div>
                      <strong className="block font-semibold text-[var(--status-warning-text)]">Chefia ainda não registrada</strong>
                      <p className="mt-1 text-sm leading-6 text-[var(--status-warning-text)]">Sua chefia não foi localizada na base institucional. Procure a administração para atualizar o vínculo — sem ele não é possível concluir a avaliação.</p>
                    </div>
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-card)]">
                <h2 className="text-lg font-semibold" style={{ color: CDDI_INK }}>2. Seus dados organizacionais</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Somente leitura. Divergências são corrigidas pela administração, na base institucional.</p>
                <dl className="mt-4 grid gap-4 sm:grid-cols-3">
                  {[["Diretoria", person.directorate], ["Unidade", person.unit], ["Coordenação", person.coordination]].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4">
                      <dt className="text-xs text-[var(--text-secondary)]">{label}</dt>
                      <dd className="mt-0.5 break-words font-semibold" style={{ color: CDDI_INK }}>{value || "Não informada"}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            </div>
          )}

          {currentSection && (
            <section className="rounded-2xl border border-[var(--border-subtle)] border-t-4 border-t-[var(--brand-secondary)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-card)] sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--brand-secondary)]">Competência {step} de {sections.length}</p>
              <h2 className="mt-1 break-words text-xl font-semibold leading-snug tracking-tight sm:text-2xl" style={{ color: CDDI_INK }}>{currentSection.title}</h2>
              {currentSection.description && <p className="mt-3 whitespace-pre-line break-words rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 text-sm leading-7 text-[var(--text-secondary)]">{currentSection.description}</p>}

              <div className="mt-5 space-y-7">
                {currentSection.questions.map((question) => (
                  <fieldset key={question.id} disabled={!canEdit} className="min-w-0">
                    <legend className="block w-full whitespace-pre-line break-words text-sm font-semibold leading-relaxed text-[var(--text-primary)]">
                      {question.title}
                      {question.required && <span className="text-red-700" title="Resposta obrigatória"> *</span>}
                    </legend>
                    {question.description && <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-[var(--text-secondary)]">{question.description}</p>}

                    {question.type === "SCALE" ? (
                      <div className="mt-3">
                        <div className="grid grid-cols-5 gap-2">
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
                        <div className="mt-2 flex justify-between text-xs text-[var(--text-secondary)]">
                          <span>{scaleBoundary(question, "start")}</span>
                          <span>{scaleBoundary(question, "end")}</span>
                        </div>
                      </div>
                    ) : (
                      <textarea
                        value={answers[question.id]?.value ?? ""}
                        onChange={(event) => updateText(question, event.target.value)}
                        rows={6}
                        placeholder="Digite sua resposta..."
                        className="mt-3 w-full resize-y rounded-xl border border-[var(--border-subtle)] bg-[var(--control-bg)] p-4 text-sm leading-6 text-[var(--text-primary)] shadow-sm outline-none transition placeholder:text-[var(--text-muted)] hover:border-[var(--border-strong)] focus:border-[var(--focus-ring)] focus:ring-4 focus:ring-sky-300/15 disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)]"
                      />
                    )}
                  </fieldset>
                ))}
              </div>
            </section>
          )}

          {step === totalSteps - 1 && (
            <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-card)]">
              <h2 className="text-xl font-semibold tracking-tight" style={{ color: CDDI_INK }}>Revisão da autoavaliação</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">Toque em uma competência para revisar as respostas antes de enviar.</p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {sections.map((section, index) => {
                  const completion = sectionCompletion(section, answers);
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => goToStep(index + 1, false)}
                      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 text-left transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <strong className="text-sm font-semibold" style={{ color: CDDI_INK }}>{section.title}</strong>
                        <Badge variant={completion === 100 ? "success" : "warning"}>{completion}%</Badge>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 rounded-xl border border-[var(--status-info-border)] bg-[var(--status-info-bg)] p-5">
                <strong className="text-sm font-semibold text-[var(--status-info-text)]">Confirmação do envio</strong>
                <p className="mt-2 text-sm leading-6 text-[var(--status-info-text)]">Depois do envio definitivo, as respostas não poderão mais ser alteradas.</p>
                {canEdit && <>
                  <button
                    type="button"
                    onClick={submitEvaluation}
                    disabled={submitting || saveSnapshot.pending > 0 || answeredRequired !== requiredQuestions.length || !identity.leader}
                    title={!identity.leader ? "É preciso ter uma chefia registrada" : missingToSubmit > 0 ? `Faltam ${missingToSubmit} perguntas obrigatórias` : "Enviar definitivamente"}
                    className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--brand-solid)] px-5 text-sm font-semibold text-[var(--text-on-brand)] shadow-sm transition hover:bg-[var(--brand-solid-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? <Hourglass className="h-5 w-5 animate-pulse" aria-hidden="true" /> : <CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
                    {submitting ? "Enviando..." : "Confirmar e enviar autoavaliação"}
                  </button>
                  {(missingToSubmit > 0 || !identity.leader) && (
                    <p className="mt-2 text-xs leading-5 text-[var(--status-info-text)]">
                      {!identity.leader
                        ? "O envio fica bloqueado até a administração registrar sua chefia."
                        : `Faltam ${missingToSubmit} ${missingToSubmit === 1 ? "pergunta obrigatória" : "perguntas obrigatórias"} para liberar o envio.`}
                    </p>
                  )}
                </>}
                {isSubmitted && (
                  <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-[var(--status-success-text)]">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    Avaliação enviada em {dateLabel(submission?.submission?.submittedAt)}.
                  </p>
                )}
              </div>
            </section>
          )}
        </div>

        <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-4 py-3 shadow-[0_-10px_30px_rgba(15,23,42,.12)] backdrop-blur">
          <div className="mx-auto flex max-w-[960px] items-center justify-between gap-3">
            <p role="status" className="hidden items-center gap-2 text-sm text-[var(--text-secondary)] sm:flex">
              {saveSnapshot.pending > 0
                ? <><Hourglass className="h-4 w-4 animate-pulse" aria-hidden="true" />Salvando rascunho...</>
                : saveSnapshot.status === "ERROR"
                  ? <><AlertTriangle className="h-4 w-4 text-[var(--status-danger-text)]" aria-hidden="true" />Falha ao salvar</>
                  : <><Save className="h-4 w-4" aria-hidden="true" />{savedAt ? `Rascunho salvo em ${dateLabel(savedAt)}` : canEdit ? "Salvamento automático ativo" : "Somente leitura"}</>}
            </p>
            <div className="ml-auto flex gap-2">
              {step === 0 ? (
                <button
                  type="button"
                  onClick={() => goToStep(1, true)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--brand-solid)] px-6 text-sm font-semibold text-[var(--text-on-brand)] transition hover:bg-[var(--brand-solid-hover)]"
                >
                  Iniciar avaliação
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : <>
                <button
                  type="button"
                  onClick={() => setScreen("home")}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
                >
                  <Home className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Tela inicial</span>
                </button>
                <button
                  type="button"
                  onClick={() => goToStep(step - 1, false)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => goToStep(step + 1, true)}
                  disabled={step === totalSteps - 1}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--brand-solid)] px-4 text-sm font-semibold text-[var(--text-on-brand)] transition hover:bg-[var(--brand-solid-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Próxima
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </>}
            </div>
          </div>
        </footer>
      </div>
    </CddiPlatformFrame>
  );
}
