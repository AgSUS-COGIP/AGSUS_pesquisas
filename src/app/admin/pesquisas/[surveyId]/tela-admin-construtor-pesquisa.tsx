"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlignLeft,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CalendarDays,
  Check,
  CheckSquare,
  CircleAlert,
  CircleDot,
  Clock3,
  Copy,
  FileText,
  FolderInput,
  Hash,
  Loader2,
  Pencil,
  Plus,
  Save,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  ToggleLeft,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { PlatformShell } from "@/components/platform-shell";
import { PlatformGuardState } from "@/components/platform-guard-state";
import { useConfirm } from "@/components/confirmation-provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorSummary } from "@/components/ui/feedback";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/form-controls";
import { usePlatformGuard } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";
import {
  buildQuestionOptions,
  hasUnsavedChanges,
  isSupportedQuestionType,
  moveAvailability,
  needsQuestionOptions,
  QUESTION_TYPES,
  questionDraftErrors,
  questionMoveTargets,
  questionOptionsToText,
  questionTypeLabel,
  sectionDraftErrors,
  type MoveDirection,
  type SupportedQuestionType,
  type SurveyOption,
} from "@/lib/survey-builder";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { cycleStatusLabel } from "@/lib/survey-status-labels";

type Question = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  questionType: string;
  required: boolean;
  position: number;
  options: SurveyOption[];
};

type Section = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  position: number;
  questions: Question[];
};

type BuilderData = {
  status: string;
  survey: { id: string; code: string; name: string; description: string | null; status: string };
  version: { id: string; number: number; status: string };
  application: { id: string; code: string; name: string; status: string; opensAt: string | null; closesAt: string | null };
  sections: Section[];
};

type SectionEditor = {
  mode: "create" | "edit";
  sectionId?: string;
  title: string;
  description: string;
  initialSignature: string;
};

type QuestionEditor = {
  mode: "create" | "edit";
  sectionId: string;
  questionId?: string;
  title: string;
  description: string;
  questionType: SupportedQuestionType;
  required: boolean;
  optionsText: string;
  currentOptions: SurveyOption[];
  initialSignature: string;
};

type QuestionMoveEditor = {
  questionId: string;
  questionTitle: string;
  sourceSectionId: string;
  targetSectionId: string;
};

const QUESTION_TYPE_ICONS: Record<SupportedQuestionType, LucideIcon> = {
  SHORT_TEXT: FileText,
  LONG_TEXT: AlignLeft,
  INTEGER: Hash,
  DECIMAL: Hash,
  DATE: CalendarDays,
  DATETIME: Clock3,
  BOOLEAN: ToggleLeft,
  SINGLE_CHOICE: CircleDot,
  MULTIPLE_CHOICE: CheckSquare,
  SCALE: SlidersHorizontal,
};

function sectionSignature(editor: Pick<SectionEditor, "title" | "description">) {
  return JSON.stringify([editor.title, editor.description]);
}

function questionSignature(editor: Pick<QuestionEditor, "title" | "description" | "questionType" | "required" | "optionsText">) {
  return JSON.stringify([
    editor.title,
    editor.description,
    editor.questionType,
    editor.required,
    editor.optionsText,
  ]);
}

function UnsavedChangesNotice() {
  return (
    <div
      role="status"
      className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950"
    >
      <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div>
        <p className="text-sm font-black">Alterações não salvas</p>
        <p className="mt-1 text-xs leading-5 text-amber-800">
          Salve antes de fechar esta janela para não perder o que foi alterado.
        </p>
      </div>
    </div>
  );
}

