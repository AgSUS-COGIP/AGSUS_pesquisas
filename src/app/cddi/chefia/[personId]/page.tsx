"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Home, UserRoundCheck } from "lucide-react";
import { useParams } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useConfirm } from "@/components/confirmation-provider";

type Option = { id: string; label: string; value: string; position: number };
type Question = { id: string; title: string; description: string | null; type: string; required: boolean; options: Option[] };
type Section = { id: string; code: string; title: string; description: string | null; questions: Question[] };
type FormDefinition = { application: { status: string; opensAt: string | null; closesAt: string | null }; sections: Section[] };
type StoredAnswer = { answerText?: string | null; answerNumber?: number | null; optionId?: string | null; optionValue?: string | null };
type SubmissionContext = { canEdit: boolean; submission: { id: string; status: string; submittedAt: string | null; updatedAt: string; result: number | null } | null; answers: Record<string, StoredAnswer> };
type Member = { personId: string; fullName: string; employeeNumber: string; institutionalEmail: string | null; jobTitle: string | null; unit: string | null; workplace: string | null };
type AnswerValue = { value: string; optionId?: string };
type Answers = Record<string, AnswerValue>;

function dateLabel(value: string | null | undefined) {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
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
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const timers = useRef<Record<string, number>>({});

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createBrowserSupabaseClient();
        const [formResponse, submissionResponse, teamResponse] = await Promise.all([
          supabase.rpc("get_public_survey_form", { target_application_code: "CDDI-2026" }),
          supabase.rpc("start_or_resume_my_cddi_submission", { target_application_code: "CDDI-2026", target_submission_type: "CHEFIA", target_subject_person_id: personId }),
          supabase.rpc("get_my_team_workspace", { target_application_code: "CDDI-2026" }),
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
        setDefinition(formResponse.data as FormDefinition);
        setSubmission(context);
        setMember(selected);
        setAnswers(restored);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Não foi possível abrir a avaliação.");
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
  const progress = requiredQuestions.length ? Math.round(requiredQuestions.filter((question) => answered(question, answers)).length / requiredQuestions.length * 100) : 0;
  const canEdit = Boolean(submission?.canEdit && submission.submission?.status === "DRAFT");

  async function saveAnswer(question: Question, answer: AnswerValue) {
    if (!canEdit || !submission?.submission?.id) return;
    setSaving(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.rpc("save_my_cddi_answer", {
        target_submission_id: submission.submission.id,
        target_question_id: question.id,
        target_option_id: question.type === "SCALE" ? answer.optionId ?? null : null,
        target_text: question.type === "SCALE" ? null : answer.value,
      });
      if (error) throw error;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar a resposta.");
    } finally { setSaving(false); }
  }
  function updateScale(question: Question, option: Option) {
    const answer = { value: option.value, optionId: option.id };
    setAnswers((current) => ({ ...current, [question.id]: answer }));
    void saveAnswer(question, answer);
  }
  function updateText(question: Question, value: string) {
    const answer = { value };
    setAnswers((current) => ({ ...current, [question.id]: answer }));
    if (timers.current[question.id]) window.clearTimeout(timers.current[question.id]);
    timers.current[question.id] = window.setTimeout(() => void saveAnswer(question, answer), 700);
  }
  function goTo(target: number) {
    if (target > step && currentSection && canEdit) {
      const missing = currentSection.questions.filter((question) => question.required && !answered(question, answers));
      if (missing.length) { setMessage(`Preencha ${missing.length} pergunta(s) obrigatória(s) antes de avançar.`); return; }
    }
    setMessage("");
    setStep(Math.max(0, Math.min(target, totalSteps - 1)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function submit() {
    if (!submission?.submission?.id || !canEdit) return;
    if (requiredQuestions.some((question) => !answered(question, answers))) { setMessage("Ainda existem perguntas obrigatórias sem resposta."); return; }
    if (!(await confirm({ title: "Enviar avaliação da chefia?", description: `A avaliação de ${member?.fullName ?? "esta pessoa"} será enviada definitivamente e bloqueada para edição.`, confirmLabel: "Enviar avaliação" }))) return;
    setSubmitting(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.rpc("submit_my_cddi_submission", { target_submission_id: submission.submission.id });
      if (error) throw error;
      const result = data as { submittedAt?: string; result?: number } | null;
      setSubmission((current) => current ? { ...current, canEdit: false, submission: current.submission ? { ...current.submission, status: "SUBMITTED", submittedAt: result?.submittedAt ?? new Date().toISOString(), result: result?.result ?? null } : null } : current);
      setMessage("Avaliação da chefia enviada com sucesso.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar a avaliação.");
    } finally { setSubmitting(false); }
  }

  if (loading) return <main className="grid min-h-screen place-items-center bg-[#eef3f8]"><p className="font-bold text-[#26368d]">Carregando avaliação da chefia...</p></main>;
  if (!definition || !member || !submission) return <main className="grid min-h-screen place-items-center bg-[#eef3f8] px-6"><section className="max-w-xl rounded-2xl bg-white p-8 shadow-sm"><h1 className="text-2xl font-black text-[#26368d]">Avaliação indisponível</h1><p className="mt-3 text-slate-600">{message}</p><Link href="/equipe" className="mt-5 inline-flex rounded-xl bg-[#086ab6] px-5 py-3 font-bold text-white">Voltar à equipe</Link></section></main>;

  return <main className="min-h-screen bg-[#eef3f8] pb-28 text-slate-900">
    <div className="mx-auto max-w-[960px] px-4 py-5 sm:px-6">
      <header className="rounded-2xl border-t-4 border-[#2d3f97] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-[#edf5fc] text-xl font-black text-[#086ab6]">{initials(member.fullName)}</div>
          <div className="flex-1"><p className="text-xs font-black uppercase tracking-[.14em] text-emerald-700">Avaliação pela chefia</p><h1 className="mt-1 text-3xl font-black text-[#26368d]">{member.fullName}</h1><p className="mt-2 text-sm text-slate-500">Matrícula {member.employeeNumber} · {member.jobTitle || "Cargo não informado"} · {member.unit || member.workplace || "Unidade não informada"}</p></div>
          <Link href="/equipe" className="rounded-xl bg-slate-600 px-4 py-3 text-sm font-bold text-white">Voltar à equipe</Link>
        </div>
      </header>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-gradient-to-r from-[#087b8d] via-emerald-500 to-blue-600" style={{ width: `${progress}%` }} /></div><p className="mt-1 text-right text-xs text-slate-500">{progress}% preenchido</p>
      <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><strong className="text-[#26368d]">{currentSection?.title || "Revisão final"}</strong><span className="text-xs font-bold text-slate-500">Etapa {step + 1} de {totalSteps}</span></div><div className="mt-3 flex gap-2 overflow-x-auto">{Array.from({ length: totalSteps }).map((_, index) => <button key={index} onClick={() => goTo(index)} className={`min-w-9 rounded-full px-3 py-2 text-xs font-bold ${index === step ? "bg-[#086ab6] text-white" : index < sections.length && completion(sections[index], answers) === 100 ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>{index === totalSteps - 1 ? "Revisão" : String(index + 1).padStart(2, "0")}</button>)}</div></section>
      {message && <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-900">{message}</div>}
      {currentSection && <section className="mt-4 rounded-2xl border-t-4 border-emerald-600 bg-white p-5 shadow-sm sm:p-6"><p className="text-sm font-bold text-slate-500">Competência {step + 1} de {sections.length}</p><h2 className="mt-1 text-2xl font-black text-[#26368d]">{currentSection.title}</h2>{currentSection.description && <p className="mt-3 rounded-xl bg-slate-50 p-4 leading-7 text-slate-700">{currentSection.description}</p>}<div className="mt-6 space-y-8">{currentSection.questions.map((question) => <fieldset key={question.id} disabled={!canEdit}><legend className="font-bold">{question.title}{question.required && <span className="text-red-600"> *</span>}</legend>{question.type === "SCALE" ? <div className="mt-3 grid grid-cols-5 gap-2">{question.options.map((option) => { const selected = answers[question.id]?.optionId === option.id || answers[question.id]?.value === option.value; return <label key={option.id} className={`cursor-pointer rounded-xl border py-4 text-center font-black ${selected ? "border-[#086ab6] bg-[#086ab6] text-white" : "border-slate-300 text-[#26368d]"}`}><input type="radio" className="sr-only" checked={selected} onChange={() => updateScale(question, option)} />{option.value}</label>; })}</div> : <textarea rows={6} value={answers[question.id]?.value ?? ""} onChange={(event) => updateText(question, event.target.value)} className="mt-3 w-full rounded-xl border border-slate-300 p-4 outline-none focus:border-[#086ab6]" />}</fieldset>)}</div></section>}
      {!currentSection && <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><UserRoundCheck className="h-7 w-7 text-emerald-600"/><div><h2 className="text-2xl font-black text-[#26368d]">Revisão da avaliação</h2><p className="text-sm text-slate-500">Confira o preenchimento antes do envio definitivo.</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{sections.map((section, index) => <button key={section.id} onClick={() => goTo(index)} className="rounded-xl border border-slate-200 p-4 text-left"><div className="flex justify-between gap-3"><strong className="text-[#26368d]">{section.title}</strong><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${completion(section, answers) === 100 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{completion(section, answers)}%</span></div></button>)}</div>{canEdit && <button onClick={submit} disabled={submitting || saving || requiredQuestions.some((question) => !answered(question, answers))} className="mt-5 w-full rounded-xl bg-[#086ab6] px-5 py-4 font-black text-white disabled:opacity-50">{submitting ? "Enviando..." : "Confirmar e enviar avaliação da chefia"}</button>}{submission.submission?.status !== "DRAFT" && <p className="mt-5 rounded-xl bg-emerald-50 p-4 font-bold text-emerald-800">Avaliação enviada em {dateLabel(submission.submission?.submittedAt)}.</p>}</section>}
    </div>
    <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-10px_30px_rgba(15,23,42,.12)]"><div className="mx-auto flex max-w-[960px] justify-between gap-3"><span className="hidden text-sm text-slate-500 sm:block">{saving ? "Salvando rascunho..." : canEdit ? "Salvamento automático ativo" : "Modo somente leitura"}</span><div className="ml-auto flex gap-2"><Link href="/equipe" className="inline-flex items-center gap-2 rounded-xl bg-slate-600 px-4 py-3 font-bold text-white"><Home className="h-4 w-4"/>Equipe</Link><button onClick={() => goTo(step - 1)} disabled={step === 0} className="inline-flex items-center gap-2 rounded-xl bg-slate-500 px-4 py-3 font-bold text-white disabled:opacity-40"><ArrowLeft className="h-4 w-4"/>Anterior</button><button onClick={() => goTo(step + 1)} disabled={step === totalSteps - 1} className="inline-flex items-center gap-2 rounded-xl bg-[#086ab6] px-4 py-3 font-bold text-white disabled:opacity-40">Próxima<ArrowRight className="h-4 w-4"/></button></div></div></footer>
  </main>;
}
