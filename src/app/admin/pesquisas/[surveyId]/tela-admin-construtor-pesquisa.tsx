"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlignLeft,
  ArrowDown,

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
  GitBranch,
  Hash,
  Loader2,
  Pencil,
  Plus,
  Save,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,

  ToggleLeft,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { PlatformShell } from "@/components/platform-shell";
import { BotaoProximaEtapa, CabecalhoDaConfiguracao } from "@/components/configuracao-avaliacao";
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
import { errorMessageFromUnknown } from "@/lib/observability";
import { cycleStatusLabel } from "@/lib/survey-status-labels";
import {
  atualizarPergunta,
  atualizarSecao,
  criarPergunta,
  criarSecao,
  duplicarItemDoConstrutor,
  excluirPergunta,
  moverPergunta,
  excluirRegraCondicional,
  listarRegrasCondicionais,
  obterConstrutor,
  reordenarItemDoConstrutor,
  salvarRegraCondicional,
} from "@/lib/api/cliente-construtor";
import type {
  ConstrutorAvaliacao,
  PerguntaConstrutor,
  RegraCondicional,
  SecaoConstrutor,
} from "@/lib/api/contratos-construtor";
import { SurveyRuleEditor } from "@/components/survey-rule-editor";
import type { SurveyRuleCondition } from "@/lib/survey-conditional-logic";
import {
  emptyRuleDraft,
  normalizeCondition,
  ruleSummary,
  type RuleDraft,
  type RuleQuestionRef,
} from "@/lib/survey-rule-builder";

// A estrutura do formulário agora vem do contrato da API, e não de uma cópia
// local. O mesmo formato estava declarado aqui e na tela de identidade visual,
// que conhecia só `application` e `survey.name` — as duas divergiam em silêncio
// porque cada uma copiava do retorno da RPC apenas o que ia usar.
type Question = PerguntaConstrutor;
type Section = SecaoConstrutor;
type BuilderData = ConstrutorAvaliacao;

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
      className="mb-5 flex items-start gap-3 rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-4 text-[var(--status-warning-text)]"
    >
      <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold">Alterações não salvas</p>
        <p className="mt-1 text-xs leading-5 text-[var(--status-warning-text)]">
          Salve antes de fechar esta janela para não perder o que foi alterado.
        </p>
      </div>
    </div>
  );
}