export default function SurveyBuilderPage({ params }: { params: Promise<{ surveyId: string }> }) {
  const confirm = useConfirm();
  const router = useRouter();
  const { surveyId } = use(params);
  const guard = usePlatformGuard(PLATFORM_MODULE.ADMIN_SURVEYS);
  const granted = guard.state === "granted";
  const [builder, setBuilder] = useState<BuilderData | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [sectionEditor, setSectionEditor] = useState<SectionEditor | null>(null);
  const [questionEditor, setQuestionEditor] = useState<QuestionEditor | null>(null);
  const [questionMoveEditor, setQuestionMoveEditor] = useState<QuestionMoveEditor | null>(null);
  const [sectionErrors, setSectionErrors] = useState<string[]>([]);
  const [questionErrors, setQuestionErrors] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Question | null>(null);
  const [surveyDeleteOpen, setSurveyDeleteOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [itemOperation, setItemOperation] = useState<string | null>(null);

  const loadBuilder = useCallback(async (showLoader = true) => {
    if (showLoader) setDataLoading(true);
    setLoadError("");
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error: builderError } = await supabase.rpc("get_survey_builder", {
        target_survey_id: surveyId,
      });
      if (builderError) throw builderError;
      setBuilder(data as BuilderData);
    } catch (loadBuilderError) {
      const message = loadBuilderError instanceof Error
        ? loadBuilderError.message
        : "Não foi possível carregar o construtor.";
      setLoadError(message);
      toast.error(message);
    } finally {
      if (showLoader) setDataLoading(false);
    }
  }, [surveyId]);

  useEffect(() => {
    if (granted) void loadBuilder();
  }, [granted, loadBuilder]);

  const totalQuestions = useMemo(
    () => builder?.sections.reduce((sum, section) => sum + section.questions.length, 0) ?? 0,
    [builder],
  );
  const isDraft = builder?.version.status === "DRAFT";
  const sectionHasUnsavedChanges = Boolean(
    sectionEditor &&
      hasUnsavedChanges(
        sectionEditor.initialSignature,
        sectionSignature(sectionEditor),
      ),
  );
  const questionHasUnsavedChanges = Boolean(
    questionEditor &&
      hasUnsavedChanges(
        questionEditor.initialSignature,
        questionSignature(questionEditor),
      ),
  );
  const hasUnsavedEditorChanges =
    sectionHasUnsavedChanges || questionHasUnsavedChanges;
  const moveTargetSections = questionMoveTargets(
    builder?.sections ?? [],
    questionMoveEditor?.sourceSectionId ?? "",
  );
  const moveSourceSection = builder?.sections.find(
    (section) => section.id === questionMoveEditor?.sourceSectionId,
  );

  useEffect(() => {
    if (!hasUnsavedEditorChanges) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedEditorChanges]);

  function openNewSection() {
    const draft = { title: "", description: "" };
    setSectionErrors([]);
    setSectionEditor({ mode: "create", ...draft, initialSignature: sectionSignature(draft) });
  }

  function openEditSection(section: Section) {
    const draft = { title: section.title, description: section.description ?? "" };
    setSectionErrors([]);
    setSectionEditor({
      mode: "edit",
      sectionId: section.id,
      ...draft,
      initialSignature: sectionSignature(draft),
    });
  }

  async function closeSectionEditor() {
    if (!sectionEditor || working) return;
    const dirty = sectionSignature(sectionEditor) !== sectionEditor.initialSignature;
    if (dirty && !(await confirm({ title: "Descartar alterações da seção?", description: "Os dados editados nesta seção ainda não foram salvos e serão perdidos.", confirmLabel: "Descartar alterações", tone: "danger" }))) return;
    setSectionEditor(null);
    setSectionErrors([]);
  }

  function openNewQuestion(sectionId: string) {
    const draft = {
      title: "",
      description: "",
      questionType: "SHORT_TEXT" as const,
      required: true,
      optionsText: "Opção 1\nOpção 2",
    };
    setQuestionErrors([]);
    setQuestionEditor({
      mode: "create",
      sectionId,
      currentOptions: [],
      ...draft,
      initialSignature: questionSignature(draft),
    });
  }

  function openEditQuestion(sectionId: string, question: Question) {
    if (!isSupportedQuestionType(question.questionType)) {
      toast.error("Este tipo avançado ainda não pode ser editado pelo Studio.");
      return;
    }

    const draft = {
      title: question.title,
      description: question.description ?? "",
      questionType: question.questionType,
      required: question.required,
      optionsText: questionOptionsToText(question.options),
    };
    setQuestionErrors([]);
    setQuestionEditor({
      mode: "edit",
      sectionId,
      questionId: question.id,
      currentOptions: question.options,
      ...draft,
      initialSignature: questionSignature(draft),
    });
  }

  async function closeQuestionEditor() {
    if (!questionEditor || working) return;
    const dirty = questionSignature(questionEditor) !== questionEditor.initialSignature;
    if (dirty && !(await confirm({ title: "Descartar alterações da pergunta?", description: "Os dados editados nesta pergunta ainda não foram salvos e serão perdidos.", confirmLabel: "Descartar alterações", tone: "danger" }))) return;
    setQuestionEditor(null);
    setQuestionErrors([]);
  }

  async function saveSection() {
    if (!sectionEditor) return;
    const errors = sectionDraftErrors(sectionEditor.title, sectionEditor.description);
    setSectionErrors(errors);
    if (errors.length) return;

    setWorking(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const rpc = sectionEditor.mode === "create" ? "add_survey_section" : "update_survey_section";
      const args = sectionEditor.mode === "create"
        ? {
            target_survey_id: surveyId,
            section_title: sectionEditor.title,
            section_description: sectionEditor.description || null,
          }
        : {
            target_section_id: sectionEditor.sectionId,
            section_title: sectionEditor.title,
            section_description: sectionEditor.description || null,
          };
      const { error: sectionError } = await supabase.rpc(rpc, args);
      if (sectionError) throw sectionError;

      toast.success(sectionEditor.mode === "create" ? "Seção adicionada." : "Seção atualizada.");
      setSectionEditor(null);
      setSectionErrors([]);
      await loadBuilder(false);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Não foi possível salvar a seção.";
      setSectionErrors([message]);
      toast.error(message);
    } finally {
      setWorking(false);
    }
  }

  async function saveQuestion() {
    if (!questionEditor) return;
    const errors = questionDraftErrors(questionEditor);
    setQuestionErrors(errors);
    if (errors.length) return;

    const options = buildQuestionOptions(
      questionEditor.optionsText,
      questionEditor.questionType,
      questionEditor.currentOptions,
    );
    setWorking(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const sharedArgs = {
        question_title: questionEditor.title,
        question_description: questionEditor.description || "",
        question_type: questionEditor.questionType,
        is_required: questionEditor.required,
        question_options: options,
      };
      const rpc = questionEditor.mode === "create" ? "add_survey_question" : "update_survey_question";
      const args = questionEditor.mode === "create"
        ? {
            target_survey_id: surveyId,
            target_section_id: questionEditor.sectionId,
            ...sharedArgs,
          }
        : {
            target_question_id: questionEditor.questionId,
            ...sharedArgs,
          };
      const { error: questionError } = await supabase.rpc(rpc, args);
      if (questionError) throw questionError;

      toast.success(questionEditor.mode === "create" ? "Pergunta adicionada." : "Pergunta atualizada.");
      setQuestionEditor(null);
      setQuestionErrors([]);
      await loadBuilder(false);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Não foi possível salvar a pergunta.";
      setQuestionErrors([message]);
      toast.error(message);
    } finally {
      setWorking(false);
    }
  }

  async function deleteQuestion() {
    if (!deleteTarget) return;
    setWorking(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: deleteError } = await supabase.rpc("delete_survey_question", {
        target_question_id: deleteTarget.id,
      });
      if (deleteError) throw deleteError;
      toast.success("Pergunta excluída.");
      setDeleteTarget(null);
      await loadBuilder(false);
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "Não foi possível excluir a pergunta.");
    } finally {
      setWorking(false);
    }
  }

  async function deleteSurvey() {
    if (working) return;
    setWorking(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: deleteError } = await supabase.rpc("fc_excluir_pesquisa_rascunho", {
        p_pesquisa: surveyId,
      });
      if (deleteError) throw deleteError;
      toast.success("Avaliação excluída.");
      setSurveyDeleteOpen(false);
      // A tela deixa de existir depois da navegação, mas `working` é liberado
      // no `finally` de qualquer forma: se o push demorar ou não desmontar o
      // componente, o construtor não pode ficar com todos os botões travados.
      router.push("/admin/pesquisas");
    } catch (deleteError) {
      // O banco recusa avaliação publicada ou com respostas, e a razão vem na
      // própria mensagem — é ela que explica ao operador por que não deu.
      toast.error(deleteError instanceof Error ? deleteError.message : "Não foi possível excluir a avaliação.");
    } finally {
      setWorking(false);
    }
  }

  function openMoveQuestion(sourceSectionId: string, question: Question) {
    const targets = questionMoveTargets(
      builder?.sections ?? [],
      sourceSectionId,
    );
    if (!targets.length) {
      toast.info("Crie outra seção antes de mover esta pergunta.");
      return;
    }

    setQuestionMoveEditor({
      questionId: question.id,
      questionTitle: question.title,
      sourceSectionId,
      targetSectionId: targets[0].id,
    });
  }

  function closeMoveQuestion() {
    if (working) return;
    setQuestionMoveEditor(null);
  }

  async function moveQuestionToSection() {
    if (!questionMoveEditor?.targetSectionId) return;

    setWorking(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: moveError } = await supabase.rpc(
        "move_survey_question_to_section",
        {
          target_question_id: questionMoveEditor.questionId,
          target_section_id: questionMoveEditor.targetSectionId,
        },
      );
      if (moveError) throw moveError;

      toast.success("Pergunta movida para a nova seção.");
      setQuestionMoveEditor(null);
      await loadBuilder(false);
    } catch (moveError) {
      toast.error(
        moveError instanceof Error
          ? moveError.message
          : "Não foi possível mover a pergunta entre seções.",
      );
    } finally {
      setWorking(false);
    }
  }

  function operationKey(
    action: "DUPLICATE" | "MOVE",
    itemType: "SECTION" | "QUESTION",
    itemId: string,
    direction?: MoveDirection,
  ) {
    return [action, itemType, itemId, direction].filter(Boolean).join(":");
  }

  async function duplicateItem(
    itemType: "SECTION" | "QUESTION",
    itemId: string,
  ) {
    const key = operationKey("DUPLICATE", itemType, itemId);
    setItemOperation(key);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: duplicateError } = await supabase.rpc(
        "duplicate_survey_builder_item",
        {
          target_item_type: itemType,
          target_item_id: itemId,
        },
      );
      if (duplicateError) throw duplicateError;

      toast.success(
        itemType === "SECTION"
          ? "Seção duplicada ao final do formulário."
          : "Pergunta duplicada ao final da seção.",
      );
      await loadBuilder(false);
    } catch (duplicateError) {
      toast.error(
        duplicateError instanceof Error
          ? duplicateError.message
          : "Não foi possível duplicar o item.",
      );
    } finally {
      setItemOperation(null);
    }
  }

  async function moveItem(
    itemType: "SECTION" | "QUESTION",
    itemId: string,
    direction: MoveDirection,
  ) {
    const key = operationKey("MOVE", itemType, itemId, direction);
    setItemOperation(key);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: moveError } = await supabase.rpc(
        "reorder_survey_builder_item",
        {
          target_item_type: itemType,
          target_item_id: itemId,
          target_direction: direction,
        },
      );
      if (moveError) throw moveError;

      toast.success(
        `${itemType === "SECTION" ? "Seção" : "Pergunta"} movida para ${direction === "UP" ? "cima" : "baixo"}.`,
      );
      await loadBuilder(false);
    } catch (moveError) {
      toast.error(
        moveError instanceof Error
          ? moveError.message
          : "Não foi possível reordenar o item.",
      );
    } finally {
      setItemOperation(null);
    }
  }

  if (guard.state !== "granted") {
    return <PlatformGuardState
      guard={guard}
      title="construtor"
      restrictedTitle="Construtor de avaliações restrito"
      restrictedDescription="Seu perfil não possui permissão para construir avaliações."
    />;
  }

  return (
    <PlatformShell
      user={guard.user}
      eyebrow="Administração"
      title={builder?.survey.name ?? "Studio de avaliação"}
    >
      {dataLoading ? (
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--brand-primary)]" aria-label="Carregando Studio" />
        </div>
      ) : !builder ? (
        <div className="mx-auto max-w-2xl py-16">
          <ErrorSummary title="Não foi possível abrir o Studio" errors={[loadError || "Avaliação não encontrada."]} />
          <Button className="mt-5" onClick={() => void loadBuilder()}>Tentar novamente</Button>
        </div>
      ) : (
        <>
          {/* Navegação da tela dentro do conteúdo principal, e não na barra
              superior: o cabeçalho é da casca da aplicação, então ações da rota
              ficam junto do que elas afetam. */}
          <nav aria-label="Ações do formulário" className="mb-5 flex flex-wrap items-center gap-2">
            <Link
              href="/admin/pesquisas"
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Voltar ao catálogo
            </Link>
          </nav>

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:p-8">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-[var(--brand-primary)]">{builder.survey.code}</span>
                  <span className={isDraft
                    ? "rounded-full bg-amber-100 px-3 py-1.5 text-xs font-black text-amber-800"
                    : "rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-800"
                  }>
                    {isDraft ? "Rascunho editável" : "Versão protegida"}
                  </span>
                </div>
                <div className="mt-5 flex items-start gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--brand-solid)] text-white shadow-sm">
                    <Sparkles className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-2xl font-black text-[var(--brand-primary)] sm:text-3xl">Studio de avaliação</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
                      Organize seções, edite perguntas e revise alternativas em um fluxo seguro antes da publicação.
                    </p>
                  </div>
                </div>
              </div>
              {isDraft ? (
                <Button size="lg" onClick={openNewSection}>
                  <Plus className="h-5 w-5" aria-hidden="true" /> Nova seção
                </Button>
              ) : (
                <div className="flex max-w-sm items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
                  <p className="text-sm leading-5"><strong className="block">Conteúdo imutável</strong>Crie uma nova versão para realizar alterações.</p>
                </div>
              )}
            </div>
            <div className="grid border-t border-slate-200 bg-slate-50/70 sm:grid-cols-3">
              {[
                ["Seções", builder.sections.length],
                ["Perguntas", totalQuestions],
                // Era `builder.application.status` cru: a tela exibia "OPEN"
                // enquanto /operacao e /equipe mostravam "Aberto" para o mesmo
                // ciclo. Código do banco não é rótulo de interface.
                ["Ciclo", cycleStatusLabel(builder.application.status)],
              ].map(([label, value], index) => (
                <div key={String(label)} className={`px-6 py-4 ${index > 0 ? "border-t border-slate-200 sm:border-l sm:border-t-0" : ""}`}>
                  <p className="text-[11px] font-black uppercase tracking-[.14em] text-slate-400">{label}</p>
                  <strong className="mt-1 block text-lg font-black text-[var(--brand-primary)]">{value}</strong>
                </div>
              ))}
            </div>
          </section>

          <div className="mt-6 space-y-5">
            {builder.sections.length === 0 ? (
              <EmptyState
                title="Comece pela primeira seção"
                description="As seções organizam o instrumento em etapas claras para quem vai responder."
                icon={<Settings2 className="h-6 w-6" aria-hidden="true" />}
                action={
                  isDraft ? (
                    <Button onClick={openNewSection}>
                      <Plus className="h-4 w-4" /> Criar seção
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              builder.sections.map((section, sectionIndex) => {
                const sectionMoves = moveAvailability(
                  sectionIndex,
                  builder.sections.length,
                );
                const duplicateSectionKey = operationKey(
                  "DUPLICATE",
                  "SECTION",
                  section.id,
                );
                const moveSectionUpKey = operationKey(
                  "MOVE",
                  "SECTION",
                  section.id,
                  "UP",
                );
                const moveSectionDownKey = operationKey(
                  "MOVE",
                  "SECTION",
                  section.id,
                  "DOWN",
                );
                const mutationDisabled = working || Boolean(itemOperation);

                return (
                  <section
                    key={section.id}
                    className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
                  >
                    <header className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
                      <div className="flex min-w-0 items-start gap-4">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-50 font-black text-[var(--brand-primary)]">
                          {sectionIndex + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-black uppercase tracking-[.12em] text-[var(--brand-secondary)]">
                            {section.code}
                          </p>
                          <h3 className="mt-1 text-xl font-black text-[var(--brand-primary)]">
                            {section.title}
                          </h3>
                          <p className="mt-1 text-sm leading-6 text-slate-500">
                            {section.description || "Sem descrição."}
                          </p>
                        </div>
                      </div>
                      {isDraft && (
                        <div className="flex flex-wrap gap-2 sm:justify-end">
                          <div
                            className="flex overflow-hidden rounded-lg border border-slate-200"
                            aria-label={`Ordenar seção ${section.title}`}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-9 rounded-none border-r border-slate-200 px-0"
                              disabled={!sectionMoves.up || mutationDisabled}
                              aria-label={`Mover a seção ${section.title} para cima`}
                              title="Mover seção para cima"
                              onClick={() =>
                                void moveItem("SECTION", section.id, "UP")
                              }
                            >
                              {itemOperation === moveSectionUpKey ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <ArrowUp
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-9 rounded-none px-0"
                              disabled={!sectionMoves.down || mutationDisabled}
                              aria-label={`Mover a seção ${section.title} para baixo`}
                              title="Mover seção para baixo"
                              onClick={() =>
                                void moveItem("SECTION", section.id, "DOWN")
                              }
                            >
                              {itemOperation === moveSectionDownKey ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <ArrowDown
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                              )}
                            </Button>
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={mutationDisabled}
                            onClick={() =>
                              void duplicateItem("SECTION", section.id)
                            }
                          >
                            {itemOperation === duplicateSectionKey ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Copy className="h-4 w-4" aria-hidden="true" />
                            )}
                            Duplicar
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={mutationDisabled}
                            onClick={() => openEditSection(section)}
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />{" "}
                            Editar seção
                          </Button>
                          <Button
                            size="sm"
                            disabled={mutationDisabled}
                            onClick={() => openNewQuestion(section.id)}
                          >
                            <Plus className="h-4 w-4" aria-hidden="true" />{" "}
                            Pergunta
                          </Button>
                        </div>
                      )}
                    </header>
                    <div className="p-4 sm:p-5">
                      {section.questions.length ? (
                        <ol className="space-y-3">
                          {section.questions.map((question, index) => {
                            const questionMoves = moveAvailability(
                              index,
                              section.questions.length,
                            );
                            const duplicateQuestionKey = operationKey(
                              "DUPLICATE",
                              "QUESTION",
                              question.id,
                            );
                            const moveQuestionUpKey = operationKey(
                              "MOVE",
                              "QUESTION",
                              question.id,
                              "UP",
                            );
                            const moveQuestionDownKey = operationKey(
                              "MOVE",
                              "QUESTION",
                              question.id,
                              "DOWN",
                            );

                            return (
                              <li key={question.id}>
                                <article className="group flex flex-col gap-4 rounded-2xl border border-slate-200 p-4 transition hover:border-slate-300 hover:shadow-sm sm:flex-row sm:items-start">
                                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-sm font-black text-[var(--brand-primary)]">
                                    {index + 1}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <strong className="text-slate-900">
                                        {question.title}
                                      </strong>
                                      {question.required && (
                                        <span className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-black text-red-700">
                                          Obrigatória
                                        </span>
                                      )}
                                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">
                                        {questionTypeLabel(
                                          question.questionType,
                                        )}
                                      </span>
                                    </div>
                                    {question.description && (
                                      <p className="mt-2 text-sm leading-6 text-slate-500">
                                        {question.description}
                                      </p>
                                    )}
                                    {question.options.length > 0 && (
                                      <div className="mt-3 flex flex-wrap gap-2">
                                        {question.options.map((option) => (
                                          <span
                                            key={`${question.id}-${option.id ?? option.value}`}
                                            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600"
                                          >
                                            {option.label}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  {isDraft && (
                                    <div className="flex shrink-0 flex-wrap gap-2">
                                      <div
                                        className="flex overflow-hidden rounded-lg border border-slate-200"
                                        aria-label={`Ordenar pergunta ${question.title}`}
                                      >
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="w-9 rounded-none border-r border-slate-200 px-0"
                                          disabled={
                                            !questionMoves.up ||
                                            mutationDisabled
                                          }
                                          aria-label={`Mover a pergunta ${question.title} para cima`}
                                          title="Mover pergunta para cima"
                                          onClick={() =>
                                            void moveItem(
                                              "QUESTION",
                                              question.id,
                                              "UP",
                                            )
                                          }
                                        >
                                          {itemOperation ===
                                          moveQuestionUpKey ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                          ) : (
                                            <ArrowUp
                                              className="h-4 w-4"
                                              aria-hidden="true"
                                            />
                                          )}
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="w-9 rounded-none px-0"
                                          disabled={
                                            !questionMoves.down ||
                                            mutationDisabled
                                          }
                                          aria-label={`Mover a pergunta ${question.title} para baixo`}
                                          title="Mover pergunta para baixo"
                                          onClick={() =>
                                            void moveItem(
                                              "QUESTION",
                                              question.id,
                                              "DOWN",
                                            )
                                          }
                                        >
                                          {itemOperation ===
                                          moveQuestionDownKey ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                          ) : (
                                            <ArrowDown
                                              className="h-4 w-4"
                                              aria-hidden="true"
                                            />
                                          )}
                                        </Button>
                                      </div>
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        disabled={mutationDisabled}
                                        aria-label={`Duplicar a pergunta ${question.title}`}
                                        onClick={() =>
                                          void duplicateItem(
                                            "QUESTION",
                                            question.id,
                                          )
                                        }
                                      >
                                        {itemOperation ===
                                        duplicateQuestionKey ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Copy
                                            className="h-4 w-4"
                                            aria-hidden="true"
                                          />
                                        )}
                                        Duplicar
                                      </Button>
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        disabled={
                                          mutationDisabled ||
                                          builder.sections.length < 2
                                        }
                                        aria-label={`Mover a pergunta ${question.title} para outra seção`}
                                        title={
                                          builder.sections.length < 2
                                            ? "Crie outra seção para mover esta pergunta"
                                            : "Mover pergunta para outra seção"
                                        }
                                        onClick={() =>
                                          openMoveQuestion(section.id, question)
                                        }
                                      >
                                        <FolderInput
                                          className="h-4 w-4"
                                          aria-hidden="true"
                                        />
                                        Mover
                                      </Button>
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        disabled={mutationDisabled}
                                        onClick={() =>
                                          openEditQuestion(section.id, question)
                                        }
                                      >
                                        <Pencil
                                          className="h-4 w-4"
                                          aria-hidden="true"
                                        />{" "}
                                        Editar
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-red-700 hover:bg-red-50"
                                        disabled={mutationDisabled}
                                        onClick={() =>
                                          setDeleteTarget(question)
                                        }
                                      >
                                        <Trash2
                                          className="h-4 w-4"
                                          aria-hidden="true"
                                        />{" "}
                                        Excluir
                                      </Button>
                                    </div>
                                  )}
                                </article>
                              </li>
                            );
                          })}
                        </ol>
                      ) : (
                        <EmptyState
                          title="Seção ainda sem perguntas"
                          description="Adicione o primeiro item desta etapa para começar a estruturar o formulário."
                          icon={
                            <Settings2 className="h-6 w-6" aria-hidden="true" />
                          }
                          action={
                            isDraft ? (
                              <Button
                                size="sm"
                                onClick={() => openNewQuestion(section.id)}
                              >
                                <Plus className="h-4 w-4" /> Adicionar pergunta
                              </Button>
                            ) : undefined
                          }
                          className="border-slate-200 bg-slate-50/50"
                        />
                      )}
                    </div>
                  </section>
                );
              })
            )}
          </div>

          {/* Zona destrutiva no fim da página, longe das ações do dia a dia: a
              exclusão só faz sentido enquanto a versão é rascunho — publicada, a
              estrutura é referência histórica de quem respondeu e o banco
              recusa. Fora do rascunho a seção nem aparece. */}
          {isDraft && (
            <section className="mt-8 rounded-3xl border border-red-200 bg-red-50/60 p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-lg font-black text-red-900">Excluir formulário</h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-red-800">
                    Remove definitivamente a avaliação, o ciclo, as seções, as perguntas e as alternativas. A exclusão é recusada se a avaliação já tiver sido publicada ou já possuir respostas.
                  </p>
                </div>
                <Button
                  variant="danger"
                  className="shrink-0"
                  disabled={working}
                  onClick={() => setSurveyDeleteOpen(true)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Excluir formulário
                </Button>
              </div>
            </section>
          )}
        </>
      )}

      <Dialog
        open={Boolean(sectionEditor)}
        onOpenChange={(open) => { if (!open) closeSectionEditor(); }}
        eyebrow="Survey Studio"
        title={sectionEditor?.mode === "edit" ? "Editar seção" : "Nova seção"}
        description="Use um título objetivo e uma descrição breve para orientar quem responde."
      >
        {sectionEditor && (
          <form onSubmit={(event) => { event.preventDefault(); void saveSection(); }} noValidate>
            {sectionHasUnsavedChanges && <UnsavedChangesNotice />}
            <ErrorSummary errors={sectionErrors} className="mb-5" />
            <div className="space-y-5">
              <Input
                label="Título"
                value={sectionEditor.title}
                onChange={(event) => setSectionEditor({ ...sectionEditor, title: event.target.value })}
                maxLength={160}
                required
                error={sectionErrors.find((item) => item.toLocaleLowerCase("pt-BR").includes("título"))}
                autoFocus
              />
              <Textarea
                label="Descrição"
                value={sectionEditor.description}
                onChange={(event) => setSectionEditor({ ...sectionEditor, description: event.target.value })}
                maxLength={1_000}
                rows={4}
                error={sectionErrors.find((item) => item.toLocaleLowerCase("pt-BR").includes("descrição"))}
              />
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={closeSectionEditor}>Cancelar</Button>
              <Button type="submit" disabled={working}>
                {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {sectionEditor.mode === "edit" ? "Salvar alterações" : "Criar seção"}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      <Dialog
        open={Boolean(questionEditor)}
        onOpenChange={(open) => { if (!open) closeQuestionEditor(); }}
        eyebrow="Survey Studio"
        title={questionEditor?.mode === "edit" ? "Editar pergunta" : "Nova pergunta"}
        description="Defina o enunciado, o tipo de resposta e as alternativas que serão exibidas."
      >
        {questionEditor && (
          <form onSubmit={(event) => { event.preventDefault(); void saveQuestion(); }} noValidate>
            {questionHasUnsavedChanges && <UnsavedChangesNotice />}
            <ErrorSummary errors={questionErrors} className="mb-5" />
            <div className="space-y-5">
              <Input
                label="Enunciado"
                value={questionEditor.title}
                onChange={(event) => setQuestionEditor({ ...questionEditor, title: event.target.value })}
                maxLength={500}
                required
                error={questionErrors.find((item) => item.toLocaleLowerCase("pt-BR").includes("enunciado"))}
                autoFocus
              />
              <Textarea
                label="Descrição"
                value={questionEditor.description}
                onChange={(event) => setQuestionEditor({ ...questionEditor, description: event.target.value })}
                maxLength={2_000}
                rows={3}
                error={questionErrors.find((item) => item.toLocaleLowerCase("pt-BR").includes("descrição"))}
              />

              <fieldset>
                <legend className="text-sm font-semibold text-slate-800">Tipo de resposta</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {QUESTION_TYPES.map(({ value, label }) => {
                    const Icon = QUESTION_TYPE_ICONS[value];
                    const selected = questionEditor.questionType === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setQuestionEditor({
                          ...questionEditor,
                          questionType: value,
                          optionsText: needsQuestionOptions(value) && !questionEditor.optionsText.trim()
                            ? "Opção 1\nOpção 2"
                            : questionEditor.optionsText,
                        })}
                        className={selected
                          ? "flex items-center gap-3 rounded-xl border border-blue-400 bg-blue-50 p-3 text-left text-sm font-black text-[var(--brand-primary)] shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
                          : "flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
                        }
                      >
                        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                        <span>{label}</span>
                        {selected && <Check className="ml-auto h-4 w-4" aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {needsQuestionOptions(questionEditor.questionType) && (
                <Textarea
                  label="Alternativas"
                  hint="Informe uma alternativa por linha. Valores e pontuações existentes são preservados durante a edição."
                  value={questionEditor.optionsText}
                  onChange={(event) => setQuestionEditor({ ...questionEditor, optionsText: event.target.value })}
                  rows={6}
                  required
                  error={questionErrors.find((item) => item.toLocaleLowerCase("pt-BR").includes("alternativa"))}
                />
              )}

              <Checkbox
                label="Resposta obrigatória"
                description="A pessoa precisará responder este item antes de concluir o formulário."
                checked={questionEditor.required}
                onChange={(event) => setQuestionEditor({ ...questionEditor, required: event.target.checked })}
              />
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={closeQuestionEditor}>Cancelar</Button>
              <Button type="submit" disabled={working}>
                {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {questionEditor.mode === "edit" ? "Salvar alterações" : "Criar pergunta"}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      <Dialog
        open={Boolean(questionMoveEditor)}
        onOpenChange={(open) => { if (!open) closeMoveQuestion(); }}
        eyebrow="Organização do formulário"
        title="Mover pergunta"
        description="Escolha a seção de destino. A pergunta e todas as suas alternativas serão preservadas."
        className="max-w-lg"
      >
        {questionMoveEditor && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void moveQuestionToSection();
            }}
          >
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-xs font-black uppercase tracking-[.12em] text-blue-700">
                Pergunta selecionada
              </p>
              <p className="mt-2 text-sm font-black text-[var(--brand-primary)]">
                {questionMoveEditor.questionTitle}
              </p>
              <p className="mt-1 text-xs text-blue-800">
                Seção atual: {moveSourceSection?.title ?? "Não identificada"}
              </p>
            </div>

            <Select
              label="Seção de destino"
              hint="A pergunta será adicionada ao final da seção escolhida."
              value={questionMoveEditor.targetSectionId}
              onChange={(event) =>
                setQuestionMoveEditor({
                  ...questionMoveEditor,
                  targetSectionId: event.target.value,
                })
              }
              containerClassName="mt-5"
              required
              autoFocus
            >
              {moveTargetSections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.title}
                </option>
              ))}
            </Select>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="secondary"
                disabled={working}
                onClick={closeMoveQuestion}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={working || moveTargetSections.length === 0}
              >
                {working ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FolderInput className="h-4 w-4" aria-hidden="true" />
                )}
                Mover pergunta
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => { if (!open && !working) setDeleteTarget(null); }}
        eyebrow="Ação permanente"
        title="Excluir pergunta?"
        description="A pergunta e suas alternativas serão removidas deste rascunho. Esta ação não afeta versões já publicadas."
        className="max-w-lg"
      >
        {deleteTarget && (
          <div>
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-950">{deleteTarget.title}</p>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" disabled={working} onClick={() => setDeleteTarget(null)}>Cancelar</Button>
              <Button variant="danger" disabled={working} onClick={() => void deleteQuestion()}>
                {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Excluir pergunta
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        open={surveyDeleteOpen}
        onOpenChange={(open) => { if (!open && !working) setSurveyDeleteOpen(false); }}
        eyebrow="Ação permanente"
        // O nome do formulário vai no título da confirmação: quem chega aqui
        // precisa reconhecer o que está apagando antes de confirmar.
        title={`Você tem certeza que quer excluir o formulário ${builder?.survey.name ?? ""}?`}
        description="A avaliação, o ciclo, as seções, as perguntas e as alternativas serão removidos definitivamente. A exclusão é recusada se a avaliação já tiver sido publicada ou já possuir respostas."
        className="max-w-lg"
      >
        {builder && (
          <div>
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-xs font-black uppercase tracking-[.12em] text-red-700">{builder.survey.code}</p>
              <p className="mt-2 text-sm font-semibold text-red-950">{builder.survey.name}</p>
              <p className="mt-2 text-xs leading-5 text-red-900">
                {builder.sections.length} {builder.sections.length === 1 ? "seção" : "seções"} · {totalQuestions} {totalQuestions === 1 ? "pergunta" : "perguntas"}
              </p>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" disabled={working} onClick={() => { if (!working) setSurveyDeleteOpen(false); }}>Cancelar</Button>
              <Button variant="danger" disabled={working} onClick={() => void deleteSurvey()}>
                {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Excluir formulário
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </PlatformShell>
  );
}
