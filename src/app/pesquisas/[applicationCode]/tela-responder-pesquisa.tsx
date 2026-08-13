"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, FileText, Hourglass, Lock, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { CompletionCelebration } from "@/components/completion-celebration";
import { PlatformGuardState } from "@/components/platform-guard-state";
import { useConfirm } from "@/components/confirmation-provider";
import { FullPageState } from "@/components/full-page-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePlatformGuard } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";
import { buildSurveyAnswerPayload, isSurveyAnswerComplete, restoreSurveyAnswer, type StoredSurveyAnswer, type SurveyAnswerValue } from "@/lib/survey-runtime";
import { buildSurveyRuleContext, normalizeSurveyRules, visibleSurveySections, type SurveyRule } from "@/lib/survey-conditional-logic";
import { SurveyBanner } from "@/components/survey-banner";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { DEFAULT_CDDI_VISUAL_IDENTITY, resolveSurveyVisualIdentity } from "@/lib/survey-visual-identity";

type Option = { id: string; label: string; value: string };
type Question = { id: string; title: string; description: string | null; type: string; required: boolean; options: Option[] };
type Section = { id: string; title: string; description: string | null; questions: Question[] };
type Definition = {
  // `settings` carrega a identidade visual configurada para o ciclo — sem ele,
  // capa, título e subtítulo personalizados nunca chegam ao instrumento.
  application: { name: string; status: string; settings?: unknown };
  survey: { code: string; name: string; description: string | null };
  sections: Section[];
};
type SubmissionContext = {
  canEdit: boolean;
  submission: { id: string; status: string; submittedAt: string | null } | null;
  answers: Record<string, StoredSurveyAnswer>;
};
type Answers = Record<string, SurveyAnswerValue>;

/** Campos de texto, data e número compartilham o mesmo tratamento visual. */
const FIELD_CLASS = "mt-4 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--control-bg)] px-4 py-3 text-sm font-medium text-[var(--text-primary)] shadow-sm outline-none transition hover:border-[var(--border-strong)] focus:border-[var(--focus-ring)] focus:ring-4 focus:ring-sky-300/15 disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)]";

/** Cartão de alternativa: o estado selecionado não depende só da cor — ganha anel e peso. */
function choiceClass(selected: boolean) {
  return `flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-sky-300/25 ${
    selected
      ? "border-[var(--focus-ring)] bg-[var(--status-info-bg)] font-semibold text-[var(--status-info-text)] ring-1 ring-inset ring-[var(--status-info-border)]"
      : "border-[var(--border-subtle)] bg-[var(--surface-card)] font-medium text-[var(--text-primary)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
  }`;
}

