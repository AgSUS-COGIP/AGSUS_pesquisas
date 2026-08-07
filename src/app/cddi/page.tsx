"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BadgeCheck, ChevronRight, Home, Search, UserRound, UsersRound } from "lucide-react";
import { CddiLoadingState } from "@/components/cddi-loading-state";
import { CddiPlatformFrame } from "@/components/cddi-platform-frame";
import { SurveyBanner } from "@/components/survey-banner";
import { PersonAvatar } from "@/components/person-avatar";
import { useConfirm } from "@/components/confirmation-provider";
import { visibleCddiSections } from "@/lib/cddi-question-applicability";
import { errorMessageFromUnknown } from "@/lib/observability";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { DEFAULT_CDDI_VISUAL_IDENTITY, resolveSurveyVisualIdentity } from "@/lib/survey-visual-identity";

type Option = { id: string; code: string; label: string; value: string; score: number | null; position: number };
type Question = { id: string; code: string; title: string; description: string | null; type: string; required: boolean; position: number; validation?: Record<string, unknown>; settings: Record<string, unknown>; options: Option[] };
type Section = { id: string; code: string; title: string; description: string | null; position: number; questions: Question[] };
type FormDefinition = { application: { id: string; code: string; name: string; status: string; opensAt: string | null; closesAt: string | null; settings?: unknown }; survey: { name: string; description: string | null }; sections: Section[] };
type StoredAnswer = { answerText?: string | null; answerNumber?: number | null; optionId?: string | null; optionValue?: string | null };
type SubmissionContext = { status: string; canEdit: boolean; submission: { id: string; status: string; startedAt: string; submittedAt: string | null; updatedAt: string; result: number | null; type: string } | null; answers: Record<string, StoredAnswer> };
type PersonIdentity = { id: string; employeeNumber: string; fullName: string; institutionalEmail: string | null; jobTitle: string | null; directorate: string | null; unit: string | null; coordination: string | null; workplace: string | null; metadata: Record<string, unknown> };
type Leader = { personId: string; fullName: string; institutionalEmail: string | null; employeeNumber: string; jobTitle: string | null; unit: string | null; coordination: string | null };
type IdentityContext = { person: PersonIdentity; leader: Leader | null; canChangeLeader: boolean };
type AnswerValue = { value: string; optionId?: string };
type Answers = Record<string, AnswerValue>;
type SaveState = "idle" | "saving" | "saved" | "error";
type Screen = "home" | "auto";

