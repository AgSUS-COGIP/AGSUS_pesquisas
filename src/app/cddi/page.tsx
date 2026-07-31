"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type Option = {
  id: string;
  code: string;
  label: string;
  value: string;
  score: number | null;
  position: number;
};

type Question = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  type: string;
  required: boolean;
  position: number;
  settings: Record<string, unknown>;
  options: Option[];
};

type Section = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  position: number;
  questions: Question[];
};

type FormDefinition = {
  application: {
    id: string;
    code: string;
    name: string;
    status: string;
    opensAt: string | null;
    closesAt: string | null;
  };
  survey: {
    name: string;
    description: string | null;
  };
  sections: Section[];
};

type StoredAnswer = {
  answerText?: string | null;
  answerNumber?: number | null;
  optionId?: string | null;
  optionValue?: string | null;
};

type SubmissionContext = {
  status: string;
  applicationStatus?: string;
  canEdit: boolean;
  submission: {
    id: string;
    status: string;
    startedAt: string;
    submittedAt: string | null;
    updatedAt: string;
    result: number | null;
    type: string;
  } | null;
  answers: Record<string, StoredAnswer>;
};

type AnswerValue = {
  value: string;
  optionId?: string;
};

type Answers = Record<string, AnswerValue>;
type SaveState = "idle" | "saving" | "saved" | "error";

