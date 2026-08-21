/**
 * Contratos do construtor de formulários e da operação de ciclos.
 *
 * Declaram o retorno real de `get_survey_builder`,
 * `get_application_visual_settings` e `get_survey_operations`. O formato de
 * erro (`ErroApi`) é único e mora em `contratos.ts`.
 */

import type { SurveyRuleOperator } from "@/lib/survey-conditional-logic";

/**
 * Alternativa de uma pergunta.
 *
 * Precisa permanecer atribuível a `SurveyOption` de `@/lib/survey-builder`, que
 * é quem monta as alternativas a partir do texto do editor.
 */
export type OpcaoPergunta = {
  id?: string;
  label: string;
  value: string;
  score?: number | null;
  position?: number;
};

/** Pergunta de uma seção, no formato de `get_survey_builder`. */
export type PerguntaConstrutor = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  questionType: string;
  required: boolean;
  position: number;
  options: OpcaoPergunta[];
};

/** Seção do formulário, com as perguntas já aninhadas. */
export type SecaoConstrutor = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  position: number;
  questions: PerguntaConstrutor[];
};

/** Agregado devolvido por `GET /api/avaliacoes/[id]/construtor`. */
export type ConstrutorAvaliacao = {
  status: string;
  survey: { id: string; code: string; name: string; description: string | null; status: string };
  version: { id: string; number: number; status: string };
  application: { id: string; code: string; name: string; status: string; opensAt: string | null; closesAt: string | null };
  sections: SecaoConstrutor[];
};

/** Corpo de `POST /api/avaliacoes/[id]/secoes` e `PATCH …/secoes/[secaoId]`. */
export type SecaoEntrada = {
  title: string;
  description?: string | null;
};

/**
 * Corpo de `POST /api/avaliacoes/[id]/perguntas`.
 *
 * `sectionId` só existe na criação: trocar a seção de uma pergunta existente é
 * a operação de mover, em outro recurso.
 */
export type PerguntaEntrada = {
  sectionId: string;
  title: string;
  description?: string | null;
  questionType: string;
  required: boolean;
  options: OpcaoPergunta[];
};

/** Corpo de `PATCH /api/avaliacoes/[id]/perguntas/[perguntaId]`. */
export type PerguntaAtualizacaoEntrada = Omit<PerguntaEntrada, "sectionId">;

/** Corpo de `PUT /api/avaliacoes/[id]/perguntas/[perguntaId]/secao`. */
export type MoverPerguntaEntrada = {
  sectionId: string;
};

/** Tipo do item manipulado pelas operações de estrutura do construtor. */
export type TipoItemConstrutor = "SECTION" | "QUESTION";

/** Sentido da reordenação de um item dentro do seu par. */
export type DirecaoItemConstrutor = "UP" | "DOWN";

/** Corpo de `POST /api/avaliacoes/[id]/itens/copia`. */
export type DuplicarItemEntrada = {
  itemType: TipoItemConstrutor;
  itemId: string;
};

/** Corpo de `POST /api/avaliacoes/[id]/itens/ordem`. */
export type ReordenarItemEntrada = DuplicarItemEntrada & {
  direction: DirecaoItemConstrutor;
};

/**
 * Capa e textos de abertura de um ciclo.
 *
 * `themeVariant: "CUSTOM"` é o que faz a imagem enviada valer; voltar a
 * `INSTITUTIONAL` restaura a arte padrão sem apagar a URL gravada, então o
 * operador alterna entre as duas sem perder o ajuste. `bannerPath` é o caminho
 * no bucket `survey-assets` — a RPC exige que ele apareça na URL e pertença a
 * esta aplicação.
 */
export type IdentidadeVisual = {
  bannerUrl: string | null;
  bannerPath: string | null;
  bannerAlt: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  themeVariant: "INSTITUTIONAL" | "CUSTOM";
};