function dateLabel(value: string | null | undefined) {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}
function answered(question: Question, answers: Answers) { return Boolean(answers[question.id]?.value?.trim()); }
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
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [leaderQuery, setLeaderQuery] = useState("");
  const [leaderResults, setLeaderResults] = useState<Leader[]>([]);
  const [leaderSearching, setLeaderSearching] = useState(false);
  const [leaderSaving, setLeaderSaving] = useState(false);
  const saveTimers = useRef<Record<string, number>>({});
  const leaderTimer = useRef<number | null>(null);
  const formTopRef = useRef<HTMLDivElement>(null);

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
      if (leaderTimer.current) window.clearTimeout(leaderTimer.current);
    };
  }, []);

  const sections = useMemo(() => definition?.sections ?? [], [definition?.sections]);
  const totalSteps = sections.length + 2;
  const currentSection = step > 0 && step <= sections.length ? sections[step - 1] : null;
  const requiredQuestions = useMemo(() => sections.flatMap((section) => section.questions).filter((question) => question.required), [sections]);
  const answeredRequired = requiredQuestions.filter((question) => answered(question, answers)).length;
  const progress = requiredQuestions.length ? Math.round(answeredRequired / requiredQuestions.length * 100) : 0;
  const canEdit = Boolean(submission?.canEdit && submission.submission?.status === "DRAFT");
  const isSubmitted = submission?.submission?.status === "SUBMITTED" || submission?.submission?.status === "VALIDATED";

  async function persistAnswer(question: Question, answer: AnswerValue) {
    if (!canEdit || !submission?.submission?.id) return;
    setSaveState("saving");
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.rpc("save_my_cddi_answer", { target_submission_id: submission.submission.id, target_question_id: question.id, target_option_id: question.type === "SCALE" ? answer.optionId ?? null : null, target_text: question.type === "SCALE" ? null : answer.value });
      if (error) throw new Error(errorMessageFromUnknown(error));
      setSavedAt((data as { savedAt?: string } | null)?.savedAt ?? new Date().toISOString());
      setSaveState("saved");
    } catch (error) {
      setSaveState("error");
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar a resposta.");
    }
  }
  function updateScale(question: Question, option: Option) {
    const answer = { value: option.value, optionId: option.id };
    setAnswers((current) => ({ ...current, [question.id]: answer }));
    setMessage("");
    void persistAnswer(question, answer);
  }
  function updateText(question: Question, value: string) {
    const answer = { value };
    setAnswers((current) => ({ ...current, [question.id]: answer }));
    setMessage("");
    setSaveState("idle");
    if (saveTimers.current[question.id]) window.clearTimeout(saveTimers.current[question.id]);
    saveTimers.current[question.id] = window.setTimeout(() => void persistAnswer(question, answer), 700);
  }
  function validateCurrentStep() {
    if (step === 0 && !identity?.leader) {
      setMessageType("warning");
      setMessage("Selecione sua chefia imediata antes de avançar.");
      return false;
    }
    if (!currentSection || !canEdit) return true;
    const missing = currentSection.questions.filter((question) => question.required && !answered(question, answers));
    if (missing.length) {
      setMessageType("warning");
      setMessage(`Preencha ${missing.length} pergunta(s) obrigatória(s) desta etapa antes de continuar.`);
      return false;
    }
    return true;
  }
  function goToStep(target: number, validateAdvance = true) {
    if (validateAdvance && target > step && !validateCurrentStep()) return;
    setMessage("");
    setStep(Math.max(0, Math.min(target, totalSteps - 1)));
    window.requestAnimationFrame(() => formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
  function searchLeaders(value: string) {
    setLeaderQuery(value);
    if (leaderTimer.current) window.clearTimeout(leaderTimer.current);
    if (value.trim().length < 2) { setLeaderResults([]); return; }
    leaderTimer.current = window.setTimeout(async () => {
      setLeaderSearching(true);
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.rpc("search_cddi_leaders", { target_application_code: "CDDI-2026", search_term: value.trim() });
      if (!error) setLeaderResults((data ?? []) as Leader[]);
      setLeaderSearching(false);
    }, 350);
  }
  async function chooseLeader(leader: Leader) {
    setLeaderSaving(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.rpc("set_my_cddi_leader", { target_application_code: "CDDI-2026", target_leader_person_id: leader.personId });
      if (error) throw error;
      setIdentity((current) => current ? { ...current, leader: (data as { leader: Leader }).leader } : current);
      setLeaderResults([]);
      setLeaderQuery("");
      setMessageType("success");
      setMessage("Chefia imediata confirmada para este ciclo.");
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Não foi possível confirmar a chefia.");
    } finally { setLeaderSaving(false); }
  }
  async function submitEvaluation() {
    if (!submission?.submission?.id || !canEdit) return;
    if (!identity?.leader) { setMessageType("warning"); setMessage("Confirme sua chefia antes de enviar a avaliação."); return; }
    if (answeredRequired !== requiredQuestions.length) { setMessageType("warning"); setMessage("Ainda existem perguntas obrigatórias sem resposta."); return; }
    if (!(await confirm({ title: "Enviar autoavaliação?", description: "Depois do envio, suas respostas serão bloqueadas para edição e encaminhadas para consolidação.", confirmLabel: "Enviar autoavaliação" }))) return;
    setSubmitting(true);
    try {
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
  if (!definition || !identity) return <CddiPlatformFrame title="CDDI 2026"><div className="grid min-h-[60vh] place-items-center px-6"><section className="max-w-xl rounded-2xl border border-red-200 bg-[var(--surface-card)] p-8"><h1 className="text-2xl font-black text-[var(--text-primary)]">Não foi possível abrir o CDDI</h1><p className="mt-3 text-[var(--text-secondary)]">{message}</p><Link href="/area" className="mt-6 inline-flex rounded-xl bg-[var(--brand-solid)] px-5 py-3 font-bold text-white">Voltar à área</Link></section></div></CddiPlatformFrame>;

  const periodClosed = definition.application.status !== "OPEN";
  const person = identity.person;
  const avatarUrl = institutionalAvatarUrl(person);
  const visualIdentity = resolveSurveyVisualIdentity(definition.application.settings);

  if (screen === "home") return (
    <CddiPlatformFrame title="CDDI 2026">
    <div className="min-h-[60vh] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[960px] space-y-4">
        <SurveyBanner key={visualIdentity.bannerUrl} src={visualIdentity.bannerUrl} fallbackSrc={DEFAULT_CDDI_VISUAL_IDENTITY.bannerUrl} alt={visualIdentity.bannerAlt} className="w-full rounded-t-2xl border border-slate-200 bg-white object-cover shadow-sm" />
        <section className="rounded-2xl border-t-[5px] border-[#2d3f97] bg-white p-5 shadow-sm sm:p-7">
          <h1 className="text-3xl font-black tracking-tight text-[#26368d] sm:text-4xl">{visualIdentity.heroTitle}</h1>
          <p className="mt-3 leading-7 text-slate-700">{visualIdentity.heroSubtitle}</p>
          <p className="mt-1 leading-7 text-slate-700">Será realizada uma <strong>autoavaliação</strong> e uma <strong>avaliação pela chefia direta</strong>. As informações serão consolidadas para apoiar o diálogo e o desenvolvimento contínuo.</p>
          <p className="mt-2 text-sm text-slate-500">Ciclo 2026 · acesso restrito aos participantes cadastrados.</p>
          <div className="mt-5 grid gap-4 rounded-xl bg-[#edf5fc] p-4 sm:grid-cols-[auto_1fr_1fr_1fr_1fr] sm:items-center">
            <PersonAvatar fullName={person.fullName} avatarUrl={avatarUrl} className="h-16 w-16 rounded-2xl" fallbackClassName="text-xl" />
            <div><span className="text-xs text-slate-500">Participante</span><strong className="block text-[#26368d]">{person.fullName}</strong></div>
            <div><span className="text-xs text-slate-500">Matrícula</span><strong className="block text-[#26368d]">{person.employeeNumber}</strong></div>
            <div><span className="text-xs text-slate-500">Cargo</span><strong className="block text-[#26368d]">{person.jobTitle || "Não informado"}</strong></div>
            <div><span className="text-xs text-slate-500">Perfil</span><strong className="block text-[#26368d]">{identity.canChangeLeader ? "Gestor(a)/Coordenador(a)" : "Participante"}</strong></div>
          </div>
        </section>
        <section className={`rounded-2xl border-l-4 p-5 shadow-sm ${periodClosed ? "border-red-600 bg-red-50" : "border-emerald-600 bg-emerald-50"}`}><h2 className="text-xl font-black text-[#26368d]">{periodClosed ? "Período encerrado" : "Período aberto"}</h2><p className="mt-2 text-slate-700">{periodClosed ? `O período de participação foi encerrado em ${dateLabel(definition.application.closesAt)}. O modo de consulta permanece disponível.` : "O ciclo está disponível para preenchimento."}</p><p className="mt-2 text-sm text-slate-500">Abertura: {dateLabel(definition.application.opensAt)} · Encerramento: {dateLabel(definition.application.closesAt)}</p></section>
        <section className="rounded-2xl bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-black text-[#26368d]">Selecione o tipo de avaliação</h2><p className="mt-1 text-sm text-slate-500">Gestores e coordenadores podem realizar a própria autoavaliação e avaliar os subordinados vinculados.</p></div><Link href="/area" className="rounded-xl bg-slate-600 px-4 py-2.5 text-sm font-bold text-white">Tela inicial</Link></div><div className="mt-4 grid gap-3 md:grid-cols-2"><button onClick={() => { setScreen("auto"); setStep(0); }} className="rounded-xl bg-[#086ab6] p-5 text-left text-white transition hover:bg-[#05558f]"><UserRound className="h-6 w-6"/><strong className="mt-3 block text-lg">Responder minha autoavaliação</strong><span className="mt-1 block text-sm text-blue-100">Preencher minha autoavaliação.</span></button><Link href="/equipe" className="rounded-xl bg-[#086ab6] p-5 text-left text-white transition hover:bg-[#05558f]"><UsersRound className="h-6 w-6"/><strong className="mt-3 block text-lg">Minha equipe</strong><span className="mt-1 block text-sm text-blue-100">Consultar avaliações pendentes, rascunhos e concluídas.</span></Link></div></section>
      </div>
    </div>
    </CddiPlatformFrame>
  );

  return (
    <CddiPlatformFrame title="Autoavaliação CDDI">
    <div className="cddi-form-shell min-h-[60vh] pb-28 text-[var(--text-primary)]">
      <div ref={formTopRef} className="cddi-form-scroll-anchor mx-auto max-w-[960px] px-4 py-4 sm:px-6">
        <SurveyBanner key={`form-${visualIdentity.bannerUrl}`} src={visualIdentity.bannerUrl} fallbackSrc={DEFAULT_CDDI_VISUAL_IDENTITY.bannerUrl} alt={visualIdentity.bannerAlt} className="w-full rounded-t-2xl border border-slate-200 bg-white object-cover shadow-sm" />
        <section className="mt-4 rounded-2xl border-t-[5px] border-[#2d3f97] bg-white p-5 shadow-sm sm:p-6"><h1 className="text-3xl font-black text-[#26368d]">{visualIdentity.heroTitle}</h1><p className="mt-2 leading-7 text-slate-700">{visualIdentity.heroSubtitle}</p><div className="mt-4 grid gap-3 rounded-xl bg-[#edf5fc] p-4 sm:grid-cols-[auto_1fr_1fr_1fr_1fr] sm:items-center"><PersonAvatar fullName={person.fullName} avatarUrl={avatarUrl} className="h-16 w-16 rounded-2xl" fallbackClassName="text-lg" /><div><span className="text-xs text-slate-500">Participante</span><strong className="block text-[#26368d]">{person.fullName}</strong></div><div><span className="text-xs text-slate-500">Matrícula</span><strong className="block text-[#26368d]">{person.employeeNumber}</strong></div><div><span className="text-xs text-slate-500">Cargo</span><strong className="block text-[#26368d]">{person.jobTitle || "Não informado"}</strong></div><div><span className="text-xs text-slate-500">Perfil</span><strong className="block text-[#26368d]">Autoavaliação</strong></div></div></section>
        <section className={`mt-4 rounded-2xl border-l-4 p-5 shadow-sm ${periodClosed ? "border-red-600 bg-red-50" : "border-emerald-600 bg-emerald-50"}`}><h2 className="text-xl font-black text-[#26368d]">{periodClosed ? "Período encerrado" : "Período aberto"}</h2><p className="mt-2 text-slate-700">{periodClosed ? "O formulário está disponível em modo de consulta." : "Suas respostas são salvas automaticamente durante o preenchimento."}</p></section>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-gradient-to-r from-[#087b8d] via-emerald-500 to-blue-600 transition-all" style={{ width: `${progress}%` }} /></div><div className="mt-1 text-right text-xs text-slate-500">{progress}% preenchido</div>
        <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><strong className="text-[#26368d]">{step === 0 ? "Identificação e estrutura" : step === totalSteps - 1 ? "Revisão final" : currentSection?.title}</strong><span className="text-xs font-bold text-slate-500">Etapa {step + 1} de {totalSteps}</span></div><div className="mt-3 flex gap-2 overflow-x-auto pb-1">{Array.from({ length: totalSteps }).map((_, index) => { const complete = index === 0 ? Boolean(identity.leader) : index <= sections.length ? sectionCompletion(sections[index - 1], answers) === 100 : answeredRequired === requiredQuestions.length; return <button key={index} onClick={() => goToStep(index, index > step)} className={`min-w-9 rounded-full px-3 py-2 text-xs font-bold ${index === step ? "bg-[#086ab6] text-white" : complete ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>{index === 0 ? "Início" : index === totalSteps - 1 ? "Revisão" : String(index).padStart(2, "0")}</button>; })}</div></section>
        {message && <div className={`mt-4 rounded-xl border p-4 text-sm font-bold ${messageType === "error" ? "border-red-200 bg-red-50 text-red-800" : messageType === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : messageType === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-blue-200 bg-blue-50 text-blue-900"}`}>{message}</div>}
        {step === 0 && <div className="mt-4 space-y-4"><section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="text-xl font-black text-[#26368d]">1. Indique sua chefia imediata</h2><p className="mt-2 text-sm text-slate-500">Pesquise pelo nome, e-mail, unidade ou coordenação. A pessoa indicada receberá você automaticamente na área Minha equipe.</p>{identity.leader ? <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><div><span className="text-xs text-emerald-700">Chefia selecionada</span><strong className="block text-emerald-950">{identity.leader.fullName}</strong><span className="text-sm text-emerald-700">{identity.leader.jobTitle} · {identity.leader.unit}</span></div><BadgeCheck className="h-7 w-7 text-emerald-600"/></div> : <p className="mt-4 text-sm text-slate-500">Nenhuma chefia selecionada.</p>}{identity.canChangeLeader && <div className="relative mt-4"><Search className="absolute left-3 top-3 h-5 w-5 text-slate-400"/><input value={leaderQuery} onChange={(event) => searchLeaders(event.target.value)} placeholder="Digite pelo menos duas letras do nome da chefia" className="h-12 w-full rounded-xl border border-slate-300 pl-11 pr-4 outline-none focus:border-[#086ab6]" />{leaderSearching && <span className="absolute right-3 top-3 text-sm text-slate-400">Buscando...</span>}{leaderResults.length > 0 && <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">{leaderResults.map((leader) => <button key={leader.personId} disabled={leaderSaving} onClick={() => chooseLeader(leader)} className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-blue-50"><div><strong className="block text-[#26368d]">{leader.fullName}</strong><span className="text-xs text-slate-500">{leader.jobTitle} · {leader.unit}</span></div><ChevronRight className="h-5 w-5 text-slate-400"/></button>)}</div>}</div>}<div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">Confira com atenção. Após concluir a autoavaliação, essa indicação formará o vínculo usado pela liderança para avaliar você neste ciclo.</div></section><section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="text-xl font-black text-[#26368d]">Dados organizacionais da pessoa avaliada</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-4"><span className="text-xs text-slate-500">Diretoria</span><strong className="block text-[#26368d]">{person.directorate || "Não informada"}</strong></div><div className="rounded-xl bg-slate-50 p-4"><span className="text-xs text-slate-500">Unidade</span><strong className="block text-[#26368d]">{person.unit || "Não informada"}</strong></div><div className="rounded-xl bg-slate-50 p-4"><span className="text-xs text-slate-500">Coordenação</span><strong className="block text-[#26368d]">{person.coordination || "Não informada"}</strong></div><div className="rounded-xl bg-slate-50 p-4"><span className="text-xs text-slate-500">Local de trabalho</span><strong className="block text-[#26368d]">{person.workplace || "Não informado"}</strong></div></div></section></div>}
        {currentSection && <section className="mt-4 rounded-2xl border-t-4 border-emerald-600 bg-white p-5 shadow-sm sm:p-6"><p className="text-sm font-bold text-slate-500">Competência {step} de {sections.length}</p><h2 className="mt-1 text-2xl font-black text-[#26368d]">{currentSection.title}</h2>{currentSection.description && <p className="mt-3 rounded-xl bg-slate-50 p-4 leading-7 text-slate-700">{currentSection.description}</p>}<div className="mt-5 space-y-7">{currentSection.questions.map((question) => <fieldset key={question.id} disabled={!canEdit}><legend className="font-bold text-slate-900">{question.title}{question.required && <span className="text-red-600"> *</span>}</legend>{question.type === "SCALE" ? <div className="mt-3"><div className="grid grid-cols-5 gap-2">{question.options.map((option) => { const selected = answers[question.id]?.optionId === option.id || answers[question.id]?.value === option.value; return <label key={option.id} className={`cursor-pointer rounded-xl border py-4 text-center font-black transition ${selected ? "border-[#086ab6] bg-[#086ab6] text-white" : "border-slate-300 bg-white text-[#26368d] hover:border-blue-400"}`}><input type="radio" className="sr-only" name={question.id} checked={selected} onChange={() => updateScale(question, option)} />{option.value}</label>; })}</div><div className="mt-2 flex justify-between text-xs text-slate-500"><span>{scaleBoundary(question, "start")}</span><span>{scaleBoundary(question, "end")}</span></div></div> : <textarea value={answers[question.id]?.value ?? ""} onChange={(event) => updateText(question, event.target.value)} rows={6} className="mt-3 w-full rounded-xl border border-slate-300 p-4 outline-none focus:border-[#086ab6]" placeholder="Digite sua resposta..." />}</fieldset>)}</div></section>}
        {step === totalSteps - 1 && <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm"><h2 className="text-2xl font-black text-[#26368d]">Revisão da autoavaliação</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{sections.map((section, index) => { const completion = sectionCompletion(section, answers); return <button key={section.id} onClick={() => goToStep(index + 1, false)} className="rounded-xl border border-slate-200 p-4 text-left hover:bg-blue-50"><div className="flex justify-between gap-3"><strong className="text-[#26368d]">{section.title}</strong><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${completion === 100 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{completion}%</span></div></button>; })}</div><div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-5"><strong className="text-[#26368d]">Confirmação do envio</strong><p className="mt-2 text-sm text-slate-600">Após o envio definitivo, as respostas não poderão ser alteradas.</p>{canEdit && <button onClick={submitEvaluation} disabled={submitting || answeredRequired !== requiredQuestions.length || !identity.leader} className="mt-4 w-full rounded-xl bg-[#086ab6] px-5 py-4 font-black text-white disabled:opacity-50">{submitting ? "Enviando..." : "Confirmar e enviar autoavaliação"}</button>}{isSubmitted && <p className="mt-4 font-bold text-emerald-800">Avaliação enviada em {dateLabel(submission?.submission?.submittedAt)}.</p>}</div></section>}
      </div>
      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-10px_30px_rgba(15,23,42,.12)] backdrop-blur"><div className="mx-auto flex max-w-[960px] items-center justify-between gap-3"><div className="hidden text-sm text-slate-500 sm:block">{saveState === "saving" ? "Salvando rascunho..." : saveState === "error" ? "Falha ao salvar" : savedAt ? `Rascunho salvo em ${dateLabel(savedAt)}` : canEdit ? "Salvamento automático ativo" : "Modo somente leitura"}</div><div className="ml-auto flex gap-2"><button onClick={() => setScreen("home")} className="inline-flex items-center gap-2 rounded-xl bg-slate-600 px-4 py-3 font-bold text-white"><Home className="h-4 w-4"/>Tela inicial</button><button onClick={() => goToStep(step - 1, false)} disabled={step === 0} className="inline-flex items-center gap-2 rounded-xl bg-slate-500 px-4 py-3 font-bold text-white disabled:opacity-40"><ArrowLeft className="h-4 w-4"/>Anterior</button><button onClick={() => goToStep(step + 1, true)} disabled={step === totalSteps - 1} className="inline-flex items-center gap-2 rounded-xl bg-[#086ab6] px-4 py-3 font-bold text-white disabled:opacity-40">Próxima<ArrowRight className="h-4 w-4"/></button></div></div></footer>
    </div>
    </CddiPlatformFrame>
  );
}
