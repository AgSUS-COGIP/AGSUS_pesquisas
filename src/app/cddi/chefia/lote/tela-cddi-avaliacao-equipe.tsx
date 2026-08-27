"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Hourglass,
  Info,
  Lock,
  Save,
  UsersRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/confirmation-provider";
import { CddiLoadingState } from "@/components/cddi-loading-state";
import { CddiPlatformFrame } from "@/components/cddi-platform-frame";
import { CompletionCelebration } from "@/components/completion-celebration";
import { PersonAvatar } from "@/components/person-avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/overlay-panel";
import {
  enviarSubmissaoCddi,
  gravarRespostaCddi,
  iniciarOuRetomarSubmissaoCddi,
  listarCiclosDeLideranca,
  obterFormulario,
  obterMinhaEquipe,
} from "@/lib/api/cliente-runtime";
import { clearCddiBatchQueue, readCddiBatchQueue } from "@/lib/cddi-batch-queue";
import {
  cddiMatrixFirstIncompleteSectionIndex,
  cddiMatrixMissingCount,
  cddiMatrixPersonPage,
  cddiMatrixProgress,
  cddiMatrixSectionMissingByPerson,
  cddiMatrixSectionMissingCount,
  isCddiMatrixQuestionPending,
  restoreCddiMatrixAnswers,
  type CddiAnswersByPerson,
  type CddiMatrixAnswer,
  type CddiMatrixDefinition,
  type CddiMatrixEvaluation,
  type CddiMatrixMember,
  type CddiMatrixQuestion,
  type CddiSubmissionContext,
} from "@/lib/cddi-team-matrix";
import { visibleCddiSections } from "@/lib/cddi-question-applicability";
import { errorMessageFromUnknown } from "@/lib/observability";
import { ReliableSaveQueue, type SaveQueueSnapshot } from "@/lib/reliable-save-queue";

const CDDI_INK = "var(--cddi-ink)";
const MOBILE_PEOPLE_PER_PAGE = 1;
const TABLET_PEOPLE_PER_PAGE = 2;
const DESKTOP_PEOPLE_PER_PAGE = 3;

type PendingTextSave = {
  personId: string;
  question: CddiMatrixQuestion;
};

type MissingItem = {
  personId: string;
  personName: string;
  questionId: string;
  questionTitle: string;
};