export default function GenericSurveyPage() {
  const confirm = useConfirm();
  const params = useParams<{ applicationCode: string }>();
  const applicationCode = decodeURIComponent(params.applicationCode);
  const guard = usePlatformGuard(PLATFORM_MODULE.SURVEYS);
  const granted = guard.state === "granted";
  const [definition, setDefinition] = useState<Definition | null>(null);
  const [rules, setRules] = useState<SurveyRule[]>([]);
  const [submission, setSubmission] = useState<SubmissionContext | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [loading, setLoading] = useState(true);
  const [pendingSaves, setPendingSaves] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [step, setStep] = useState(0);
  const timers = useRef<Record<string, number>>({});
  const latestAnswers = useRef<Answers>({});
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const formTopRef = useRef<HTMLElement>(null);

  useEffect(() => {
    latestAnswers.current = answers;
  }, [answers]);

  useEffect(() => {
    if (!granted) return;
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const supabase = createBrowserSupabaseClient();
        const [formResponse, submissionResponse, rulesResponse] = await Promise.all([
          supabase.rpc("get_public_survey_form", { target_application_code: applicationCode }),
          supabase.rpc("start_or_resume_my_survey_submission", { target_application_code: applicationCode }),
          supabase.rpc("fc_obter_regras_do_ciclo", { p_codigo_ciclo: applicationCode }),
        ]);
        if (formResponse.error) throw formResponse.error;
        if (submissionResponse.error) throw submissionResponse.error;
        // Falha ao ler as regras não impede responder: sem regra, o instrumento
        // aparece inteiro, que é como ele se comportava antes de existir lógica
        // condicional. Esconder por engano seria pior do que mostrar demais.
        if (rulesResponse.error) console.warn("Lógica condicional indisponível:", rulesResponse.error.message);
        if (!formResponse.data) throw new Error("A avaliação ainda não está publicada.");

        const restored: Answers = {};
        const resolvedSubmission = submissionResponse.data as SubmissionContext;
        Object.entries(resolvedSubmission.answers ?? {}).forEach(([questionId, value]) => {
          restored[questionId] = restoreSurveyAnswer(value);
        });

        if (!active) return;
        latestAnswers.current = restored;
        setDefinition(formResponse.data as Definition);
        setRules(rulesResponse.error ? [] : normalizeSurveyRules(rulesResponse.data));
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
  }, [applicationCode, granted]);

  const allSections = useMemo(() => definition?.sections ?? [], [definition?.sections]);
  /**
   * Etapas efetivamente aplicáveis a esta pessoa, já filtradas pela lógica
   * condicional. Recalcula a cada resposta: marcar uma alternativa pode revelar
   * ou retirar perguntas e até etapas inteiras.
   *
   * O mesmo filtro roda no banco, dentro de `submit_my_survey_submission` — o
   * que a tela esconde é exatamente o que deixa de ser exigido no envio.
   */
  const sections = useMemo(
    () => visibleSurveySections(allSections, buildSurveyRuleContext(allSections, rules, answers)),
    [allSections, rules, answers],
  );
  // Indexa **todas** as perguntas, não só as visíveis: `flushPendingSaves()`
  // precisa gravar o que estava em debounce mesmo que a resposta anterior tenha
  // acabado de esconder o campo, senão o texto digitado se perde em silêncio.
  const questionsById = useMemo(() => new Map(allSections.flatMap((section) => section.questions).map((question) => [question.id, question])), [allSections]);
  // Uma resposta pode remover a etapa em que a pessoa está. Sem o limite, `step`
  // apontaria para uma seção inexistente e a tela ficaria em branco.
  const currentStep = Math.min(step, Math.max(0, sections.length - 1));
  const currentSection = sections[currentStep];
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
      toast.warning(`Preencha ${missing.length} ${missing.length === 1 ? "pergunta obrigatória" : "perguntas obrigatórias"} desta etapa.`);
      return false;
    }
    return true;
  }

  function goToStep(target: number) {
    setStep(Math.max(0, Math.min(target, sections.length - 1)));
    window.requestAnimationFrame(() => formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  /**
   * Última etapa alcançável pelos atalhos do topo.
   *
   * O botão "Próxima" sempre validou a etapa atual, mas os atalhos numerados não
   * validavam nada: dava para pular da etapa 1 para a 3 deixando obrigatórias
   * para trás. Nenhum dado inválido chegava ao banco — o envio continua barrado —,
   * só que a pessoa descobria a pendência no fim, sem saber de onde ela veio.
   *
   * Voltar continua livre: revisar o que já foi respondido não exige validação.
   */
  const firstIncompleteStep = useMemo(() => {
    if (!canEdit) return sections.length - 1;
    const incomplete = sections.findIndex((section) =>
      section.questions.some((question) => question.required && !isSurveyAnswerComplete(question.type, answers[question.id])),
    );
    return incomplete === -1 ? sections.length - 1 : incomplete;
  }, [sections, answers, canEdit]);

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
      setCelebrate(true);
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "Não foi possível enviar a avaliação.");
    } finally {
      setSubmitting(false);
    }
  }

  if (guard.state !== "granted") {
    return <PlatformGuardState
      guard={guard}
      title="avaliação"
      restrictedTitle="Módulo indisponível"
      restrictedDescription="Seu perfil não possui acesso ao módulo de avaliações."
    />;
  }
  if (loading) return <PlatformSkeleton title="Abrindo avaliação" />;
  if (!definition) return (
    <FullPageState
      title="Avaliação indisponível"
      description="O instrumento não está publicado ou você não possui acesso a ele."
      actionHref="/pesquisas"
      actionLabel="Voltar ao catálogo"
    />
  );

  const periodOpen = definition.application.status === "OPEN";
  // A identidade configurada em /admin/pesquisas/[id]/identidade vale para
  // qualquer instrumento, não só para o CDDI: o fallback é o nome do ciclo e a
  // descrição da pesquisa, que é o que a tela já mostrava.
  const visualIdentity = resolveSurveyVisualIdentity(definition.application.settings, {
    ...DEFAULT_CDDI_VISUAL_IDENTITY,
    bannerAlt: definition.application.name,
    heroTitle: definition.application.name,
    heroSubtitle: definition.survey.description || "Instrumento institucional de avaliação.",
  });
  const missingInSection = currentSection
    ? currentSection.questions.filter((question) => question.required && !isSurveyAnswerComplete(question.type, answers[question.id])).length
    : 0;

  return (
    <PlatformShell user={guard.user} focus exitHref="/pesquisas" eyebrow={definition.survey.code} title={definition.application.name}>
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <section className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--shadow-card)]">
          {visualIdentity.themeVariant === "CUSTOM" ? (
            <SurveyBanner
              key={visualIdentity.bannerUrl}
              src={visualIdentity.bannerUrl}
              fallbackSrc={DEFAULT_CDDI_VISUAL_IDENTITY.bannerUrl}
              alt={visualIdentity.bannerAlt}
              className="h-auto max-h-52 w-full object-cover"
            />
          ) : null}
          <div className="grid gap-4 p-6 lg:grid-cols-[1fr_auto] lg:items-start lg:p-7">
            <div className="min-w-0">
              <p className="break-words text-xs font-semibold uppercase tracking-[.14em] text-[var(--brand-secondary)]">{definition.survey.name}</p>
              <h2 className="mt-1.5 break-words text-2xl font-semibold leading-tight tracking-tight text-[var(--text-primary)] sm:text-3xl">{visualIdentity.heroTitle}</h2>
              <p className="mt-3 max-w-3xl whitespace-pre-line break-words text-sm leading-7 text-[var(--text-secondary)]">{visualIdentity.heroSubtitle}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={periodOpen ? "success" : "neutral"}>{periodOpen ? "Período aberto" : "Período encerrado"}</Badge>
              {isSubmitted && <Badge variant="info"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />Enviada</Badge>}
            </div>
          </div>
          <div className="h-1 bg-[linear-gradient(90deg,#003b70,#0b8f58,#f2b705,#d92d3a,#00a8d6)]" aria-hidden="true" />
        </section>

        {!canEdit && (
          <p role="status" className="flex items-start gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 text-sm leading-6 text-[var(--text-secondary)]">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {isSubmitted
                ? <><strong className="font-semibold text-[var(--text-primary)]">Avaliação enviada.</strong> Suas respostas ficaram registradas e não podem mais ser alteradas.</>
                : <><strong className="font-semibold text-[var(--text-primary)]">Somente leitura.</strong> Este ciclo não aceita novas respostas no momento.</>}
            </span>
          </p>
        )}

        <section ref={formTopRef} className="scroll-mt-24 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <strong className="text-sm font-semibold text-[var(--text-primary)]">Progresso</strong>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">{answeredRequired} de {requiredQuestions.length} obrigatórias respondidas</p>
            </div>
            <span className="text-2xl font-semibold text-[var(--brand-primary)]">{progress}%</span>
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
          <nav aria-label="Etapas da avaliação" className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {sections.map((section, index) => {
              const current = index === currentStep;
              const locked = index > firstIncompleteStep;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => goToStep(index)}
                  disabled={locked}
                  title={locked ? `Responda as obrigatórias da etapa ${firstIncompleteStep + 1} para liberar esta` : section.title}
                  aria-current={current ? "step" : undefined}
                  className={`max-w-60 shrink-0 truncate rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    current
                      ? "bg-[var(--brand-solid)] text-[var(--text-on-brand)]"
                      : locked
                        ? "cursor-not-allowed bg-[var(--surface-muted)] text-[var(--text-secondary)] opacity-50"
                        : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {index + 1}. {section.title}
                </button>
              );
            })}
          </nav>
        </section>

        {currentSection && (
          <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--shadow-card)] sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--brand-secondary)]">Etapa {currentStep + 1} de {sections.length}</p>
            <h3 className="mt-1.5 break-words text-xl font-semibold leading-snug tracking-tight text-[var(--text-primary)] sm:text-2xl">{currentSection.title}</h3>
            {currentSection.description && <p className="mt-3 whitespace-pre-line break-words text-sm leading-7 text-[var(--text-secondary)]">{currentSection.description}</p>}

            <div className="mt-7 space-y-8">
              {currentSection.questions.map((question) => {
                const value = answers[question.id] ?? {};
                return (
                  <fieldset key={question.id} disabled={!canEdit} className="min-w-0">
                    <legend className="block w-full whitespace-pre-line break-words text-sm font-semibold leading-relaxed text-[var(--text-primary)]">
                      {question.title}
                      {question.required && <span className="text-red-700" title="Resposta obrigatória"> *</span>}
                    </legend>
                    {question.description && <p className="mt-1 whitespace-pre-line break-words text-sm leading-6 text-[var(--text-secondary)]">{question.description}</p>}

                    {["SCALE", "SINGLE_CHOICE"].includes(question.type) && (
                      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {question.options.map((option) => {
                          const selected = value.optionIds?.includes(option.id) ?? false;
                          return (
                            <label key={option.id} className={choiceClass(selected)}>
                              <input
                                type="radio"
                                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--brand-primary)]"
                                name={question.id}
                                checked={selected}
                                onChange={() => update(question, { optionIds: [option.id] })}
                              />
                              <span className="min-w-0 break-words">{option.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {question.type === "MULTIPLE_CHOICE" && (
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {question.options.map((option) => {
                          const selected = value.optionIds?.includes(option.id) ?? false;
                          return (
                            <label key={option.id} className={choiceClass(selected)}>
                              <input
                                type="checkbox"
                                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--brand-primary)]"
                                checked={selected}
                                onChange={() => {
                                  const current = value.optionIds ?? [];
                                  update(question, { optionIds: selected ? current.filter((id) => id !== option.id) : [...current, option.id] });
                                }}
                              />
                              <span className="min-w-0 break-words">{option.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {question.type === "BOOLEAN" && (
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        {([{ value: true, label: "Sim" }, { value: false, label: "Não" }] as const).map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            aria-pressed={value.boolean === item.value}
                            onClick={() => update(question, { boolean: item.value })}
                            className={`min-h-12 rounded-xl border text-sm transition ${
                              value.boolean === item.value
                                ? "border-[var(--focus-ring)] bg-[var(--status-info-bg)] font-semibold text-[var(--status-info-text)] ring-1 ring-inset ring-[var(--status-info-border)]"
                                : "border-[var(--border-subtle)] bg-[var(--surface-card)] font-medium text-[var(--text-primary)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {["INTEGER", "DECIMAL"].includes(question.type) && (
                      <input
                        type="number"
                        inputMode={question.type === "INTEGER" ? "numeric" : "decimal"}
                        step={question.type === "INTEGER" ? 1 : "any"}
                        value={value.number ?? ""}
                        onChange={(event) => { const rawValue = event.target.value; update(question, { number: rawValue === "" ? undefined : Number(rawValue) }, 500); }}
                        className={FIELD_CLASS}
                      />
                    )}

                    {question.type === "DATE" && (
                      <input type="date" value={value.date ?? ""} onChange={(event) => update(question, { date: event.target.value || undefined })} className={FIELD_CLASS} />
                    )}

                    {question.type === "DATETIME" && (
                      <input type="datetime-local" value={value.datetime ?? ""} onChange={(event) => update(question, { datetime: event.target.value || undefined })} className={FIELD_CLASS} />
                    )}

                    {["SHORT_TEXT", "LONG_TEXT"].includes(question.type) && (question.type === "LONG_TEXT"
                      ? <textarea rows={6} maxLength={12000} value={value.text ?? ""} onChange={(event) => update(question, { text: event.target.value }, 700)} className={`${FIELD_CLASS} resize-y leading-6`} />
                      : <input maxLength={12000} value={value.text ?? ""} onChange={(event) => update(question, { text: event.target.value }, 700)} className={FIELD_CLASS} />)}
                  </fieldset>
                );
              })}
            </div>
          </section>
        )}

        <footer className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-card)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p role="status" className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              {saving
                ? <><Hourglass className="h-4 w-4 animate-pulse" aria-hidden="true" />Salvando {pendingSaves > 1 ? `${pendingSaves} alterações` : "alteração"}...</>
                : <><Save className="h-4 w-4" aria-hidden="true" />{canEdit ? "Todas as respostas foram salvas automaticamente" : isSubmitted ? "Envio concluído" : "Somente leitura"}</>}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Link
                href="/pesquisas"
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
              >
                <FileText className="h-4 w-4" aria-hidden="true" />
                Catálogo
              </Link>
              <Button variant="secondary" onClick={() => goToStep(currentStep - 1)} disabled={currentStep === 0 || submitting}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Anterior
              </Button>
              {currentStep < sections.length - 1 ? (
                <Button
                  onClick={() => { if (validateCurrentSection()) goToStep(currentStep + 1); }}
                  disabled={submitting}
                  title={missingInSection > 0 ? `Faltam ${missingInSection} obrigatórias nesta etapa` : "Ir para a próxima etapa"}
                >
                  Próxima
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              ) : canEdit ? (
                <Button
                  onClick={submitSurvey}
                  disabled={submitting || answeredRequired !== requiredQuestions.length}
                  title={answeredRequired !== requiredQuestions.length
                    ? `Faltam ${requiredQuestions.length - answeredRequired} perguntas obrigatórias`
                    : "Enviar definitivamente — não será possível alterar depois"}
                >
                  {submitting ? <Hourglass className="h-4 w-4 animate-pulse" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                  {submitting ? "Enviando..." : "Enviar avaliação"}
                </Button>
              ) : isSubmitted ? (
                <Badge variant="success" className="min-h-10 px-4">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Envio concluído
                </Badge>
              ) : null}
            </div>
          </div>
          {canEdit && currentStep === sections.length - 1 && answeredRequired !== requiredQuestions.length && (
            <p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">
              Faltam {requiredQuestions.length - answeredRequired} {requiredQuestions.length - answeredRequired === 1 ? "pergunta obrigatória" : "perguntas obrigatórias"} para liberar o envio.
            </p>
          )}
        </footer>
      </div>
      <CompletionCelebration open={celebrate} onClose={() => setCelebrate(false)} message="Sua resposta foi enviada. Obrigado por participar da avaliação institucional." />
    </PlatformShell>
  );
}