export default function SurveyBuilderPage({ params }: { params: Promise<{ surveyId: string }> }) {
  const confirm = useConfirm();
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
  const [working, setWorking] = useState(false);
  const [itemOperation, setItemOperation] = useState<string | null>(null);
  const [rules, setRules] = useState<RegraCondicional[]>([]);
  const [ruleDraft, setRuleDraft] = useState<RuleDraft | null>(null);
  const [ruleTargetLabel, setRuleTargetLabel] = useState("");
  /*
    Indicador de gravação.

    Seção e pergunta são persistidas ao confirmar o editor — não existe rascunho
    global esperando um botão "Salvar". Mas a tela não dizia isso: o aviso era
    um toast que some, e quem fecha o diálogo fica sem sinal de que o trabalho
    ficou guardado.

    O estado vive num lugar só, alimentado por `avisarSalvo`, chamado nos mesmos
    pontos em que o sucesso já era anunciado. "Salvo" apaga sozinho depois de
    alguns segundos: indicador permanente vira decoração e deixa de ser lido.
  */
  const [gravacao, setGravacao] = useState<"ocioso" | "salvo">("ocioso");

  const avisarSalvo = useCallback((mensagem: string) => {
    toast.success(mensagem);
    setGravacao("salvo");
  }, []);

  useEffect(() => {
    if (gravacao !== "salvo") return;
    const temporizador = window.setTimeout(() => setGravacao("ocioso"), 4000);
    return () => window.clearTimeout(temporizador);
  }, [gravacao]);

  const loadBuilder = useCallback(async (showLoader = true) => {
    if (showLoader) setDataLoading(true);
    setLoadError("");
    try {
      const estrutura = await obterConstrutor(surveyId);
      setBuilder(estrutura);

      // As regras vêm depois, e a falha delas não derruba o construtor: sem
      // regra o instrumento aparece inteiro, que é como ele se comportava antes
      // de existir lógica condicional. Deixar de editar seções e perguntas
      // porque a lista de regras falhou seria desproporcional.
      try {
        setRules(await listarRegrasCondicionais(surveyId, estrutura.version.id));
      } catch (rulesError) {
        setRules([]);
        toast.error(errorMessageFromUnknown(rulesError));
      }
    } catch (loadBuilderError) {
      const message = errorMessageFromUnknown(loadBuilderError);
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

  /** Todas as perguntas da versão, achatadas — é o universo de origens possíveis. */
  const ruleQuestions = useMemo<RuleQuestionRef[]>(
    () =>
      builder?.sections.flatMap((section) =>
        section.questions.map((question) => ({
          id: question.id,
          title: question.title,
          sectionId: section.id,
          options: question.options,
        })),
      ) ?? [],
    [builder],
  );

  /** Regra vigente por alvo. O banco garante no máximo uma. */
  const rulesByTarget = useMemo(
    () => new Map(rules.map((rule) => [rule.targetId, rule])),
    [rules],
  );

  function openRuleEditor(targetType: "QUESTION" | "SECTION", targetId: string, label: string) {
    const saved = rulesByTarget.get(targetId);
    setRuleTargetLabel(label);
    setRuleDraft(
      saved
        ? {
            targetType: saved.targetType,
            targetId: saved.targetId,
            action: saved.action,
            connector: saved.connector,
            description: saved.description ?? "",
            conditions: saved.conditions.map((condition) => ({
              questionId: condition.questionId,
              operator: condition.operator as SurveyRuleCondition["operator"],
              optionId: condition.optionId,
              value: condition.value,
            })),
          }
        : emptyRuleDraft(targetType, targetId),
    );
  }

  async function saveRule(draft: RuleDraft) {
    setWorking(true);
    try {
      await salvarRegraCondicional(surveyId, {
        targetType: draft.targetType,
        targetId: draft.targetId,
        action: draft.action,
        connector: draft.connector,
        description: draft.description || null,
        conditions: draft.conditions.map(normalizeCondition),
      });
      avisarSalvo("Regra salva.");
      setRuleDraft(null);
      await loadBuilder(false);
    } catch (saveRuleError) {
      // Dependência circular chega por aqui: quem percorre o grafo é
      // `fc_regra_gera_ciclo()`, e a mensagem dele já explica o problema.
      toast.error(errorMessageFromUnknown(saveRuleError));
    } finally {
      setWorking(false);
    }
  }

  async function removeRule(targetId: string) {
    // O editor precisa fechar **antes** de confirmar. Ele é um `<dialog>`
    // nativo, que o navegador coloca na camada superior; o diálogo de
    // `useConfirm()` é uma camada comum e ficaria atrás dele — presente no DOM,
    // invisível e inalcançável. Guardamos o rascunho para devolvê-lo intacto
    // a quem desistir, inclusive com as alterações ainda não salvas.
    const rascunho = ruleDraft;
    setRuleDraft(null);

    if (!(await confirm({
      title: "Remover a regra deste item?",
      description: "Sem regra, ele volta a aparecer sempre para quem responde.",
      confirmLabel: "Remover regra",
      tone: "danger",
    }))) {
      setRuleDraft(rascunho);
      return;
    }

    setWorking(true);
    try {
      await excluirRegraCondicional(surveyId, targetId);
      avisarSalvo("Regra removida.");
      setRuleDraft(null);
      await loadBuilder(false);
    } catch (removeRuleError) {
      toast.error(errorMessageFromUnknown(removeRuleError));
    } finally {
      setWorking(false);
    }
  }
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
      // Criar e editar são recursos distintos no REST — a coleção e o item —,
      // então a escolha entre eles é a chamada, não um par de nomes de RPC e um
      // objeto de argumentos montado condicionalmente.
      const entrada = {
        title: sectionEditor.title,
        description: sectionEditor.description || null,
      };
      if (sectionEditor.mode === "create" || !sectionEditor.sectionId) {
        await criarSecao(surveyId, entrada);
      } else {
        await atualizarSecao(surveyId, sectionEditor.sectionId, entrada);
      }

      avisarSalvo(sectionEditor.mode === "create" ? "Seção adicionada." : "Seção atualizada.");
      setSectionEditor(null);
      setSectionErrors([]);
      await loadBuilder(false);
    } catch (saveError) {
      const message = errorMessageFromUnknown(saveError);
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
      const conteudo = {
        title: questionEditor.title,
        description: questionEditor.description || "",
        questionType: questionEditor.questionType,
        required: questionEditor.required,
        options,
      };
      // A seção só aparece na criação: ao editar, a pergunta já pertence a uma,
      // e trocá-la é a operação de mover — outro recurso, outro verbo.
      if (questionEditor.mode === "create" || !questionEditor.questionId) {
        await criarPergunta(surveyId, { sectionId: questionEditor.sectionId, ...conteudo });
      } else {
        await atualizarPergunta(surveyId, questionEditor.questionId, conteudo);
      }

      avisarSalvo(questionEditor.mode === "create" ? "Pergunta adicionada." : "Pergunta atualizada.");
      setQuestionEditor(null);
      setQuestionErrors([]);
      await loadBuilder(false);
    } catch (saveError) {
      const message = errorMessageFromUnknown(saveError);
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
      await excluirPergunta(surveyId, deleteTarget.id);
      avisarSalvo("Pergunta excluída.");
      setDeleteTarget(null);
      await loadBuilder(false);
    } catch (deleteError) {
      toast.error(errorMessageFromUnknown(deleteError));
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
      await moverPergunta(
        surveyId,
        questionMoveEditor.questionId,
        questionMoveEditor.targetSectionId,
      );

      avisarSalvo("Pergunta movida para a nova seção.");
      setQuestionMoveEditor(null);
      await loadBuilder(false);
    } catch (moveError) {
      toast.error(errorMessageFromUnknown(moveError));
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
      await duplicarItemDoConstrutor(surveyId, itemType, itemId);

      avisarSalvo(
        itemType === "SECTION"
          ? "Seção duplicada ao final do formulário."
          : "Pergunta duplicada ao final da seção.",
      );
      await loadBuilder(false);
    } catch (duplicateError) {
      toast.error(errorMessageFromUnknown(duplicateError));
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
      await reordenarItemDoConstrutor(surveyId, itemType, itemId, direction);

      avisarSalvo(
        `${itemType === "SECTION" ? "Seção" : "Pergunta"} movida para ${direction === "UP" ? "cima" : "baixo"}.`,
      );
      await loadBuilder(false);
    } catch (moveError) {
      toast.error(errorMessageFromUnknown(moveError));
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
          {/*
            Cabeçalho compacto no lugar do cartão que ocupava a primeira dobra.

            O que saiu: ícone decorativo de 48px, título "Studio de avaliação",
            parágrafo explicando o que um construtor de formulário faz, e uma
            faixa de três indicadores em caixas separadas. Tudo isso dizia à
            pessoa em que tela ela já sabia estar, e empurrava a estrutura da
            avaliação — o conteúdo — para baixo da dobra.

            O nome da avaliação virou o título; código, estado e contagens cabem
            numa linha de texto. As mesmas informações, sem a moldura.
          */}
          <CabecalhoDaConfiguracao
            surveyId={surveyId}
            applicationId={builder.application.id}
            nome={builder.survey.name}
            etapa="estrutura"
            meta={[
              builder.survey.code,
              isDraft ? "Rascunho editável" : "Versão publicada",
              `${builder.sections.length} ${builder.sections.length === 1 ? "seção" : "seções"}`,
              `${totalQuestions} ${totalQuestions === 1 ? "pergunta" : "perguntas"}`,
              // `cycleStatusLabel` porque `application.status` é código do banco:
              // a tela chegou a exibir "OPEN" enquanto as vizinhas diziam
              // "Aberto" para o mesmo ciclo.
              `Ciclo ${cycleStatusLabel(builder.application.status).toLowerCase()}`,
            ]}
            acao={<>
              {/*
                Diz que a gravação já aconteceu, no lugar de um botão "Salvar"
                que sugeriria o contrário. Fica ao lado da ação seguinte porque
                é a mesma pergunta: "posso seguir?".
              */}
              {(working || itemOperation !== null) ? (
                <span role="status" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  Salvando...
                </span>
              ) : gravacao === "salvo" ? (
                <span role="status" className="inline-flex items-center gap-1.5 text-sm text-[var(--status-success-text)]">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  Salvo
                </span>
              ) : null}
              <BotaoProximaEtapa etapa="estrutura" surveyId={surveyId} applicationId={builder.application.id} />
            </>}
          />

          {!isDraft && (
            <p role="status" className="mt-5 flex items-start gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 text-sm leading-6 text-[var(--text-secondary)]">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                <strong className="font-semibold text-[var(--text-primary)]">Versão publicada.</strong>{" "}
                A estrutura não pode mais ser alterada. Para mudar perguntas, crie uma nova versão na etapa{" "}
                <Link href={`/admin/pesquisas/${surveyId}/operacao`} className="font-semibold text-[var(--brand-primary)] underline underline-offset-4">
                  Ciclo
                </Link>.
              </span>
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">Estrutura</h3>
            {isDraft && (
              <Button variant="secondary" onClick={openNewSection}>
                <Plus className="h-4 w-4" aria-hidden="true" /> Nova seção
              </Button>
            )}
          </div>

          <div className="mt-4 space-y-4">
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
                    className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-sm"
                  >
                    <header className="flex flex-col gap-4 border-b border-[var(--border-subtle)] p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
                      <div className="flex min-w-0 items-start gap-4">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--status-info-bg)] font-semibold text-[var(--brand-primary)]">
                          {sectionIndex + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-[.12em] text-[var(--brand-secondary)]">
                            {section.code}
                          </p>
                          <h3 className="mt-1 text-xl font-semibold text-[var(--brand-primary)]">
                            {section.title}
                          </h3>
                          <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                            {section.description || "Sem descrição."}
                          </p>
                          {rulesByTarget.has(section.id) && (
                            <p className="mt-2 flex items-start gap-2 text-xs font-semibold leading-5 text-[var(--brand-secondary)]">
                              <GitBranch className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              {ruleSummary(rulesByTarget.get(section.id)!, ruleQuestions)}
                            </p>
                          )}
                        </div>
                      </div>
                      {isDraft && (
                        <div className="flex flex-wrap gap-2 sm:justify-end">
                          <div
                            className="flex overflow-hidden rounded-lg border border-[var(--border-subtle)]"
                            aria-label={`Ordenar seção ${section.title}`}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-9 rounded-none border-r border-[var(--border-subtle)] px-0"
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
                            variant="secondary"
                            size="sm"
                            disabled={mutationDisabled}
                            aria-label={`Lógica condicional da seção ${section.title}`}
                            onClick={() => openRuleEditor("SECTION", section.id, section.title)}
                          >
                            <GitBranch className="h-4 w-4" aria-hidden="true" />{" "}
                            {rulesByTarget.has(section.id) ? "Editar regra" : "Regra"}
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
                                <article className="group flex flex-col gap-4 rounded-xl border border-[var(--border-subtle)] p-4 transition hover:border-[var(--border-strong)] hover:shadow-sm sm:flex-row sm:items-start">
                                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-sm font-semibold text-[var(--brand-primary)]">
                                    {index + 1}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <strong className="text-[var(--text-primary)]">
                                        {question.title}
                                      </strong>
                                      {question.required && (
                                        <span className="rounded-full bg-[var(--status-danger-bg)] px-2.5 py-1 text-[10px] font-semibold text-[var(--status-danger-text)]">
                                          Obrigatória
                                        </span>
                                      )}
                                      <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-[10px] font-semibold text-[var(--text-secondary)]">
                                        {questionTypeLabel(
                                          question.questionType,
                                        )}
                                      </span>
                                    </div>
                                    {/* O resumo aparece mesmo em versão
                                        publicada: a regra continua valendo para
                                        quem responde, e esconder a informação
                                        porque ela não é mais editável deixaria o
                                        operador sem saber por que uma pergunta
                                        não aparece. */}
                                    {rulesByTarget.has(question.id) && (
                                      <p className="mt-2 flex items-start gap-2 text-xs font-semibold leading-5 text-[var(--brand-secondary)]">
                                        <GitBranch className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                        {ruleSummary(rulesByTarget.get(question.id)!, ruleQuestions)}
                                      </p>
                                    )}
                                    {question.description && (
                                      <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                                        {question.description}
                                      </p>
                                    )}
                                    {question.options.length > 0 && (
                                      <div className="mt-3 flex flex-wrap gap-2">
                                        {question.options.map((option) => (
                                          <span
                                            key={`${question.id}-${option.id ?? option.value}`}
                                            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-bold text-[var(--text-secondary)]"
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
                                        className="flex overflow-hidden rounded-lg border border-[var(--border-subtle)]"
                                        aria-label={`Ordenar pergunta ${question.title}`}
                                      >
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="w-9 rounded-none border-r border-[var(--border-subtle)] px-0"
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
                                        aria-label={`Lógica condicional da pergunta ${question.title}`}
                                        title="Quando esta pergunta aparece"
                                        onClick={() =>
                                          openRuleEditor(
                                            "QUESTION",
                                            question.id,
                                            question.title,
                                          )
                                        }
                                      >
                                        <GitBranch
                                          className="h-4 w-4"
                                          aria-hidden="true"
                                        />
                                        {rulesByTarget.has(question.id) ? "Editar regra" : "Regra"}
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
                                        className="text-[var(--status-danger-text)] hover:bg-[var(--status-danger-bg)]"
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
                          className="border-[var(--border-subtle)] bg-[var(--surface-muted)]/50"
                        />
                      )}
                    </div>
                  </section>
                );
              })
            )}
          </div>

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
                <legend className="text-sm font-semibold text-[var(--text-primary)]">Tipo de resposta</legend>
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
                          ? "flex items-center gap-3 rounded-xl border border-[var(--focus-ring)] bg-[var(--status-info-bg)] p-3 text-left text-sm font-semibold text-[var(--brand-primary)] shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--status-info-border)]"
                          : "flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3 text-left text-sm font-semibold text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--status-info-border)]"
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
            <div className="rounded-xl border border-[var(--status-info-border)] bg-[var(--status-info-bg)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[.12em] text-[var(--status-info-text)]">
                Pergunta selecionada
              </p>
              <p className="mt-2 text-sm font-semibold text-[var(--brand-primary)]">
                {questionMoveEditor.questionTitle}
              </p>
              <p className="mt-1 text-xs text-[var(--status-info-text)]">
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
            <div className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-4">
              <p className="text-sm font-semibold text-[var(--status-danger-text)]">{deleteTarget.title}</p>
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

      <SurveyRuleEditor
        draft={ruleDraft}
        onDraftChange={setRuleDraft}
        targetLabel={ruleTargetLabel}
        questions={ruleQuestions}
        hasSavedRule={Boolean(ruleDraft && rulesByTarget.has(ruleDraft.targetId))}
        working={working}
        onClose={() => setRuleDraft(null)}
        onSave={(draft) => void saveRule(draft)}
        onDelete={() => { if (ruleDraft) void removeRule(ruleDraft.targetId); }}
      />
    </PlatformShell>
  );
}