/** Retorno de `GET /api/avaliacoes/[id]/identidade-visual`. */
export type IdentidadeVisualAplicacao = {
  status: string;
  applicationId: string;
  applicationCode: string;
  applicationName: string;
  visualIdentity: IdentidadeVisual;
};

/** Pendência apontada pela validação de integridade antes da publicação. */
export type PendenciaCiclo = {
  id?: string;
  code: string;
  severity: "BLOCKING" | "WARNING";
  category?: "STRUCTURE" | "CYCLE" | "PERIOD" | "AUDIENCE";
  entityType?: string;
  entityId?: string;
  message: string;
  action?: string;
};

/** Agregado devolvido por `GET /api/avaliacoes/[id]/ciclo`. */
export type OperacaoCiclo = {
  status: string;
  survey: { id: string; code: string; name: string; status: string; description: string | null };
  version: { id: string; number: number; status: string };
  application: {
    id: string;
    code: string;
    name: string;
    status: string;
    opensAt: string | null;
    closesAt: string | null;
    allowDrafts: boolean;
    anonymous?: boolean;
    accessMode?: string;
    /** Envio automático de e-mails aos participantes (abertura e 24 h finais). */
    emailNotifications?: boolean;
  } | null;
  metrics: {
    sections: number;
    questions: number;
    requiredQuestions: number;
    participants: number;
    draftSubmissions: number;
    submittedSubmissions: number;
  };
  issues: PendenciaCiclo[];
  readyToPublish: boolean;
  readyToOpen: boolean;
};

/**
 * Corpo de `POST /api/avaliacoes/[id]/ciclo`.
 *
 * A ação vai no corpo, não no caminho, porque todas operam o mesmo recurso: o
 * ciclo. `manage_survey_cycle` é uma máquina de estados — entre `PUBLISH`,
 * `OPEN` e `CANCEL` muda a transição pedida, não o objeto afetado.
 */
export type AcaoCicloEntrada = {
  action: string;
  opensAt?: string | null;
  closesAt?: string | null;
};

/** Corpo de `PUT /api/avaliacoes/[id]/notificacoes`. */
export type NotificacaoEmailEntrada = {
  enabled: boolean;
};

/**
 * Regra condicional de exibição, no formato de `fc_listar_regras_condicionais`.
 *
 * Os tipos de operador, condição e alvo vêm de `@/lib/survey-conditional-logic`
 * de propósito: é o mesmo vocabulário que o runtime avalia. Duas definições do
 * mesmo conjunto de operadores divergiriam em silêncio.
 */
export type RegraCondicional = {
  ruleId: string;
  targetType: "QUESTION" | "SECTION";
  targetId: string;
  action: "SHOW" | "HIDE";
  connector: "ALL" | "ANY";
  description: string | null;
  conditions: Array<{
    conditionId?: string;
    // `SurveyRuleOperator` e não `string`: `ck_tb_condicao_regra_operador`
    // restringe a coluna aos nove valores do tipo, então declarar mais largo
    // aqui obrigaria toda tela a estreitar por conta própria.
    operator: SurveyRuleOperator;
    questionId: string;
    optionId: string | null;
    value: string | null;
  }>;
};

/**
 * Corpo de `PUT /api/avaliacoes/[id]/regras`.
 *
 * `PUT` e não `POST`: `fc_salvar_regra_condicional` substitui em bloco a regra
 * vigente do alvo — o alvo tem no máximo uma regra, garantida pelo índice
 * `in_regra_condicional_alvo`. O recurso é a regra **daquele alvo**, e gravar
 * duas vezes seguidas o mesmo corpo dá o mesmo resultado.
 */
export type RegraEntrada = {
  targetType: "QUESTION" | "SECTION";
  targetId: string;
  action: "SHOW" | "HIDE";
  connector: "ALL" | "ANY";
  description?: string | null;
  conditions: Array<{
    questionId: string;
    operator: string;
    optionId?: string | null;
    value?: string | null;
  }>;
};
