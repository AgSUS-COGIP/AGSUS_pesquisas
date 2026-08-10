"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Home, UserRoundCheck } from "lucide-react";
import { useParams } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useConfirm } from "@/components/confirmation-provider";
import { CddiPlatformFrame } from "@/components/cddi-platform-frame";
import { PersonAvatar } from "@/components/person-avatar";
import { visibleCddiSections } from "@/lib/cddi-question-applicability";
import { errorMessageFromUnknown } from "@/lib/observability";
import { ReliableSaveQueue, type SaveQueueSnapshot } from "@/lib/reliable-save-queue";

type Option = { id: string; label: string; value: string; position: number };
type Question = { id: string; title: string; description: string | null; type: string; required: boolean; validation?: Record<string, unknown>; options: Option[] };
type Section = { id: string; code: string; title: string; description: string | null; questions: Question[] };
type FormDefinition = { application: { status: string; opensAt: string | null; closesAt: string | null }; sections: Section[] };
type StoredAnswer = { answerText?: string | null; answerNumber?: number | null; optionId?: string | null; optionValue?: string | null };
type SubmissionContext = { canEdit: boolean; submission: { id: string; status: string; submittedAt: string | null; updatedAt: string; result: number | null } | null; answers: Record<string, StoredAnswer> };
type Member = { personId: string; fullName: string; employeeNumber: string; institutionalEmail: string | null; jobTitle: string | null; unit: string | null; workplace: string | null; avatarUrl: string | null };
type AnswerValue = { value: string; optionId?: string };
type Answers = Record<string, AnswerValue>;