function dateLabel(value: string | null | undefined) {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function questionAnswered(question: Question, answers: Answers) {
  return Boolean(answers[question.id]?.value?.trim());
}

function sectionCompletion(section: Section, answers: Answers) {
  const required = section.questions.filter((question) => question.required);
  if (!required.length) return 100;
  const answered = required.filter((question) => questionAnswered(question, answers)).length;
  return Math.round((answered / required.length) * 100);
}

function scaleBoundary(question: Question, side: "start" | "end") {
  const explicit = question.settings?.[side === "start" ? "scale_start_label" : "scale_end_label"];
  if (typeof explicit === "string" && explicit.trim()) return explicit;
  const option = side === "start" ? question.options[0] : question.options.at(-1);
  return option?.label ?? "";
}

export default function CddiFormPage() {
  const [definition, setDefinition] = useState<FormDefinition | null>(null);
  const [submission, setSubmission] = useState<SubmissionContext | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"info" | "warning" | "error" | "success">("info");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const saveTimers = useRef<Record<string, number>>({});

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createBrowserSupabaseClient();
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          window.location.replace("/acesso");
          return;
        }

        const [{ data: formData, error: formError }, { data: submissionData, error: submissionError }] = await Promise.all([
          supabase.rpc("get_public_survey_form", { target_application_code: "CDDI-2026" }),
          supabase.rpc("start_or_resume_my_cddi_submission", {
            target_application_code: "CDDI-2026",
            target_submission_type: "AUTO",
            target_subject_person_id: null,
          }),
        ]);

        if (formError) throw formError;
        if (!formData) throw new Error("A definição do CDDI 2026 não foi encontrada.");
        if (submissionError) throw submissionError;

        const context = submissionData as SubmissionContext;
        const restored: Answers = {};
        Object.entries(context.answers ?? {}).forEach(([questionId, answer]) => {
          const value = answer.answerText ?? answer.optionValue ?? (answer.answerNumber != null ? String(answer.answerNumber) : "");
          if (value !== "") restored[questionId] = { value, optionId: answer.optionId ?? undefined };
        });

        setDefinition(formData as FormDefinition);
        setSubmission(context);
        setAnswers(restored);
        setSavedAt(context.submission?.updatedAt ?? null);

        if (context.status === "PERIOD_CLOSED") {
          setMessageType("warning");
          setMessage("O período do CDDI 2026 está encerrado. O formulário permanece disponível apenas para consulta da estrutura e das perguntas.");
        } else if (context.submission?.status === "SUBMITTED" || context.submission?.status === "VALIDATED") {
          setMessageType("info");
          setMessage("Sua autoavaliação já foi enviada e está bloqueada para edição.");
        }
      } catch (error) {
        setMessageType("error");
        setMessage(error instanceof Error ? error.message : "Não foi possível carregar o formulário.");
      } finally {
        setLoading(false);
      }
    };

    void load();

    return () => {
      Object.values(saveTimers.current).forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  const sections = definition?.sections ?? [];
  const totalSteps = sections.length + 2;
  const currentSection = step > 0 && step <= sections.length ? sections[step - 1] : null;
  const requiredQuestions = useMemo(
    () => sections.flatMap((section) => section.questions).filter((question) => question.required),
    [sections],
  );
  const answeredRequired = requiredQuestions.filter((question) => questionAnswered(question, answers)).length;
  const progress = requiredQuestions.length ? Math.round((answeredRequired / requiredQuestions.length) * 100) : 0;
  const canEdit = Boolean(submission?.canEdit && submission.submission?.status === "DRAFT");
  const isSubmitted = submission?.submission?.status === "SUBMITTED" || submission?.submission?.status === "VALIDATED";

  async function persistAnswer(question: Question, answer: AnswerValue) {
    if (!canEdit || !submission?.submission?.id) return;

    setSaveState("saving");
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.rpc("save_my_cddi_answer", {
        target_submission_id: submission.submission.id,
        target_question_id: question.id,
        target_option_id: question.type === "SCALE" ? answer.optionId ?? null : null,
        target_text: question.type === "SCALE" ? null : answer.value,
      });
      if (error) throw error;

      const result = data as { savedAt?: string } | null;
      setSavedAt(result?.savedAt ?? new Date().toISOString());
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

    const existing = saveTimers.current[question.id];
    if (existing) window.clearTimeout(existing);
    saveTimers.current[question.id] = window.setTimeout(() => {
      void persistAnswer(question, answer);
    }, 700);
  }

  function validateCurrentStep() {
    if (!currentSection || !canEdit) return true;
    const missing = currentSection.questions.filter(
      (question) => question.required && !questionAnswered(question, answers),
    );

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
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitEvaluation() {
    if (!submission?.submission?.id || !canEdit) return;
    if (answeredRequired !== requiredQuestions.length) {
      setMessageType("warning");
      setMessage("Ainda existem perguntas obrigatórias sem resposta. Revise as etapas sinalizadas.");
      return;
    }

    const confirmed = window.confirm("Confirma o envio definitivo da sua autoavaliação? Após o envio, as respostas não poderão ser alteradas.");
    if (!confirmed) return;

    setSubmitting(true);
    setMessage("");
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.rpc("submit_my_cddi_submission", {
        target_submission_id: submission.submission.id,
      });
      if (error) throw error;

      const result = data as { submittedAt?: string; result?: number } | null;
      setSubmission((current) => current ? {
        ...current,
        canEdit: false,
        submission: current.submission ? {
          ...current.submission,
          status: "SUBMITTED",
          submittedAt: result?.submittedAt ?? new Date().toISOString(),
          result: result?.result ?? null,
        } : null,
      } : current);
      setMessageType("success");
      setMessage("Autoavaliação enviada com sucesso. Obrigado por participar do CDDI.");
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar a avaliação.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f3f7fb] px-6">
        <div className="w-full max-w-md rounded-3xl border border-[#d7e5f2] bg-white p-8 text-center shadow-xl">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-t-[#0d6efd]" />
          <h1 className="mt-5 text-xl font-black text-[#003b70]">Carregando CDDI 2026</h1>
          <p className="mt-2 text-sm text-slate-600">Preparando competências, perguntas e suas respostas.</p>
        </div>
      </main>
    );
  }

  if (!definition) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f3f7fb] px-6">
        <div className="w-full max-w-xl rounded-3xl border border-red-200 bg-white p-8 shadow-xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-red-700">Formulário indisponível</p>
          <h1 className="mt-2 text-3xl font-black text-[#003b70]">Não foi possível abrir o CDDI</h1>
          <p className="mt-4 leading-7 text-slate-600">{message}</p>
          <Link href="/area" className="mt-6 inline-flex rounded-xl bg-[#003b70] px-5 py-3 font-black text-white">Voltar ao painel</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f3f7fb] text-[#10243e]">
      <div className="h-2 bg-[linear-gradient(90deg,#003b70_0_20%,#0b8f58_20%_40%,#f2b705_40%_60%,#d92d3a_60%_80%,#00a8d6_80%_100%)]" />

      <header className="sticky top-0 z-30 border-b border-[#d7e5f2] bg-white/95 px-4 py-4 shadow-sm backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0b8f58]">AgSUS · CDDI 2026</p>
            <h1 className="truncate text-lg font-black text-[#003b70] sm:text-xl">Ciclo de Devolutivas e Desenvolvimento Individual</h1>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden rounded-full bg-blue-50 px-4 py-2 text-xs font-black text-[#003b70] sm:inline-flex">{progress}% preenchido</span>
            <Link href="/area" className="rounded-xl border border-[#d7e5f2] bg-white px-4 py-2 text-sm font-black text-slate-700">Sair do formulário</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="overflow-hidden rounded-3xl bg-[linear-gradient(125deg,#003b70,#075ea8)] p-6 text-white shadow-xl sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-bold text-emerald-300">
                {step === 0 ? "Orientações" : step === totalSteps - 1 ? "Revisão final" : `Etapa ${step} de ${sections.length}`}
              </p>
              <h2 className="mt-1 text-3xl font-black">
                {step === 0 ? "Antes de começar" : step === totalSteps - 1 ? "Confira suas respostas" : currentSection?.title}
              </h2>
              <p className="mt-3 max-w-2xl leading-7 text-blue-100">
                {step === 0
                  ? "Avalie cada comportamento e o nível de desenvolvimento com atenção. Suas respostas são salvas no sistema durante o preenchimento."
                  : currentSection?.description ?? "Responda todos os itens obrigatórios para avançar."}
              </p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-center">
              <strong className="block text-2xl">{step + 1}/{totalSteps}</strong>
              <span className="text-xs text-blue-100">etapas</span>
            </div>
          </div>
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-emerald-300 transition-all" style={{ width: `${((step + 1) / totalSteps) * 100}%` }} />
          </div>
        </section>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
          {Array.from({ length: totalSteps }).map((_, index) => {
            const completed = index > 0 && index <= sections.length
              ? sectionCompletion(sections[index - 1], answers) === 100
              : index < step;
            return (
              <button
                key={index}
                type="button"
                onClick={() => goToStep(index, index > step)}
                className={`min-w-11 rounded-full px-3 py-2 text-xs font-black transition ${index === step ? "bg-[#003b70] text-white" : completed ? "bg-emerald-100 text-emerald-800" : "border border-[#d7e5f2] bg-white text-slate-600"}`}
                title={index === 0 ? "Orientações" : index === totalSteps - 1 ? "Revisão" : sections[index - 1]?.title}
              >
                {index === 0 ? "Início" : index === totalSteps - 1 ? "Revisão" : String(index).padStart(2, "0")}
              </button>
            );
          })}
        </div>

        {message && (
          <div className={`mt-4 rounded-2xl border p-4 text-sm font-bold ${messageType === "error" ? "border-red-200 bg-red-50 text-red-800" : messageType === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : messageType === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-blue-200 bg-blue-50 text-blue-900"}`}>
            {message}
          </div>
        )}

        {step === 0 && (
          <section className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            <article className="rounded-3xl border border-[#d7e5f2] bg-white p-6 shadow-sm sm:p-7">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0b8f58]">Como responder</p>
              <h3 className="mt-2 text-2xl font-black text-[#003b70]">Avaliação estruturada por competências</h3>
              <p className="mt-4 leading-7 text-slate-600">Cada competência possui três comportamentos observáveis e uma avaliação do nível de desenvolvimento.</p>

              <div className="mt-6 space-y-4">
                <div className="rounded-2xl bg-blue-50 p-5">
                  <strong className="text-[#003b70]">Escala de comportamentos</strong>
                  <p className="mt-2 text-sm leading-6 text-slate-600">1 — Nunca · 2 — Raramente · 3 — Às vezes · 4 — Frequentemente · 5 — Sempre</p>
                </div>
                <div className="rounded-2xl bg-emerald-50 p-5">
                  <strong className="text-emerald-900">Nível de desenvolvimento</strong>
                  <p className="mt-2 text-sm leading-6 text-slate-600">1 — Inicial · 2 — Em desenvolvimento · 3 — Proficiente · 4 — Avançado · 5 — Referência</p>
                </div>
              </div>

              <details className="mt-5 rounded-2xl border border-[#d7e5f2] p-5">
                <summary className="cursor-pointer font-black text-[#003b70]">Ver descrição dos níveis</summary>
                <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                  <p><b>Inicial:</b> compreensão limitada e necessidade frequente de orientação.</p>
                  <p><b>Em desenvolvimento:</b> aplicação básica em situações conhecidas, com apoio ocasional.</p>
                  <p><b>Proficiente:</b> aplicação consistente, autônoma e segura na maioria das situações.</p>
                  <p><b>Avançado:</b> elevado domínio, inclusive em situações complexas, contribuindo para a equipe.</p>
                  <p><b>Referência:</b> excelência, compartilhamento de conhecimento e influência de boas práticas.</p>
                </div>
              </details>
            </article>

            <aside className="rounded-3xl border border-[#d7e5f2] bg-white p-6 shadow-sm sm:p-7">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0b8f58]">Situação do ciclo</p>
              <dl className="mt-5 space-y-5 text-sm">
                <div><dt className="text-slate-500">Status</dt><dd className="mt-1 font-black text-[#003b70]">{definition.application.status === "OPEN" ? "Aberto" : "Encerrado"}</dd></div>
                <div><dt className="text-slate-500">Abertura</dt><dd className="mt-1 font-black text-[#003b70]">{dateLabel(definition.application.opensAt)}</dd></div>
                <div><dt className="text-slate-500">Encerramento</dt><dd className="mt-1 font-black text-[#003b70]">{dateLabel(definition.application.closesAt)}</dd></div>
                <div><dt className="text-slate-500">Competências</dt><dd className="mt-1 font-black text-[#003b70]">{sections.filter((section) => section.code !== "FINAL").length}</dd></div>
                <div><dt className="text-slate-500">Salvamento</dt><dd className="mt-1 font-black text-[#003b70]">{savedAt ? `Último registro: ${dateLabel(savedAt)}` : canEdit ? "Automático no sistema" : "Indisponível"}</dd></div>
              </dl>
            </aside>
          </section>
        )}

        {currentSection && (
          <section className="mt-5 rounded-3xl border border-[#d7e5f2] bg-white p-5 shadow-sm sm:p-8">
            <div className="space-y-9">
              {currentSection.questions.map((question, questionIndex) => (
                <fieldset key={question.id} className="border-b border-slate-100 pb-9 last:border-0 last:pb-0" disabled={!canEdit}>
                  <legend className="text-base font-black leading-7 text-[#003b70] sm:text-lg">
                    {questionIndex + 1}. {question.title}{question.required && <span className="text-red-600"> *</span>}
                  </legend>
                  {question.description && <p className="mt-2 text-sm leading-6 text-slate-500">{question.description}</p>}

                  {question.type === "SCALE" && (
                    <div className="mt-5 grid gap-3 sm:grid-cols-5">
                      {question.options.map((option) => {
                        const selected = answers[question.id]?.optionId === option.id || answers[question.id]?.value === option.value;
                        return (
                          <label key={option.id} className={`cursor-pointer rounded-2xl border p-4 text-center transition ${selected ? "border-[#0d6efd] bg-blue-50 shadow-md" : "border-slate-200 bg-white hover:border-blue-300"} ${!canEdit ? "cursor-default" : ""}`}>
                            <input
                              type="radio"
                              name={question.id}
                              value={option.id}
                              checked={selected}
                              onChange={() => updateScale(question, option)}
                              className="sr-only"
                            />
                            <span className={`mx-auto grid h-11 w-11 place-items-center rounded-full text-lg font-black ${selected ? "bg-[#003b70] text-white" : "bg-slate-100 text-[#003b70]"}`}>{option.value}</span>
                            <strong className="mt-3 block text-sm leading-5 text-slate-700">{option.label}</strong>
                          </label>
                        );
                      })}
                      <div className="sm:col-span-5 flex justify-between text-xs font-bold text-slate-500">
                        <span>{scaleBoundary(question, "start")}</span>
                        <span>{scaleBoundary(question, "end")}</span>
                      </div>
                    </div>
                  )}

                  {(question.type === "LONG_TEXT" || question.type === "SHORT_TEXT") && (
                    <div className="mt-4">
                      <textarea
                        value={answers[question.id]?.value ?? ""}
                        onChange={(event) => updateText(question, event.target.value)}
                        rows={question.type === "LONG_TEXT" ? 6 : 3}
                        maxLength={12000}
                        className="w-full rounded-2xl border border-slate-300 bg-white p-4 leading-7 text-slate-800 outline-none transition focus:border-[#0d6efd] focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-600"
                        placeholder="Digite sua resposta..."
                      />
                      <p className="mt-2 text-right text-xs font-bold text-slate-400">{answers[question.id]?.value.length ?? 0}/12000</p>
                    </div>
                  )}
                </fieldset>
              ))}
            </div>
          </section>
        )}

        {step === totalSteps - 1 && (
          <section className="mt-5 rounded-3xl border border-[#d7e5f2] bg-white p-6 shadow-sm sm:p-8">
            <div className="grid gap-4 md:grid-cols-2">
              {sections.map((section, index) => {
                const completion = sectionCompletion(section, answers);
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => goToStep(index + 1, false)}
                    className="rounded-2xl border border-[#d7e5f2] bg-slate-50 p-5 text-left transition hover:border-[#0d6efd] hover:bg-blue-50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <strong className="text-[#003b70]">{section.title}</strong>
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${completion === 100 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{completion}%</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">{section.questions.length} pergunta(s)</p>
                  </button>
                );
              })}
            </div>

            <div className={`mt-6 rounded-2xl border p-5 ${isSubmitted ? "border-emerald-200 bg-emerald-50" : canEdit ? "border-blue-200 bg-blue-50" : "border-amber-200 bg-amber-50"}`}>
              <strong className={isSubmitted ? "text-emerald-900" : canEdit ? "text-[#003b70]" : "text-amber-900"}>
                {isSubmitted ? "Avaliação concluída" : canEdit ? "Confirmação do envio" : "Período encerrado"}
              </strong>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {isSubmitted
                  ? `Enviada em ${dateLabel(submission?.submission?.submittedAt)}. As respostas estão bloqueadas para alteração.`
                  : canEdit
                    ? "Confira todas as etapas. Após o envio definitivo, as respostas não poderão ser alteradas."
                    : "Não é possível criar ou alterar respostas enquanto o ciclo estiver encerrado."}
              </p>
              {canEdit && (
                <button
                  type="button"
                  onClick={submitEvaluation}
                  disabled={submitting || answeredRequired !== requiredQuestions.length || saveState === "saving"}
                  className="mt-5 w-full rounded-xl bg-[#003b70] px-5 py-4 font-black text-white shadow-lg transition hover:bg-[#075ea8] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? "Enviando avaliação..." : "Confirmar e enviar autoavaliação"}
                </button>
              )}
            </div>
          </section>
        )}

        <footer className="sticky bottom-0 mt-6 flex items-center justify-between gap-3 rounded-2xl border border-[#d7e5f2] bg-white/95 p-4 shadow-xl backdrop-blur">
          <div className="hidden text-xs font-bold text-slate-500 sm:block">
            {saveState === "saving" ? "Salvando resposta..." : saveState === "error" ? "Falha ao salvar" : savedAt ? `Salvo no sistema em ${dateLabel(savedAt)}` : canEdit ? "Salvamento automático ativo" : "Modo somente leitura"}
          </div>
          <div className="ml-auto flex gap-3">
            <button type="button" onClick={() => goToStep(step - 1, false)} disabled={step === 0} className="rounded-xl border border-[#d7e5f2] bg-white px-5 py-3 font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">Anterior</button>
            <button type="button" onClick={() => goToStep(step + 1, true)} disabled={step === totalSteps - 1} className="rounded-xl bg-[#003b70] px-5 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-40">Próxima etapa</button>
          </div>
        </footer>
      </div>
    </main>
  );
}