function dateLabel(value: string | null | undefined) {
  if (!value) return "Sem envio registrado";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function contextIsEditable(context: CddiSubmissionContext) {
  return Boolean(context.canEdit && context.submission?.status === "DRAFT");
}

function contextStatusLabel(context: CddiSubmissionContext) {
  if (context.submission?.status === "SUBMITTED" || context.submission?.status === "VALIDATED") return "Enviada";
  if (contextIsEditable(context)) return "Rascunho";
  return "Somente leitura";
}

function contextStatusVariant(context: CddiSubmissionContext) {
  if (context.submission?.status === "SUBMITTED" || context.submission?.status === "VALIDATED") return "success" as const;
  if (contextIsEditable(context)) return "info" as const;
  return "neutral" as const;
}

export default function CddiTeamEvaluationPage() {
  const confirm = useConfirm();
  const router = useRouter();
  const [definition, setDefinition] = useState<CddiMatrixDefinition | null>(null);
  const [evaluations, setEvaluations] = useState<Record<string, CddiMatrixEvaluation>>({});
  const [answersByPerson, setAnswersByPerson] = useState<CddiAnswersByPerson>({});
  const [cycleCode, setCycleCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [personPage, setPersonPage] = useState(0);
  const [peoplePerPage, setPeoplePerPage] = useState(MOBILE_PEOPLE_PER_PAGE);
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [missingItems, setMissingItems] = useState<MissingItem[]>([]);
  const timers = useRef<Record<string, number>>({});
  const pendingTextSaves = useRef<Record<string, PendingTextSave>>({});
  const latestAnswers = useRef<CddiAnswersByPerson>({});
  const peoplePerPageRef = useRef(MOBILE_PEOPLE_PER_PAGE);
  const comparisonSectionRef = useRef<HTMLElement | null>(null);
  const peopleStripRef = useRef<HTMLDivElement | null>(null);
  const [saveQueue] = useState(() => new ReliableSaveQueue());
  const [saveSnapshot, setSaveSnapshot] = useState<SaveQueueSnapshot>(() => saveQueue.getSnapshot());

  useEffect(() => saveQueue.subscribe(setSaveSnapshot), [saveQueue]);

  useEffect(() => {
    latestAnswers.current = answersByPerson;
  }, [answersByPerson]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1280px)");
    const tablet = window.matchMedia("(min-width: 768px)");

    function syncPeoplePerPage() {
      const next = desktop.matches
        ? DESKTOP_PEOPLE_PER_PAGE
        : tablet.matches
          ? TABLET_PEOPLE_PER_PAGE
          : MOBILE_PEOPLE_PER_PAGE;
      const previous = peoplePerPageRef.current;
      if (next === previous) return;

      setPersonPage((current) => Math.floor((current * previous) / next));
      peoplePerPageRef.current = next;
      setPeoplePerPage(next);
    }

    syncPeoplePerPage();
    desktop.addEventListener("change", syncPeoplePerPage);
    tablet.addEventListener("change", syncPeoplePerPage);
    return () => {
      desktop.removeEventListener("change", syncPeoplePerPage);
      tablet.removeEventListener("change", syncPeoplePerPage);
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setMessage("");
      try {
        const queue = readCddiBatchQueue();
        if (!queue || queue.personIds.length < 2) {
          router.replace("/equipe");
          return;
        }

        const cycleFromQuery = new URLSearchParams(window.location.search).get("ciclo")?.trim();
        let applicationCode = cycleFromQuery || queue.cycleCode || "";
        if (!applicationCode) {
          const cycles = await listarCiclosDeLideranca();
          if (!cycles[0]?.code) throw new Error("Você não tem vínculo de liderança em nenhum ciclo do CDDI.");
          applicationCode = cycles[0].code;
        }

        const [formResponse, teamResponse] = await Promise.all([
          obterFormulario(applicationCode),
          obterMinhaEquipe(applicationCode),
        ]);
        if (!active) return;

        const teamMembers = ((teamResponse as { members?: CddiMatrixMember[] })?.members ?? []);
        const selectedMembers = queue.personIds
          .map((personId) => teamMembers.find((member) => member.personId === personId))
          .filter((member): member is CddiMatrixMember => Boolean(member));

        if (selectedMembers.length < 2) {
          throw new Error("O grupo selecionado não possui duas pessoas válidas nesta equipe.");
        }

        const contexts = await Promise.all(selectedMembers.map(async (member) => {
          const context = await iniciarOuRetomarSubmissaoCddi({
            applicationCode,
            submissionType: "CHEFIA",
            subjectPersonId: member.personId,
          }) as CddiSubmissionContext;
          return { member, context };
        }));
        if (!active) return;

        const rawDefinition = formResponse as CddiMatrixDefinition;
        const nextDefinition: CddiMatrixDefinition = {
          ...rawDefinition,
          sections: visibleCddiSections(rawDefinition.sections, "CHEFIA"),
        };
        const nextEvaluations: Record<string, CddiMatrixEvaluation> = {};
        const nextAnswers: CddiAnswersByPerson = {};
        contexts.forEach(({ member, context }) => {
          const answers = restoreCddiMatrixAnswers(context.answers);
          nextEvaluations[member.personId] = { member, context, answers };
          nextAnswers[member.personId] = answers;
        });

        const editableIds = contexts
          .filter(({ context }) => contextIsEditable(context))
          .map(({ member }) => member.personId);
        const firstIncomplete = cddiMatrixFirstIncompleteSectionIndex(
          nextDefinition.sections,
          editableIds,
          nextAnswers,
        );

        setCycleCode(applicationCode);
        setDefinition(nextDefinition);
        setEvaluations(nextEvaluations);
        setAnswersByPerson(nextAnswers);
        latestAnswers.current = nextAnswers;
        setActiveSectionIndex(firstIncomplete === -1
          ? Math.max(0, nextDefinition.sections.length - 1)
          : firstIncomplete);
        setPersonPage(0);
        setShowPendingOnly(false);
      } catch (error) {
        setMessage(errorMessageFromUnknown(error) || "Não foi possível abrir a avaliação da equipe.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
      Object.values(timers.current).forEach((timer) => window.clearTimeout(timer));
      timers.current = {};
      pendingTextSaves.current = {};
    };
  }, [router]);

  const sections = useMemo(() => definition?.sections ?? [], [definition?.sections]);
  const evaluationList = useMemo(() => Object.values(evaluations), [evaluations]);
  const personIds = useMemo(() => evaluationList.map((evaluation) => evaluation.member.personId), [evaluationList]);
  const requiredQuestionIds = useMemo(
    () => sections.flatMap((section) => section.questions).filter((question) => question.required).map((question) => question.id),
    [sections],
  );
  const editablePersonIds = useMemo(
    () => evaluationList.filter((evaluation) => contextIsEditable(evaluation.context)).map((evaluation) => evaluation.member.personId),
    [evaluationList],
  );
  const progress = cddiMatrixProgress(personIds, requiredQuestionIds, answersByPerson);
  const missingToSubmit = cddiMatrixMissingCount(editablePersonIds, requiredQuestionIds, answersByPerson);
  const firstIncompleteSectionIndex = cddiMatrixFirstIncompleteSectionIndex(sections, editablePersonIds, answersByPerson);
  const maxUnlockedSectionIndex = firstIncompleteSectionIndex === -1
    ? Math.max(0, sections.length - 1)
    : firstIncompleteSectionIndex;
  const activeSection = sections[activeSectionIndex] ?? null;
  const activeSectionMissing = activeSection
    ? cddiMatrixSectionMissingCount(editablePersonIds, activeSection, answersByPerson)
    : 0;
  const personWindow = cddiMatrixPersonPage(evaluationList, personPage, peoplePerPage);
  const visibleEvaluations = personWindow.items;
  const visibleEditablePersonIds = visibleEvaluations
    .filter((evaluation) => contextIsEditable(evaluation.context))
    .map((evaluation) => evaluation.member.personId);
  const visibleQuestions = activeSection
    ? showPendingOnly
      ? activeSection.questions.filter((question) => isCddiMatrixQuestionPending(question.id, visibleEditablePersonIds, answersByPerson))
      : activeSection.questions
    : [];
  const saving = saveSnapshot.pending > 0;
  const visiblePersonIds = new Set(visibleEvaluations.map((evaluation) => evaluation.member.personId));
  const missingGroups = useMemo(() => {
    const grouped = new Map<string, { personId: string; personName: string; count: number }>();
    for (const item of missingItems) {
      const current = grouped.get(item.personId) ?? {
        personId: item.personId,
        personName: item.personName,
        count: 0,
      };
      current.count += 1;
      grouped.set(item.personId, current);
    }
    return [...grouped.values()];
  }, [missingItems]);

  function replacePersonAnswer(personId: string, questionId: string, answer: CddiMatrixAnswer) {
    const next = {
      ...latestAnswers.current,
      [personId]: {
        ...(latestAnswers.current[personId] ?? {}),
        [questionId]: answer,
      },
    };
    latestAnswers.current = next;
    setAnswersByPerson(next);
  }

  function saveAnswer(personId: string, question: CddiMatrixQuestion, answer: CddiMatrixAnswer) {
    const evaluation = evaluations[personId];
    const submissionId = evaluation?.context.submission?.id;
    if (!evaluation || !contextIsEditable(evaluation.context) || !submissionId) return Promise.resolve();

    return saveQueue.enqueue(async () => {
      await gravarRespostaCddi(submissionId, {
        questionId: question.id,
        optionId: question.type === "SCALE" ? answer.optionId ?? null : null,
        text: question.type === "SCALE" ? null : answer.value,
      });
    }, `${personId}:${question.id}`).catch((error) => {
      setMessage(errorMessageFromUnknown(error) || `Não foi possível salvar a resposta de ${evaluation.member.fullName}.`);
      throw error;
    });
  }

  function updateScale(personId: string, question: CddiMatrixQuestion, option: CddiMatrixQuestion["options"][number]) {
    const answer = { value: option.value, optionId: option.id };
    replacePersonAnswer(personId, question.id, answer);
    setMessage("");
    void saveAnswer(personId, question, answer).catch(() => undefined);
  }

  function updateText(personId: string, question: CddiMatrixQuestion, value: string) {
    const answer = { value };
    replacePersonAnswer(personId, question.id, answer);
    setMessage("");
    const key = `${personId}:${question.id}`;
    if (timers.current[key]) window.clearTimeout(timers.current[key]);
    pendingTextSaves.current[key] = { personId, question };
    timers.current[key] = window.setTimeout(() => {
      delete timers.current[key];
      delete pendingTextSaves.current[key];
      const current = latestAnswers.current[personId]?.[question.id] ?? answer;
      void saveAnswer(personId, question, current).catch(() => undefined);
    }, 700);
  }

  async function flushPendingSaves() {
    const pending = Object.entries(pendingTextSaves.current);
    for (const [key, item] of pending) {
      if (timers.current[key]) window.clearTimeout(timers.current[key]);
      delete timers.current[key];
      delete pendingTextSaves.current[key];
      const answer = latestAnswers.current[item.personId]?.[item.question.id];
      if (answer) void saveAnswer(item.personId, item.question, answer).catch(() => undefined);
    }
    await saveQueue.flush();
  }

  async function saveNow() {
    try {
      await flushPendingSaves();
      setMessage("Rascunhos atualizados com sucesso.");
    } catch (error) {
      setMessage(errorMessageFromUnknown(error) || "Ainda existe uma resposta que não foi salva.");
    }
  }

  function collectMissingItems(sectionIndex: number) {
    const section = sections[sectionIndex];
    if (!section) return [];
    const items: MissingItem[] = [];
    for (const personId of editablePersonIds) {
      const evaluation = evaluations[personId];
      if (!evaluation) continue;
      for (const question of section.questions) {
        if (!question.required) continue;
        const value = answersByPerson[personId]?.[question.id]?.value?.trim();
        if (value) continue;
        items.push({
          personId,
          personName: evaluation.member.fullName,
          questionId: question.id,
          questionTitle: question.title,
        });
      }
    }
    return items;
  }

  function scrollToComparison() {
    window.requestAnimationFrame(() => {
      comparisonSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function goToPersonPage(target: number) {
    const safePage = Math.max(0, Math.min(target, personWindow.pageCount - 1));
    setPersonPage(safePage);
    window.requestAnimationFrame(() => {
      const firstIndex = safePage * peoplePerPage;
      const firstPerson = peopleStripRef.current?.querySelector<HTMLElement>(`[data-person-index="${firstIndex}"]`);
      firstPerson?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
    });
  }

  function focusFirstMissingPerson(sectionIndex: number) {
    const section = sections[sectionIndex];
    if (!section) return;
    const firstMissing = cddiMatrixSectionMissingByPerson(editablePersonIds, section, answersByPerson)[0];
    if (!firstMissing) return;
    const index = evaluationList.findIndex((evaluation) => evaluation.member.personId === firstMissing.personId);
    if (index >= 0) goToPersonPage(Math.floor(index / peoplePerPage));
  }

  function showMissingDialog(sectionIndex: number) {
    const items = collectMissingItems(sectionIndex);
    if (!items.length) return;
    setMissingItems(items);
    setMessage("");
    focusFirstMissingPerson(sectionIndex);
    setShowPendingOnly(true);
  }

  function goToSection(target: number) {
    if (!sections.length) return;
    const safeTarget = Math.max(0, Math.min(target, sections.length - 1));
    if (safeTarget > maxUnlockedSectionIndex) {
      const blocker = firstIncompleteSectionIndex === -1 ? activeSectionIndex : firstIncompleteSectionIndex;
      setActiveSectionIndex(blocker);
      showMissingDialog(blocker);
      return;
    }
    setMessage("");
    setMissingItems([]);
    setActiveSectionIndex(safeTarget);
    setPersonPage(0);
    setShowPendingOnly(false);
    scrollToComparison();
  }

  function goNextSection() {
    if (!activeSection) return;
    if (activeSectionMissing > 0) {
      showMissingDialog(activeSectionIndex);
      return;
    }
    goToSection(activeSectionIndex + 1);
  }

  async function submitAll() {
    if (!editablePersonIds.length || submitting) return;
    if (missingToSubmit > 0) {
      const blocker = firstIncompleteSectionIndex === -1 ? activeSectionIndex : firstIncompleteSectionIndex;
      setActiveSectionIndex(blocker);
      showMissingDialog(blocker);
      return;
    }

    const editableEvaluations = evaluationList.filter((evaluation) => contextIsEditable(evaluation.context));
    const confirmed = await confirm({
      title: `Finalizar ${editableEvaluations.length} ${editableEvaluations.length === 1 ? "avaliação" : "avaliações"}?`,
      description: `Serão enviadas definitivamente as avaliações de ${editableEvaluations.map((evaluation) => evaluation.member.fullName).join(", ")}. Cada pessoa mantém suas próprias respostas e, após o envio, elas não poderão mais ser alteradas.`,
      confirmLabel: "Finalizar avaliações",
    });
    if (!confirmed) return;

    setSubmitting(true);
    setMessage("");
    try {
      await flushPendingSaves();
      const results = await Promise.allSettled(editableEvaluations.map(async (evaluation) => {
        const submissionId = evaluation.context.submission?.id;
        if (!submissionId) throw new Error("Submissão indisponível.");
        const result = await enviarSubmissaoCddi(submissionId);
        return { personId: evaluation.member.personId, result };
      }));

      const failures: string[] = [];
      const successes = new Map<string, { submittedAt?: string; result?: number }>();
      results.forEach((result, index) => {
        const evaluation = editableEvaluations[index];
        if (result.status === "fulfilled") successes.set(result.value.personId, result.value.result);
        else failures.push(evaluation.member.fullName);
      });

      if (successes.size) {
        setEvaluations((current) => {
          const next = { ...current };
          for (const [personId, result] of successes) {
            const evaluation = next[personId];
            if (!evaluation?.context.submission) continue;
            next[personId] = {
              ...evaluation,
              context: {
                ...evaluation.context,
                canEdit: false,
                submission: {
                  ...evaluation.context.submission,
                  status: "SUBMITTED",
                  submittedAt: result.submittedAt ?? new Date().toISOString(),
                  result: result.result ?? evaluation.context.submission.result,
                },
              },
            };
          }
          return next;
        });
      }

      if (failures.length) {
        setMessage(`Algumas avaliações foram enviadas, mas houve falha em: ${failures.join(", ")}. As que falharam permanecem em rascunho e podem ser reenviadas.`);
        return;
      }

      clearCddiBatchQueue();
      setMessage("Todas as avaliações foram enviadas com sucesso.");
      setCelebrate(true);
    } catch (error) {
      setMessage(errorMessageFromUnknown(error) || "Não foi possível finalizar as avaliações.");
    } finally {
      setSubmitting(false);
    }
  }

  function answerControl(evaluation: CddiMatrixEvaluation, question: CddiMatrixQuestion, vertical = false) {
    const personId = evaluation.member.personId;
    const canEdit = contextIsEditable(evaluation.context);
    const answer = answersByPerson[personId]?.[question.id];

    if (question.type !== "SCALE") {
      return (
        <textarea
          rows={vertical ? 5 : 4}
          value={answer?.value ?? ""}
          onChange={(event) => updateText(personId, question, event.target.value)}
          placeholder="Digite a resposta desta pessoa..."
          disabled={!canEdit}
          className="w-full resize-y rounded-xl border border-[var(--border-subtle)] bg-[var(--control-bg)] p-3 text-sm leading-6 text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] hover:border-[var(--border-strong)] focus:border-[var(--focus-ring)] focus:ring-4 focus:ring-sky-300/15 disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)]"
        />
      );
    }

    return (
      <div className={vertical ? "grid gap-2" : "grid grid-cols-5 gap-1.5"}>
        {question.options.map((option) => {
          const selected = answer?.optionId === option.id || answer?.value === option.value;
          return (
            <label
              key={option.id}
              title={`${evaluation.member.fullName}: ${option.label}`}
              className={`cursor-pointer rounded-lg border transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-sky-300/25 ${
                vertical
                  ? "flex min-h-12 items-center gap-3 px-3 py-2 text-left"
                  : "flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 text-center"
              } ${
                selected
                  ? "border-[var(--brand-solid)] bg-[var(--brand-solid)] text-[var(--text-on-brand)]"
                  : "border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-primary)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
              } ${canEdit ? "" : "cursor-not-allowed opacity-70"}`}
            >
              <input
                type="radio"
                className="sr-only"
                name={`${personId}-${question.id}`}
                checked={selected}
                disabled={!canEdit}
                onChange={() => updateScale(personId, question, option)}
              />
              <span className={vertical ? "w-8 shrink-0 text-center text-base font-bold" : "text-sm font-bold"}>{option.value}</span>
              <span className={`${vertical ? "text-xs leading-4" : "text-[10px] leading-3"} ${selected ? "text-[var(--text-on-brand)]/85" : "text-[var(--text-muted)]"}`}>{option.label}</span>
            </label>
          );
        })}
      </div>
    );
  }

  if (loading) {
    return (
      <CddiPlatformFrame title="Avaliação da equipe">
        <CddiLoadingState />
      </CddiPlatformFrame>
    );
  }

  if (!definition || evaluationList.length < 2 || !activeSection) {
    return (
      <CddiPlatformFrame title="Avaliação da equipe">
        <div className="grid min-h-[60vh] place-items-center px-6">
          <section className="max-w-xl rounded-2xl border border-[var(--status-danger-border)] bg-[var(--surface-card)] p-8 shadow-[var(--shadow-card)]">
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Avaliação múltipla indisponível</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{message || "Selecione pelo menos duas pessoas válidas na tela Minha equipe."}</p>
            <Link href="/equipe" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--brand-solid)] px-5 text-sm font-semibold text-[var(--text-on-brand)] transition hover:bg-[var(--brand-solid-hover)]">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Voltar à equipe
            </Link>
          </section>
        </div>
      </CddiPlatformFrame>
    );
  }

  return (
    <CddiPlatformFrame title={`Avaliação da equipe · ${evaluationList.length} pessoas`}>
      <div className="cddi-form-shell min-h-[60vh] text-[var(--text-primary)]">
        <div className="w-full space-y-4 px-3 py-4 sm:px-5 xl:px-8">
          <header className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-card)] sm:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--brand-secondary)]">Avaliação pela chefia</p>
                  <Badge variant="info">{evaluationList.length} pessoas selecionadas</Badge>
                  {cycleCode && <Badge variant="outline">{cycleCode}</Badge>}
                </div>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl" style={{ color: CDDI_INK }}>Formulário de avaliação múltipla</h1>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--text-secondary)]">Avalie cada pessoa de forma independente. A próxima competência só é liberada quando as obrigatórias da atual estiverem completas para todas as pessoas editáveis.</p>
              </div>
              <Link href="/equipe" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Voltar à equipe
              </Link>
            </div>

            <div className="mt-6 border-t border-[var(--border-subtle)] pt-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <strong>Progresso geral</strong>
                    <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-semibold">{progress}%</span>
                    <span className="text-xs text-[var(--text-secondary)]">{missingToSubmit ? `${missingToSubmit} respostas obrigatórias pendentes` : "Todas as obrigatórias editáveis foram preenchidas"}</span>
                  </div>
                  <div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso geral da avaliação da equipe" className="mt-3 h-2.5 max-w-3xl overflow-hidden rounded-full bg-[var(--surface-muted)]">
                    <div className="h-full rounded-full bg-[var(--brand-secondary)] transition-[width] motion-reduce:transition-none" style={{ width: `${progress}%` }} />
                  </div>
                </div>
                <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 text-sm font-semibold">
                  <input type="checkbox" checked={showPendingOnly} onChange={(event) => setShowPendingOnly(event.target.checked)} className="h-4 w-4 accent-[var(--brand-solid)]" />
                  Mostrar apenas pendentes
                </label>
              </div>

              <nav aria-label="Competências da avaliação" className="mt-5 flex gap-2 overflow-x-auto pb-1">
                {sections.map((section, index) => {
                  const missing = cddiMatrixSectionMissingCount(editablePersonIds, section, answersByPerson);
                  const complete = missing === 0;
                  const current = index === activeSectionIndex;
                  const locked = index > maxUnlockedSectionIndex;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => goToSection(index)}
                      disabled={locked}
                      aria-current={current ? "step" : undefined}
                      title={locked ? `Complete a competência ${maxUnlockedSectionIndex + 1} para liberar esta` : section.title}
                      className={`inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full border px-3 text-xs font-semibold transition ${
                        current
                          ? "border-[var(--brand-solid)] bg-[var(--brand-solid)] text-[var(--text-on-brand)]"
                          : locked
                            ? "cursor-not-allowed border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-muted)] opacity-70"
                            : complete
                              ? "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)] hover:brightness-95"
                              : "border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                      }`}
                    >
                      {locked
                        ? <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                        : complete
                          ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          : null}
                      <span>{String(index + 1).padStart(2, "0")}</span>
                    </button>
                  );
                })}
              </nav>
              <p className="mt-2 text-xs text-[var(--text-secondary)]">
                Competência {activeSectionIndex + 1} de {sections.length}: <strong>{activeSection.title}</strong>
              </p>
            </div>
          </header>

          {message && (
            <p role="status" className="flex items-start gap-3 rounded-xl border border-[var(--status-info-border)] bg-[var(--status-info-bg)] p-4 text-sm leading-6 text-[var(--status-info-text)]">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {message}
            </p>
          )}

          <section ref={comparisonSectionRef} className="scroll-mt-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--shadow-card)]">
            <div className="border-b border-[var(--border-subtle)] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <strong className="text-sm">Pessoas em comparação</strong>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    {evaluationList.length <= peoplePerPage
                      ? `${evaluationList.length} ${evaluationList.length === 1 ? "pessoa" : "pessoas"} em comparação`
                      : `Pessoas ${personWindow.start + 1}–${personWindow.end} de ${evaluationList.length}`}
                  </p>
                </div>
                {personWindow.pageCount > 1 && (
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => goToPersonPage(personWindow.page - 1)} disabled={personWindow.page === 0} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border-subtle)] px-3 text-sm font-semibold hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-40">
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Anteriores
                    </button>
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">{personWindow.page + 1} / {personWindow.pageCount}</span>
                    <button type="button" onClick={() => goToPersonPage(personWindow.page + 1)} disabled={personWindow.page >= personWindow.pageCount - 1} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border-subtle)] px-3 text-sm font-semibold hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-40">
                      Próximas <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>

              {evaluationList.length > 2 && (
                <div ref={peopleStripRef} className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Pessoas selecionadas">
                  {evaluationList.map((evaluation, index) => {
                    const active = visiblePersonIds.has(evaluation.member.personId);
                    const missing = cddiMatrixSectionMissingCount([evaluation.member.personId], activeSection, answersByPerson);
                    return (
                      <button
                        key={evaluation.member.personId}
                        type="button"
                        data-person-index={index}
                        onClick={() => goToPersonPage(Math.floor(index / peoplePerPage))}
                        className={`flex min-w-[220px] shrink-0 items-center gap-3 rounded-xl border p-3 text-left transition ${active ? "border-[var(--brand-solid)] bg-[var(--brand-soft)]" : "border-[var(--border-subtle)] bg-[var(--surface-card)] hover:bg-[var(--surface-hover)]"}`}
                      >
                        <PersonAvatar fullName={evaluation.member.fullName} avatarUrl={evaluation.member.avatarUrl} className="h-10 w-10 rounded-xl" fallbackClassName="text-xs" />
                        <span className="min-w-0 flex-1">
                          <strong className="block truncate text-xs">{evaluation.member.fullName}</strong>
                          <span className="mt-1 block text-[11px] text-[var(--text-secondary)]">{missing ? `${missing} pendente${missing === 1 ? "" : "s"}` : "Competência completa"}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex min-h-16 items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-3">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand-soft)] text-xs font-bold text-[var(--brand-solid)]">{activeSectionIndex + 1}</span>
              <span className="min-w-0 flex-1">
                <strong className="block text-sm" style={{ color: CDDI_INK }}>{activeSection.title}</strong>
                {activeSection.description && <span className="mt-0.5 block max-w-5xl text-xs leading-5 text-[var(--text-secondary)]">{activeSection.description}</span>}
              </span>
              {activeSectionMissing > 0
                ? <Badge variant="warning">{activeSectionMissing} pendente{activeSectionMissing === 1 ? "" : "s"}</Badge>
                : <Badge variant="success">Concluída</Badge>}
            </div>

            <div className="hidden xl:block">
              <div className="grid border-b border-[var(--border-subtle)] bg-[var(--surface-muted)]" style={{ gridTemplateColumns: `minmax(320px,.8fr) repeat(${visibleEvaluations.length},minmax(0,1fr))` }}>
                <div className="p-4 text-sm font-semibold">Competência e perguntas</div>
                {visibleEvaluations.map((evaluation) => (
                  <article key={evaluation.member.personId} className="border-l border-[var(--border-subtle)] p-4">
                    <div className="flex items-center gap-3">
                      <PersonAvatar fullName={evaluation.member.fullName} avatarUrl={evaluation.member.avatarUrl} className="h-11 w-11 rounded-xl" fallbackClassName="text-sm" />
                      <div className="min-w-0 flex-1">
                        <strong className="block truncate text-sm">{evaluation.member.fullName}</strong>
                        <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">{evaluation.member.jobTitle || "Cargo não informado"} · {evaluation.member.unit || "Unidade não informada"}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge variant={contextStatusVariant(evaluation.context)}>{contextStatusLabel(evaluation.context)}</Badge>
                          {evaluation.context.submission?.submittedAt && <span className="text-[11px] text-[var(--text-muted)]">{dateLabel(evaluation.context.submission.submittedAt)}</span>}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {visibleQuestions.map((question, questionIndex) => (
                <div key={question.id} className="grid border-b border-[var(--border-subtle)] last:border-b-0" style={{ gridTemplateColumns: `minmax(320px,.8fr) repeat(${visibleEvaluations.length},minmax(0,1fr))` }}>
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 text-xs font-bold text-[var(--brand-secondary)]">{questionIndex + 1}</span>
                      <div>
                        <p className="whitespace-pre-line text-sm font-semibold leading-6 text-[var(--text-primary)]">{question.title}{question.required && <span className="text-red-700" title="Resposta obrigatória"> *</span>}</p>
                        {question.description && <p className="mt-1 whitespace-pre-line text-xs leading-5 text-[var(--text-secondary)]">{question.description}</p>}
                      </div>
                    </div>
                  </div>
                  {visibleEvaluations.map((evaluation) => (
                    <fieldset key={evaluation.member.personId} className="min-w-0 border-l border-[var(--border-subtle)] p-3">
                      <legend className="sr-only">{question.title} — {evaluation.member.fullName}</legend>
                      {answerControl(evaluation, question)}
                    </fieldset>
                  ))}
                </div>
              ))}
            </div>

            <div className="divide-y divide-[var(--border-subtle)] xl:hidden">
              {visibleQuestions.map((question, questionIndex) => (
                <article key={question.id} className="p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 text-xs font-bold text-[var(--brand-secondary)]">{questionIndex + 1}</span>
                    <div className="min-w-0">
                      <p className="whitespace-pre-line text-sm font-semibold leading-6 text-[var(--text-primary)]">{question.title}{question.required && <span className="text-red-700" title="Resposta obrigatória"> *</span>}</p>
                      {question.description && <p className="mt-1 whitespace-pre-line text-xs leading-5 text-[var(--text-secondary)]">{question.description}</p>}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    {visibleEvaluations.map((evaluation) => (
                      <fieldset key={evaluation.member.personId} className="min-w-0 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3 sm:p-4">
                        <legend className="sr-only">{question.title} — {evaluation.member.fullName}</legend>
                        <div className="mb-3 flex items-center gap-3">
                          <PersonAvatar fullName={evaluation.member.fullName} avatarUrl={evaluation.member.avatarUrl} className="h-9 w-9 rounded-lg" fallbackClassName="text-xs" />
                          <div className="min-w-0 flex-1">
                            <strong className="block truncate text-xs">{evaluation.member.fullName}</strong>
                            <span className="text-[11px] text-[var(--text-secondary)]">{contextStatusLabel(evaluation.context)}</span>
                          </div>
                        </div>
                        {answerControl(evaluation, question, true)}
                      </fieldset>
                    ))}
                  </div>
                </article>
              ))}
            </div>

            {showPendingOnly && visibleQuestions.length === 0 && (
              <div className="p-10 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-[var(--status-success-text)]" aria-hidden="true" />
                <strong className="mt-3 block text-sm">Nenhuma pendência nestas pessoas</strong>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">Se a competência ainda não liberou a próxima etapa, avance pelas outras páginas de pessoas para localizar a pendência.</p>
              </div>
            )}
          </section>
        </div>

        <footer className="sticky bottom-0 z-30 mt-4 border-t border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-3 py-3 shadow-[0_-8px_24px_rgba(15,23,42,.10)] backdrop-blur sm:px-5 xl:px-8">
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p role="status" className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              {saving
                ? <><Hourglass className="h-4 w-4 animate-pulse motion-reduce:animate-none" aria-hidden="true" />Salvando alterações...</>
                : saveSnapshot.status === "ERROR"
                  ? <><Info className="h-4 w-4" aria-hidden="true" />Existe uma resposta com falha de salvamento.</>
                  : <><Save className="h-4 w-4" aria-hidden="true" />Salvamento automático ativo</>}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
              {activeSectionIndex > 0 && (
                <button type="button" onClick={() => goToSection(activeSectionIndex - 1)} disabled={saving || submitting} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50 sm:px-4">
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" /> <span className="hidden md:inline">Competência </span>anterior
                </button>
              )}
              <button type="button" onClick={() => void saveNow()} disabled={saving || submitting} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50 sm:px-4">
                <Save className="h-4 w-4" aria-hidden="true" /> <span className="hidden sm:inline">Salvar </span>rascunhos
              </button>
              {activeSectionIndex < sections.length - 1 ? (
                <button type="button" onClick={goNextSection} disabled={saving || submitting} title={activeSectionMissing > 0 ? `Faltam ${activeSectionMissing} respostas obrigatórias nesta competência` : "Avançar para a próxima competência"} className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--brand-solid)] px-5 text-sm font-semibold text-[var(--text-on-brand)] shadow-sm hover:bg-[var(--brand-solid-hover)] disabled:cursor-not-allowed disabled:opacity-50 sm:col-auto">
                  Próxima competência <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : (
                <button type="button" onClick={() => void submitAll()} disabled={submitting || saving || !editablePersonIds.length} title={missingToSubmit > 0 ? `Há ${missingToSubmit} respostas obrigatórias pendentes. Clique para localizar a primeira pendência.` : !editablePersonIds.length ? "Todas as avaliações já estão concluídas ou em somente leitura" : "Finalizar avaliações editáveis"} className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--brand-solid)] px-5 text-sm font-semibold text-[var(--text-on-brand)] shadow-sm hover:bg-[var(--brand-solid-hover)] disabled:cursor-not-allowed disabled:opacity-50 sm:col-auto">
                  {submitting ? <Hourglass className="h-4 w-4 animate-pulse motion-reduce:animate-none" aria-hidden="true" /> : <UsersRound className="h-4 w-4" aria-hidden="true" />}
                  {submitting ? "Finalizando..." : `Finalizar ${editablePersonIds.length || ""} ${editablePersonIds.length === 1 ? "avaliação" : "avaliações"}`.trim()}
                </button>
              )}
            </div>
          </div>
        </footer>

        <CompletionCelebration open={celebrate} onClose={() => router.replace("/equipe")} title="Avaliações concluídas" message="As avaliações selecionadas foram enviadas com respostas independentes para cada pessoa." actionLabel="Voltar para Minha equipe" />

        <Dialog
          open={missingItems.length > 0}
          onOpenChange={(open) => { if (!open) setMissingItems([]); }}
          title={missingItems.length === 1 ? "Falta responder uma pergunta" : `Faltam responder ${missingItems.length} perguntas`}
          description="Complete as respostas obrigatórias desta competência antes de continuar."
          className="max-w-xl border-amber-200"
          footer={(
            <button
              type="button"
              onClick={() => setMissingItems([])}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-amber-600 px-5 text-sm font-semibold text-white transition hover:bg-amber-700 sm:w-auto"
            >
              Voltar e responder
            </button>
          )}
        >
          <div className="text-center">
            <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-amber-100 text-amber-700 ring-8 ring-amber-50">
              <AlertTriangle className="h-10 w-10" aria-hidden="true" />
            </span>
            <p className="mx-auto mt-6 max-w-md text-base leading-7 text-slate-700">
              Você deixou {missingItems.length} {missingItems.length === 1 ? "pergunta obrigatória sem resposta" : "perguntas obrigatórias sem resposta"} nesta competência.
            </p>
            <ul className="mt-5 max-h-[50vh] space-y-2 overflow-y-auto text-left" aria-label="Pessoas com perguntas que precisam ser respondidas">
              {missingGroups.map((group) => (
                <li key={group.personId} className="flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
                  <strong className="min-w-0 flex-1 font-semibold">{group.personName}</strong>
                  <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                    {group.count} {group.count === 1 ? "pergunta" : "perguntas"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Dialog>
      </div>
    </CddiPlatformFrame>
  );
}