function dateLabel(value: string | null | undefined) {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}
function answered(question: Question, answers: Answers) { return Boolean(answers[question.id]?.value?.trim()); }
function completion(section: Section, answers: Answers) {
  const required = section.questions.filter((question) => question.required);
  return required.length ? Math.round(required.filter((question) => answered(question, answers)).length / required.length * 100) : 100;
}

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
        setDefinition({ ...rawDefinition, sections: visibleCddiSections(rawDefinition.sections, "CHEFIA") });
        setSubmission(context);
        setMember(selected);
        latestAnswers.current = restored;
        setAnswers(restored);
      } catch (error) {
        setMessage(errorMessageFromUnknown(error) || "Não foi possível abrir a avaliação.");
      } finally { setLoading(false); }
    };
    void load();
    const timersToClear = timers.current;
    return () => Object.values(timersToClear).forEach((timer) => window.clearTimeout(timer));
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
    }).catch((error) => {
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

  if (loading) return <CddiPlatformFrame title="Avaliação da chefia"><div className="grid min-h-[60vh] place-items-center"><p className="font-bold text-[var(--text-primary)]">Carregando avaliação da chefia...</p></div></CddiPlatformFrame>;
  if (!definition || !member || !submission) return <CddiPlatformFrame title="Avaliação da chefia"><div className="grid min-h-[60vh] place-items-center px-6"><section className="max-w-xl rounded-2xl bg-[var(--surface-card)] p-8 shadow-sm"><h1 className="text-2xl font-black text-[var(--text-primary)]">Avaliação indisponível</h1><p className="mt-3 text-[var(--text-secondary)]">{message}</p><Link href="/equipe" className="mt-5 inline-flex rounded-xl bg-[var(--brand-solid)] px-5 py-3 font-bold text-white">Voltar à equipe</Link></section></div></CddiPlatformFrame>;

  return <CddiPlatformFrame title={`Avaliação de ${member.fullName}`}><div className="cddi-form-shell min-h-[60vh] pb-28 text-[var(--text-primary)]">
    <div ref={formTopRef} className="cddi-form-scroll-anchor mx-auto max-w-[960px] px-4 py-5 sm:px-6">
      <header className="rounded-2xl border-t-4 border-[#2d3f97] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <PersonAvatar fullName={member.fullName} avatarUrl={member.avatarUrl} className="h-16 w-16 rounded-2xl" fallbackClassName="text-xl" />
          <div className="flex-1"><p className="text-xs font-black uppercase tracking-[.14em] text-emerald-700">Avaliação pela chefia</p><h1 className="mt-1 text-3xl font-black text-[#26368d]">{member.fullName}</h1><p className="mt-2 text-sm text-slate-500">Matrícula {member.employeeNumber} · {member.jobTitle || "Cargo não informado"} · {member.unit || member.workplace || "Unidade não informada"}</p></div>
          <Link href="/equipe" className="rounded-xl bg-slate-600 px-4 py-3 text-sm font-bold text-white">Voltar à equipe</Link>
        </div>
      </header>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-gradient-to-r from-[#087b8d] via-emerald-500 to-blue-600" style={{ width: `${progress}%` }} /></div><p className="mt-1 text-right text-xs text-slate-500">{progress}% preenchido</p>
      <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><strong className="text-[#26368d]">{currentSection?.title || "Revisão final"}</strong><span className="text-xs font-bold text-slate-500">Etapa {step + 1} de {totalSteps}</span></div><div className="mt-3 flex gap-2 overflow-x-auto">{Array.from({ length: totalSteps }).map((_, index) => <button key={index} onClick={() => goTo(index)} className={`min-w-9 rounded-full px-3 py-2 text-xs font-bold ${index === step ? "bg-[#086ab6] text-white" : index < sections.length && completion(sections[index], answers) === 100 ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>{index === totalSteps - 1 ? "Revisão" : String(index + 1).padStart(2, "0")}</button>)}</div></section>
      {message && <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-900">{message}</div>}
      {currentSection && <section className="mt-4 rounded-2xl border-t-4 border-emerald-600 bg-white p-5 shadow-sm sm:p-6"><p className="text-sm font-bold text-slate-500">Competência {step + 1} de {sections.length}</p><h2 className="mt-1 break-words text-2xl font-black leading-snug text-[#26368d]">{currentSection.title}</h2>{currentSection.description && <p className="mt-3 whitespace-pre-line break-words rounded-xl bg-slate-50 p-4 leading-7 text-slate-700">{currentSection.description}</p>}<div className="mt-6 space-y-8">{currentSection.questions.map((question) => <fieldset key={question.id} disabled={!canEdit} className="min-w-0"><legend className="block w-full whitespace-pre-line break-words font-bold leading-relaxed">{question.title}{question.required && <span className="text-red-600"> *</span>}</legend>{question.description && <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-slate-500">{question.description}</p>}{question.type === "SCALE" ? <div className="mt-3 grid grid-cols-5 gap-2">{question.options.map((option) => { const selected = answers[question.id]?.optionId === option.id || answers[question.id]?.value === option.value; return <label key={option.id} className={`cursor-pointer rounded-xl border py-4 text-center font-black ${selected ? "border-[#086ab6] bg-[#086ab6] text-white" : "border-slate-300 text-[#26368d]"}`}><input type="radio" className="sr-only" checked={selected} onChange={() => updateScale(question, option)} />{option.value}</label>; })}</div> : <textarea rows={6} value={answers[question.id]?.value ?? ""} onChange={(event) => updateText(question, event.target.value)} className="mt-3 w-full rounded-xl border border-slate-300 p-4 outline-none focus:border-[#086ab6]" />}</fieldset>)}</div></section>}
      {!currentSection && <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><UserRoundCheck className="h-7 w-7 text-emerald-600"/><div><h2 className="text-2xl font-black text-[#26368d]">Revisão da avaliação</h2><p className="text-sm text-slate-500">Confira o preenchimento antes do envio definitivo.</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{sections.map((section, index) => <button key={section.id} onClick={() => goTo(index)} className="rounded-xl border border-slate-200 p-4 text-left"><div className="flex justify-between gap-3"><strong className="text-[#26368d]">{section.title}</strong><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${completion(section, answers) === 100 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{completion(section, answers)}%</span></div></button>)}</div>{canEdit && <button onClick={submit} disabled={submitting || saving || requiredQuestions.some((question) => !answered(question, answers))} className="mt-5 w-full rounded-xl bg-[#086ab6] px-5 py-4 font-black text-white disabled:opacity-50">{submitting ? "Enviando..." : "Confirmar e enviar avaliação da chefia"}</button>}{submission.submission?.status !== "DRAFT" && <p className="mt-5 rounded-xl bg-emerald-50 p-4 font-bold text-emerald-800">Avaliação enviada em {dateLabel(submission.submission?.submittedAt)}.</p>}</section>}
    </div>
    <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-10px_30px_rgba(15,23,42,.12)]"><div className="mx-auto flex max-w-[960px] justify-between gap-3"><span className="hidden text-sm text-slate-500 sm:block">{saving ? "Salvando rascunho..." : canEdit ? "Salvamento automático ativo" : "Modo somente leitura"}</span><div className="ml-auto flex gap-2"><Link href="/equipe" className="inline-flex items-center gap-2 rounded-xl bg-slate-600 px-4 py-3 font-bold text-white"><Home className="h-4 w-4"/>Equipe</Link><button onClick={() => goTo(step - 1)} disabled={step === 0} className="inline-flex items-center gap-2 rounded-xl bg-slate-500 px-4 py-3 font-bold text-white disabled:opacity-40"><ArrowLeft className="h-4 w-4"/>Anterior</button><button onClick={() => goTo(step + 1)} disabled={step === totalSteps - 1} className="inline-flex items-center gap-2 rounded-xl bg-[#086ab6] px-4 py-3 font-bold text-white disabled:opacity-40">Próxima<ArrowRight className="h-4 w-4"/></button></div></div></footer>
  </div></CddiPlatformFrame>;
}
