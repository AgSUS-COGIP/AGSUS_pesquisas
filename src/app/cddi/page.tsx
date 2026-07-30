"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  validation: Record<string, unknown>;
  displayLogic: Record<string, unknown>;
  scoring: Record<string, unknown>;
  settings: Record<string, unknown>;
  options: Option[];
};

type Section = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  position: number;
  settings: Record<string, unknown>;
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
    allowDrafts: boolean;
    settings: Record<string, unknown>;
  };
  survey: {
    id: string;
    code: string;
    name: string;
    description: string | null;
  };
  version: {
    id: string;
    number: number;
    title: string;
    description: string | null;
    settings: Record<string, unknown>;
  };
  sections: Section[];
};

type Answers = Record<string, string>;

const DRAFT_KEY = "agsus-pesquisas:cddi-2026:preview-draft";

function questionIsAnswered(question: Question, answers: Answers) {
  return Boolean(answers[question.id]?.trim());
}

function sectionCompletion(section: Section, answers: Answers) {
  if (!section.questions.length) return 100;
  const answered = section.questions.filter((question) => questionIsAnswered(question, answers)).length;
  return Math.round((answered / section.questions.length) * 100);
}

function dateLabel(value: string | null) {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

export default function CddiFormPage() {
  const [definition, setDefinition] = useState<FormDefinition | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createBrowserSupabaseClient();
        const { data, error } = await supabase.rpc("get_public_survey_form", {
          target_application_code: "CDDI-2026",
        });

        if (error) throw error;
        if (!data) throw new Error("A definição do CDDI 2026 não foi encontrada.");

        setDefinition(data as FormDefinition);

        const saved = sessionStorage.getItem(DRAFT_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as { answers?: Answers; step?: number; savedAt?: string };
          setAnswers(parsed.answers ?? {});
          setStep(Number.isInteger(parsed.step) ? Number(parsed.step) : 0);
          setDraftSavedAt(parsed.savedAt ?? null);
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Não foi possível carregar o formulário.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  useEffect(() => {
    if (!definition) return;
    const timeout = window.setTimeout(() => {
      const savedAt = new Date().toISOString();
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ answers, step, savedAt }));
      setDraftSavedAt(savedAt);
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [answers, definition, step]);

  const sections = definition?.sections ?? [];
  const totalSteps = sections.length + 2;
  const currentSection = step > 0 && step <= sections.length ? sections[step - 1] : null;
  const requiredQuestions = useMemo(
    () => sections.flatMap((section) => section.questions).filter((question) => question.required),
    [sections],
  );
  const answeredRequired = requiredQuestions.filter((question) => questionIsAnswered(question, answers)).length;
  const progress = requiredQuestions.length
    ? Math.round((answeredRequired / requiredQuestions.length) * 100)
    : 0;

  function updateAnswer(questionId: string, value: string) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
    setMessage("");
  }

  function validateCurrentStep() {
    if (!currentSection) return true;
    const missing = currentSection.questions.filter(
      (question) => question.required && !questionIsAnswered(question, answers),
    );

    if (missing.length > 0) {
      setMessage(`Preencha ${missing.length} pergunta(s) obrigatória(s) antes de continuar.`);
      return false;
    }
    return true;
  }

  function nextStep() {
    if (!validateCurrentStep()) return;
    setStep((current) => Math.min(current + 1, totalSteps - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function previousStep() {
    setMessage("");
    setStep((current) => Math.max(current - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function clearDraft() {
    sessionStorage.removeItem(DRAFT_KEY);
    setAnswers({});
    setStep(0);
    setDraftSavedAt(null);
    setMessage("Rascunho local removido.");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-white p-8 text-center shadow-xl">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-t-[var(--primary)]" />
          <h1 className="mt-5 text-xl font-black text-[var(--primary-dark)]">Carregando CDDI 2026</h1>
          <p className="mt-2 text-sm text-slate-600">Preparando competências, perguntas e escalas.</p>
        </div>
      </main>
    );
  }

  if (!definition) {
    return (
      <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
        <div className="rounded-3xl border border-red-200 bg-white p-8 shadow-lg">
          <p className="text-sm font-black uppercase tracking-wider text-red-700">Falha ao carregar</p>
          <h1 className="mt-2 text-2xl font-black text-[var(--primary-dark)]">Formulário indisponível</h1>
          <p className="mt-4 text-slate-600">{message}</p>
          <Link href="/" className="mt-6 inline-flex rounded-xl bg-[var(--primary)] px-5 py-3 font-bold text-white">
            Voltar ao início
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col bg-[#102c4c] px-5 py-6 text-white lg:flex">
        <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">AgSUS</p>
          <h1 className="mt-1 text-xl font-black">Pesquisas e Avaliações</h1>
          <p className="mt-2 text-sm text-blue-100">Ciclo de Devolutivas e Desenvolvimento Individual</p>
        </div>

        <nav className="mt-6 space-y-2">
          <Link href="/" className="block rounded-xl px-4 py-3 text-sm font-bold text-blue-100 hover:bg-white/10">Início</Link>
          <span className="block rounded-xl bg-white px-4 py-3 text-sm font-black text-[#102c4c]">Responder CDDI 2026</span>
          <span className="block rounded-xl px-4 py-3 text-sm font-bold text-blue-200 opacity-60">Minha equipe</span>
          <span className="block rounded-xl px-4 py-3 text-sm font-bold text-blue-200 opacity-60">Meus resultados</span>
        </nav>

        <div className="mt-auto rounded-2xl border border-white/15 p-4 text-xs leading-5 text-blue-100">
          <strong className="block text-white">Modo de demonstração</strong>
          O formulário já utiliza as perguntas cadastradas no Supabase. A identificação e o envio serão conectados na próxima etapa.
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-white/95 px-5 py-4 shadow-sm backdrop-blur lg:px-8">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--success)]">CDDI 2026</p>
              <h2 className="text-xl font-black text-[var(--primary-dark)]">{definition.application.name}</h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden rounded-full border border-[var(--border)] bg-slate-50 px-4 py-2 text-xs font-bold text-slate-600 sm:inline-flex">
                {progress}% preenchido
              </span>
              <button type="button" onClick={clearDraft} className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-bold text-slate-700">
                Limpar rascunho
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <section className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-sm font-black text-[var(--primary)]">
                  {step === 0 ? "Orientações" : step === totalSteps - 1 ? "Revisão final" : `Competência ${step} de ${sections.length}`}
                </p>
                <h3 className="mt-1 text-2xl font-black text-[var(--primary-dark)]">
                  {step === 0 ? "Antes de começar" : step === totalSteps - 1 ? "Confira suas respostas" : currentSection?.title}
                </h3>
              </div>
              <span className="rounded-full bg-blue-50 px-4 py-2 text-xs font-black text-[var(--primary)]">
                Etapa {step + 1} de {totalSteps}
              </span>
            </div>

            <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--success)] transition-all" style={{ width: `${((step + 1) / totalSteps) * 100}%` }} />
            </div>

            <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
              {Array.from({ length: totalSteps }).map((_, index) => {
                const completed = index > 0 && index <= sections.length
                  ? sectionCompletion(sections[index - 1], answers) === 100
                  : index < step;
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setStep(index)}
                    className={`min-w-10 rounded-full px-3 py-2 text-xs font-black ${index === step ? "bg-[var(--primary)] text-white" : completed ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}
                  >
                    {index === 0 ? "Início" : index === totalSteps - 1 ? "Revisão" : index}
                  </button>
                );
              })}
            </div>
          </section>

          {message && (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">
              {message}
            </div>
          )}

          {step === 0 && (
            <section className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
              <article className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-sm">
                <p className="text-sm font-black uppercase tracking-wider text-[var(--primary)]">Sobre o ciclo</p>
                <h3 className="mt-2 text-3xl font-black text-[var(--primary-dark)]">Avaliação estruturada por competências</h3>
                <p className="mt-4 leading-7 text-slate-600">
                  Responda aos três comportamentos de cada competência e avalie o nível de desenvolvimento. A escala varia de 1 a 5.
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-blue-50 p-4">
                    <strong className="text-[var(--primary-dark)]">Comportamentos</strong>
                    <p className="mt-2 text-sm leading-6 text-slate-600">1 Nunca · 2 Raramente · 3 Às vezes · 4 Frequentemente · 5 Sempre</p>
                  </div>
                  <div className="rounded-2xl bg-emerald-50 p-4">
                    <strong className="text-emerald-900">Nível de desenvolvimento</strong>
                    <p className="mt-2 text-sm leading-6 text-slate-600">1 Inicial · 2 Em desenvolvimento · 3 Proficiente · 4 Avançado · 5 Referência</p>
                  </div>
                </div>
              </article>

              <aside className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-sm">
                <p className="text-sm font-black uppercase tracking-wider text-[var(--success)]">Ciclo cadastrado</p>
                <dl className="mt-4 space-y-4 text-sm">
                  <div><dt className="text-slate-500">Abertura</dt><dd className="font-black text-[var(--primary-dark)]">{dateLabel(definition.application.opensAt)}</dd></div>
                  <div><dt className="text-slate-500">Encerramento</dt><dd className="font-black text-[var(--primary-dark)]">{dateLabel(definition.application.closesAt)}</dd></div>
                  <div><dt className="text-slate-500">Competências</dt><dd className="font-black text-[var(--primary-dark)]">{sections.filter((section) => section.code !== "FINAL").length}</dd></div>
                  <div><dt className="text-slate-500">Rascunho local</dt><dd className="font-black text-[var(--primary-dark)]">{draftSavedAt ? `Salvo em ${dateLabel(draftSavedAt)}` : "Será salvo automaticamente"}</dd></div>
                </dl>
              </aside>
            </section>
          )}

          {currentSection && (
            <section className="mt-5 rounded-3xl border border-[var(--border)] bg-white p-5 shadow-sm sm:p-7">
              {currentSection.description && (
                <div className="mb-6 rounded-2xl border-l-4 border-[var(--primary)] bg-slate-50 p-5 leading-7 text-slate-700">
                  {currentSection.description}
                </div>
              )}

              <div className="space-y-8">
                {currentSection.questions.map((question, questionIndex) => (
                  <fieldset key={question.id} className="border-b border-slate-100 pb-8 last:border-0 last:pb-0">
                    <legend className="text-base font-black leading-7 text-[var(--primary-dark)]">
                      {questionIndex + 1}. {question.title}{question.required && <span className="text-red-600"> *</span>}
                    </legend>
                    {question.description && <p className="mt-2 text-sm leading-6 text-slate-500">{question.description}</p>}

                    {question.type === "SCALE" && (
                      <div className="mt-4">
                        <div className="grid grid-cols-5 gap-2 sm:gap-3">
                          {question.options.map((option) => (
                            <label key={option.id} className="relative cursor-pointer">
                              <input
                                type="radio"
                                name={question.id}
                                value={option.value}
                                checked={answers[question.id] === option.value}
                                onChange={(event) => updateAnswer(question.id, event.target.value)}
                                className="peer sr-only"
                              />
                              <span className="flex min-h-14 items-center justify-center rounded-xl border border-slate-300 bg-white text-lg font-black text-[var(--primary-dark)] transition peer-checked:border-[var(--primary)] peer-checked:bg-[var(--primary)] peer-checked:text-white peer-focus-visible:ring-4 peer-focus-visible:ring-blue-100">
                                {option.value}
                              </span>
                            </label>
                          ))}
                        </div>
                        <div className="mt-2 flex justify-between text-xs font-bold text-slate-500">
                          <span>{String(question.settings?.scale_start_label ?? "Nunca")}</span>
                          <span>{String(question.settings?.scale_end_label ?? "Sempre")}</span>
                        </div>
                      </div>
                    )}

                    {question.type === "LONG_TEXT" && (
                      <textarea
                        value={answers[question.id] ?? ""}
                        onChange={(event) => updateAnswer(question.id, event.target.value)}
                        rows={6}
                        maxLength={12000}
                        className="mt-4 w-full rounded-2xl border border-slate-300 bg-white p-4 leading-7 text-slate-800 outline-none transition focus:border-[var(--primary)] focus:ring-4 focus:ring-blue-100"
                        placeholder="Digite sua resposta..."
                      />
                    )}
                  </fieldset>
                ))}
              </div>
            </section>
          )}

          {step === totalSteps - 1 && (
            <section className="mt-5 rounded-3xl border border-[var(--border)] bg-white p-6 shadow-sm">
              <div className="grid gap-4 md:grid-cols-2">
                {sections.map((section, index) => {
                  const completion = sectionCompletion(section, answers);
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => setStep(index + 1)}
                      className="rounded-2xl border border-[var(--border)] bg-slate-50 p-5 text-left transition hover:border-[var(--primary)] hover:bg-blue-50"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <strong className="text-[var(--primary-dark)]">{section.title}</strong>
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${completion === 100 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                          {completion}%
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-500">{section.questions.length} pergunta(s)</p>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5">
                <strong className="text-[var(--primary-dark)]">Envio ainda não habilitado</strong>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Esta primeira versão comprova a leitura dinâmica do formulário e a experiência guiada. O envio será habilitado junto com login institucional, identificação do participante e regras de autoavaliação ou chefia.
                </p>
              </div>
            </section>
          )}

          <footer className="sticky bottom-0 mt-6 flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-white/95 p-4 shadow-xl backdrop-blur">
            <div className="hidden text-xs font-bold text-slate-500 sm:block">
              {draftSavedAt ? `Rascunho salvo em ${dateLabel(draftSavedAt)}` : "Rascunho automático ativo"}
            </div>
            <div className="ml-auto flex gap-3">
              <button type="button" onClick={previousStep} disabled={step === 0} className="rounded-xl border border-[var(--border)] bg-white px-5 py-3 font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">
                Anterior
              </button>
              <button type="button" onClick={nextStep} disabled={step === totalSteps - 1} className="rounded-xl bg-[var(--primary)] px-5 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-40">
                Próxima etapa
              </button>
            </div>
          </footer>
        </div>
      </div>
    </main>
  );
}
