"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, FileText, Loader2, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { useConfirm } from "@/components/confirmation-provider";
import { deriveModules, profileLabel, usePlatformContext } from "@/lib/platform-context";
import { buildSurveyAnswerPayload, isSurveyAnswerComplete, restoreSurveyAnswer, type StoredSurveyAnswer, type SurveyAnswerValue } from "@/lib/survey-runtime";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type Option = { id: string; label: string; value: string };
type Question = { id: string; title: string; description: string | null; type: string; required: boolean; options: Option[] };
type Section = { id: string; title: string; description: string | null; questions: Question[] };
type Definition = {
  application: { name: string; status: string };
  survey: { code: string; name: string; description: string | null };
  sections: Section[];
};
type SubmissionContext = {
  canEdit: boolean;
  submission: { id: string; status: string; submittedAt: string | null } | null;
  answers: Record<string, StoredSurveyAnswer>;
};
type Answers = Record<string, SurveyAnswerValue>;

export default function GenericSurveyPage() {
  const confirm = useConfirm();
  const params = useParams<{ applicationCode: string }>();
  const applicationCode = decodeURIComponent(params.applicationCode);
  const { context, loading: contextLoading, error } = usePlatformContext();
  const [definition, setDefinition] = useState<Definition | null>(null);
  const [submission, setSubmission] = useState<SubmissionContext | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [loading, setLoading] = useState(true);
  const [pendingSaves, setPendingSaves] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(0);
  const timers = useRef<Record<string, number>>({});
  const latestAnswers = useRef<Answers>({});
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const formTopRef = useRef<HTMLElement>(null);

  useEffect(() => {
    latestAnswers.current = answers;
  }, [answers]);

  useEffect(() => {
    if (!context?.person) return;
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const supabase = createBrowserSupabaseClient();
        const [formResponse, submissionResponse] = await Promise.all([
          supabase.rpc("get_public_survey_form", { target_application_code: applicationCode }),
          supabase.rpc("start_or_resume_my_survey_submission", { target_application_code: applicationCode }),
        ]);
        if (formResponse.error) throw formResponse.error;
        if (submissionResponse.error) throw submissionResponse.error;
        if (!formResponse.data) throw new Error("A avaliação ainda não está publicada.");

        const restored: Answers = {};
        const resolvedSubmission = submissionResponse.data as SubmissionContext;
        Object.entries(resolvedSubmission.answers ?? {}).forEach(([questionId, value]) => {
          restored[questionId] = restoreSurveyAnswer(value);
        });

        if (!active) return;
        latestAnswers.current = restored;
        setDefinition(formResponse.data as Definition);
        setSubmission(resolvedSubmission);
        setAnswers(restored);
      } catch (loadError) {
        if (active) toast.error(loadError instanceof Error ? loadError.message : "Não foi possível abrir a avaliação.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    const timersToClear = timers.current;
    return () => {
      active = false;
      Object.values(timersToClear).forEach((timer) => window.clearTimeout(timer));
    };
  }, [applicationCode, context?.person]);

  const sections = useMemo(() => definition?.sections ?? [], [definition?.sections]);
  const questionsById = useMemo(() => new Map(sections.flatMap((section) => section.questions).map((question) => [question.id, question])), [sections]);
  const currentSection = sections[step];
  const requiredQuestions = useMemo(() => sections.flatMap((section) => section.questions).filter((question) => question.required), [sections]);
  const answeredRequired = requiredQuestions.filter((question) => isSurveyAnswerComplete(question.type, answers[question.id])).length;
  const progress = requiredQuestions.length ? Math.round((answeredRequired / requiredQuestions.length) * 100) : 100;
  const canEdit = Boolean(submission?.canEdit && submission.submission?.status === "DRAFT");
  const isSubmitted = ["SUBMITTED", "VALIDATED"].includes(submission?.submission?.status ?? "");
  const saving = pendingSaves > 0;

  /**
   * Encadeia a gravação após as anteriores.
   *
   * A serialização evita que dois autossalvamentos da mesma pergunta cheguem ao
   * banco fora de ordem e gravem o valor antigo por último. O `catch` que precede
   * o `then` mantém a corrente viva depois de uma falha.
   */
  function enqueueSave(question: Question, value: SurveyAnswerValue) {
    if (!canEdit || !submission?.submission?.id) return saveQueue.current;
    const submissionId = submission.submission.id;
    setPendingSaves((current) => current + 1);

    const operation = async () => {
      const supabase = createBrowserSupabaseClient();
      const { error: saveError } = await supabase.rpc("save_my_survey_answer", {
        target_submission_id: submissionId,
        target_question_id: question.id,
        ...buildSurveyAnswerPayload(question.type, value),
      });
      if (saveError) throw saveError;
    };

    saveQueue.current = saveQueue.current
      .catch(() => undefined)
      .then(operation)
      .catch((saveError) => {
        toast.error(saveError instanceof Error ? saveError.message : "Não foi possível salvar a resposta.");
        throw saveError;
      })
      .finally(() => setPendingSaves((current) => Math.max(0, current - 1)));

    return saveQueue.current;
  }

  function update(question: Question, value: SurveyAnswerValue, delay = 0) {
    latestAnswers.current = { ...latestAnswers.current, [question.id]: value };
    setAnswers((current) => ({ ...current, [question.id]: value }));
    if (timers.current[question.id]) window.clearTimeout(timers.current[question.id]);

    if (delay) {
      timers.current[question.id] = window.setTimeout(() => {
        delete timers.current[question.id];
        void enqueueSave(question, latestAnswers.current[question.id] ?? value);
      }, delay);
    } else {
      void enqueueSave(question, value);
    }
  }

  /**
   * Dispara imediatamente as gravações ainda em espera e aguarda a fila.
   *
   * Necessário antes do envio definitivo: sem isso, texto digitado nos últimos
   * milissegundos ficaria preso no debounce e seria perdido.
   */
  async function flushPendingSaves() {
    const delayedQuestionIds = Object.keys(timers.current);
    delayedQuestionIds.forEach((questionId) => {
      window.clearTimeout(timers.current[questionId]);
      delete timers.current[questionId];
      const question = questionsById.get(questionId);
      const value = latestAnswers.current[questionId];
      if (question && value) void enqueueSave(question, value);
    });
    await saveQueue.current;
  }

  function validateCurrentSection() {
    if (!currentSection || !canEdit) return true;
    const missing = currentSection.questions.filter((question) => question.required && !isSurveyAnswerComplete(question.type, answers[question.id]));
    if (missing.length) {
      toast.warning(`Preencha ${missing.length} pergunta(s) obrigatória(s) desta etapa.`);
      return false;
    }
    return true;
  }

  function goToStep(target: number) {
    setStep(Math.max(0, Math.min(target, sections.length - 1)));
    window.requestAnimationFrame(() => formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  async function submitSurvey() {
    if (!submission?.submission?.id || !canEdit) return;
    if (answeredRequired !== requiredQuestions.length) {
      toast.warning("Ainda existem perguntas obrigatórias sem resposta.");
      return;
    }
    if (!(await confirm({ title: "Enviar avaliação definitivamente?", description: "Depois do envio, as respostas não poderão mais ser alteradas.", confirmLabel: "Enviar avaliação" }))) return;

    setSubmitting(true);
    try {
      await flushPendingSaves();
      const supabase = createBrowserSupabaseClient();
      const { data, error: submitError } = await supabase.rpc("submit_my_survey_submission", {
        target_submission_id: submission.submission.id,
      });
      if (submitError) throw submitError;
      const submittedAt = (data as { submittedAt?: string } | null)?.submittedAt ?? new Date().toISOString();
      setSubmission((current) => current ? {
        ...current,
        canEdit: false,
        submission: current.submission ? { ...current.submission, status: "SUBMITTED", submittedAt } : null,
      } : current);
      toast.success("Avaliação enviada com sucesso.");
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "Não foi possível enviar a avaliação.");
    } finally {
      setSubmitting(false);
    }
  }

  if (contextLoading || loading) return <PlatformSkeleton title="Abrindo avaliação" />;
  if (!context?.person) return <main className="p-10 text-red-700">{error || "Acesso não identificado."}</main>;
  if (!definition) return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
      <section className="max-w-lg rounded-3xl bg-white p-8 shadow-xl">
        <h1 className="text-2xl font-black text-[#003b70]">Avaliação indisponível</h1>
        <p className="mt-3 text-slate-600">O instrumento não está publicado ou você não possui acesso.</p>
        <Link href="/pesquisas" className="mt-6 inline-flex rounded-xl bg-[#003b70] px-5 py-3 font-black text-white">Voltar ao catálogo</Link>
      </section>
    </main>
  );

  const modules = deriveModules(context);
  const user = {
    fullName: context.person.fullName,
    institutionalEmail: context.person.institutionalEmail,
    employeeNumber: context.person.employeeNumber,
    profileLabel: profileLabel(context),
    avatarUrl: context.person.avatarUrl,
    roles: context.roles,
    modules,
  };

  return (
    <PlatformShell user={user} eyebrow={definition.survey.code} title={definition.application.name}>
      <div className="mx-auto w-full max-w-5xl">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-5 p-6 lg:grid-cols-[1fr_auto] lg:items-start lg:p-8">
          <div className="min-w-0">
            <p className="break-words text-xs font-black uppercase tracking-[.16em] text-emerald-700">{definition.survey.name}</p>
            <h2 className="mt-2 break-words text-3xl font-black leading-tight text-[#003b70]">{definition.application.name}</h2>
            <p className="mt-3 max-w-3xl whitespace-pre-line break-words leading-7 text-slate-600">{definition.survey.description || "Instrumento institucional de avaliação."}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full px-3 py-1.5 text-xs font-black ${definition.application.status === "OPEN" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>{definition.application.status === "OPEN" ? "Período aberto" : "Período encerrado"}</span>
            {isSubmitted && <span className="rounded-full bg-blue-100 px-3 py-1.5 text-xs font-black text-blue-800">Enviada</span>}
          </div>
        </div>
        <div className="h-1 bg-[linear-gradient(90deg,#003b70,#0b8f58,#f2b705,#d92d3a,#00a8d6)]" />
      </section>

      <section ref={formTopRef} className="mt-5 scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div><strong className="text-[#003b70]">Progresso</strong><p className="mt-1 text-xs text-slate-500">{answeredRequired} de {requiredQuestions.length} obrigatórias respondidas</p></div>
          <span className="text-2xl font-black text-[#003b70]">{progress}%</span>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-[#003b70] via-emerald-500 to-cyan-500" style={{ width: `${progress}%` }} /></div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {sections.map((section, index) => <button key={section.id} type="button" onClick={() => goToStep(index)} title={section.title} className={`max-w-60 shrink-0 truncate rounded-xl px-4 py-2 text-sm font-black ${index === step ? "bg-[#003b70] text-white" : "bg-slate-100 text-slate-500"}`}>{index + 1}. {section.title}</button>)}
        </div>
      </section>

      {currentSection && (
        <section className="mt-5 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-black uppercase tracking-[.14em] text-emerald-700">Etapa {step + 1} de {sections.length}</p>
          <h3 className="mt-2 break-words text-2xl font-black leading-snug text-[#003b70]">{currentSection.title}</h3>
          {currentSection.description && <p className="mt-3 whitespace-pre-line break-words leading-7 text-slate-600">{currentSection.description}</p>}
          <div className="mt-8 space-y-8">
            {currentSection.questions.map((question) => {
              const value = answers[question.id] ?? {};
              return (
                <fieldset key={question.id} disabled={!canEdit} className="min-w-0">
                  <legend className="block w-full whitespace-pre-line break-words font-black leading-relaxed text-slate-900">{question.title}{question.required && <span className="text-red-600"> *</span>}</legend>
                  {question.description && <p className="mt-1 whitespace-pre-line break-words text-sm leading-6 text-slate-500">{question.description}</p>}
                  {["SCALE", "SINGLE_CHOICE"].includes(question.type) && <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{question.options.map((option) => <label key={option.id} className={`cursor-pointer break-words rounded-2xl border p-4 font-bold ${value.optionIds?.includes(option.id) ? "border-blue-500 bg-blue-50 text-[#003b70]" : "border-slate-200"}`}><input type="radio" className="sr-only" name={question.id} checked={value.optionIds?.includes(option.id) ?? false} onChange={() => update(question, { optionIds: [option.id] })} />{option.label}</label>)}</div>}
                  {question.type === "MULTIPLE_CHOICE" && <div className="mt-4 grid gap-2 sm:grid-cols-2">{question.options.map((option) => { const selected = value.optionIds?.includes(option.id) ?? false; return <label key={option.id} className={`cursor-pointer break-words rounded-2xl border p-4 font-bold ${selected ? "border-blue-500 bg-blue-50 text-[#003b70]" : "border-slate-200"}`}><input type="checkbox" className="mr-3" checked={selected} onChange={() => { const current = value.optionIds ?? []; update(question, { optionIds: selected ? current.filter((id) => id !== option.id) : [...current, option.id] }); }} />{option.label}</label>; })}</div>}
                  {question.type === "BOOLEAN" && <div className="mt-4 grid grid-cols-2 gap-3">{([{ value: true, label: "Sim" }, { value: false, label: "Não" }] as const).map((item) => <button key={item.label} type="button" onClick={() => update(question, { boolean: item.value })} className={`rounded-2xl border p-4 font-black ${value.boolean === item.value ? "border-blue-500 bg-blue-50 text-[#003b70]" : "border-slate-200"}`}>{item.label}</button>)}</div>}
                  {["INTEGER", "DECIMAL"].includes(question.type) && <input type="number" inputMode={question.type === "INTEGER" ? "numeric" : "decimal"} step={question.type === "INTEGER" ? 1 : "any"} value={value.number ?? ""} onChange={(event) => { const rawValue = event.target.value; update(question, { number: rawValue === "" ? undefined : Number(rawValue) }, 500); }} className="mt-4 w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3.5 text-[var(--text-primary)] outline-none focus:border-[var(--focus-ring)] focus:bg-[var(--surface-card)]" />}
                  {question.type === "DATE" && <input type="date" value={value.date ?? ""} onChange={(event) => update(question, { date: event.target.value || undefined })} className="mt-4 w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3.5 text-[var(--text-primary)] outline-none focus:border-[var(--focus-ring)] focus:bg-[var(--surface-card)]" />}
                  {question.type === "DATETIME" && <input type="datetime-local" value={value.datetime ?? ""} onChange={(event) => update(question, { datetime: event.target.value || undefined })} className="mt-4 w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3.5 text-[var(--text-primary)] outline-none focus:border-[var(--focus-ring)] focus:bg-[var(--surface-card)]" />}
                  {["SHORT_TEXT", "LONG_TEXT"].includes(question.type) && (question.type === "LONG_TEXT" ? <textarea rows={6} maxLength={12000} value={value.text ?? ""} onChange={(event) => update(question, { text: event.target.value }, 700)} className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 outline-none focus:border-blue-400 focus:bg-white" /> : <input maxLength={12000} value={value.text ?? ""} onChange={(event) => update(question, { text: event.target.value }, 700)} className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none focus:border-blue-400 focus:bg-white" />)}
                </fieldset>
              );
            })}
          </div>
        </section>
      )}

      <footer className="mt-5 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-500">{saving ? <><Loader2 className="h-4 w-4 animate-spin" />Salvando {pendingSaves > 1 ? `${pendingSaves} alterações` : "alteração"}...</> : <><Save className="h-4 w-4" />{canEdit ? "Todas as alterações foram salvas" : isSubmitted ? "Envio concluído" : "Modo somente leitura"}</>}</div>
          <div className="flex flex-wrap justify-end gap-2">
            <Link href="/pesquisas" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 font-black text-slate-600"><FileText className="h-4 w-4" />Catálogo</Link>
            <button type="button" onClick={() => goToStep(step - 1)} disabled={step === 0 || submitting} className="inline-flex items-center gap-2 rounded-xl bg-slate-600 px-4 py-3 font-black text-white disabled:opacity-40"><ArrowLeft className="h-4 w-4" />Anterior</button>
            {step < sections.length - 1 ? (
              <button type="button" onClick={() => { if (validateCurrentSection()) goToStep(step + 1); }} disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-[#003b70] px-4 py-3 font-black text-white disabled:opacity-40">Próxima<ArrowRight className="h-4 w-4" /></button>
            ) : canEdit ? (
              <button type="button" onClick={submitSurvey} disabled={submitting || answeredRequired !== requiredQuestions.length} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 font-black text-white disabled:opacity-50">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{submitting ? "Salvando e enviando..." : "Enviar avaliação"}</button>
            ) : isSubmitted ? (
              <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 font-black text-emerald-800"><CheckCircle2 className="h-4 w-4" />Envio concluído</span>
            ) : null}
          </div>
        </div>
      </footer>
      </div>
    </PlatformShell>
  );
}
