import type { DeadlineStatus } from "./deadline";
import { URGENT_DEADLINE_DAYS, type SurveyItemState } from "./survey-catalog";

/**
 * A gramática de cor da plataforma, num lugar só.
 *
 * ## O problema que isto resolve
 *
 * Cada tela vinha escolhendo a própria cor para o mesmo estado, e elas
 * discordavam. No catálogo, "Em andamento" era âmbar e "Concluída" era azul —
 * as duas famílias trocadas em relação ao que a cor significa em qualquer outro
 * lugar do produto. "Fechada" era vermelha, embora fechar no prazo seja o
 * desfecho normal de um ciclo, e não um problema.
 *
 * Cor que muda de significado entre telas é pior que interface sem cor: a
 * pessoa aprende uma associação numa tela e é contrariada na seguinte, então
 * passa a ler o texto de qualquer jeito — e a cor vira ruído que ainda ocupa
 * atenção.
 *
 * ## O vocabulário
 *
 * ```text
 * total      contagem-base, o denominador — não é estado
 * info       informação de estado, em progresso, agendado
 * success    aberto, concluído, está bem
 * warning    pendência, prazo apertado, precisa de atenção
 * danger     atraso, bloqueio, problema
 * neutral    sem estado, encerrado normalmente
 * ```
 *
 * `total` existe porque "Disponíveis 3", "Integrantes 9" e "Avaliações 6" não
 * são estados: são o universo dentro do qual os estados são contados. Pintá-los
 * com a família de um estado faria o total parecer uma situação — e deixaria
 * dois indicadores vizinhos com a mesma cor significando coisas diferentes.
 * Eles seguem no azul institucional, que já era a cor deles.
 *
 * ## Por que não há família para "agendado"
 *
 * Houve uma, em violeta, pela ideia de que futuro merece cor própria. Ela saiu
 * depois de medida contra a interface real: a `primaryColor` configurada da
 * plataforma é roxa hoje, e os botões de ação — "Nova avaliação", "Continuar",
 * "Avaliar equipe lado a lado" — são roxos por causa dela. O violeta do selo
 * ficava a **1,27** de contraste do roxo dos botões, ou seja, praticamente a
 * mesma cor: um selo "Agendada" passaria a parecer um botão.
 *
 * A cor principal é configurável e muda sem deploy, então nenhum matiz é seguro
 * por definição — reservar um para status é apostar contra uma configuração que
 * a administração pode trocar amanhã. Agendado usa `info`, que é o que o
 * próprio guia manda fazer quando não há razão forte para uma família nova.
 *
 * ## O que este módulo não faz
 *
 * Não decide **estado** nem calcula **prazo**. `surveyItemState` e
 * `deadlineStatus` continuam sendo as fontes; aqui só se traduz o que elas já
 * responderam. Recalcular qualquer uma das duas criaria uma segunda verdade que
 * divergiria da primeira na próxima regra de negócio.
 */
export type TomSemantico = "total" | "info" | "success" | "warning" | "danger" | "neutral";

/** Variante de `Badge` correspondente ao tom. */
export const VARIANTE_DE_BADGE: Record<TomSemantico, "info" | "success" | "warning" | "danger" | "neutral"> = {
  total: "info",
  info: "info",
  success: "success",
  warning: "warning",
  danger: "danger",
  neutral: "neutral",
};

/** Classes de texto por tom, para número e rótulo tonalizados. */
export const TEXTO_DO_TOM: Record<TomSemantico, string> = {
  total: "text-[var(--brand-primary)]",
  info: "text-[var(--status-info-text)]",
  success: "text-[var(--status-success-text)]",
  warning: "text-[var(--status-warning-text)]",
  danger: "text-[var(--status-danger-text)]",
  neutral: "text-[var(--text-secondary)]",
};

/** Classes de borda por tom, para o traço fino de um cartão ou indicador. */
export const BORDA_DO_TOM: Record<TomSemantico, string> = {
  total: "border-[var(--brand-primary)]",
  info: "border-[var(--status-info-border)]",
  success: "border-[var(--status-success-border)]",
  warning: "border-[var(--status-warning-border)]",
  danger: "border-[var(--status-danger-border)]",
  neutral: "border-[var(--border-strong)]",
};

/** Classes de fundo e texto por tom, para o ícone-marcador de uma linha. */
export const MARCADOR_DO_TOM: Record<TomSemantico, string> = {
  total: "bg-[var(--surface-muted)] text-[var(--brand-primary)]",
  info: "bg-[var(--status-info-bg)] text-[var(--status-info-text)]",
  success: "bg-[var(--status-success-bg)] text-[var(--status-success-text)]",
  warning: "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]",
  danger: "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]",
  neutral: "bg-[var(--surface-muted)] text-[var(--text-secondary)]",
};

/**
 * Tom do estado de uma avaliação no catálogo.
 *
 * `CLOSED` é **neutro**, e não vermelho. Um ciclo que encerrou no prazo cumpriu
 * o que devia; pintá-lo de vermelho ensina que vermelho quer dizer "acabou", e
 * aí ele deixa de servir para o que de fato é problema — um prazo perdido com
 * resposta pendente, que continua em `danger` pelo tom do prazo.
 *
 * `PENDING` é âmbar porque é o único estado que pede ação de quem está olhando.
 */
export function tomDoEstadoDaAvaliacao(estado: SurveyItemState): TomSemantico {
  switch (estado) {
    case "COMPLETED":
      return "success";
    case "IN_PROGRESS":
    case "SCHEDULED":
      return "info";
    case "CLOSED":
      return "neutral";
    case "PENDING":
      return "warning";
  }
}

/**
 * Tom da situação de aplicação — o selo "Aberta / Agendada / Fechado".
 *
 * Separado do anterior porque responde outra pergunta. O estado do item conta
 * o que **a pessoa** tem a fazer; este conta o que **o ciclo** está fazendo, e
 * um ciclo aberto é uma boa notícia mesmo para quem ainda não começou.
 */
export function tomDaSituacaoDoCiclo(status: string): TomSemantico {
  if (status === "OPEN") return "success";
  if (status === "SCHEDULED") return "info";
  return "neutral";
}

/**
 * Tom do prazo, a partir do que `deadlineStatus` já apurou.
 *
 * O corte vem de `URGENT_DEADLINE_DAYS`, o mesmo que `summarizeSurveyCatalog`
 * usa para contar as urgentes e que as duas telas já exibem como "vencem em até
 * 7 dias". Repetir o número aqui faria a cor discordar da legenda ao lado assim
 * que alguém mudasse um dos dois.
 */
export function tomDoPrazo(prazo: DeadlineStatus): TomSemantico {
  switch (prazo.state) {
    case "none":
      return "neutral";
    case "expired":
      return "danger";
    case "today":
      return "warning";
    case "counting":
      return prazo.days <= URGENT_DEADLINE_DAYS ? "warning" : "neutral";
  }
}

/**
 * Tom do envio — "Envio concluído / Rascunho salvo / Não iniciada".
 *
 * "Não iniciada" é **neutra**, nunca âmbar nem vermelha. Não começar não é
 * erro: é o estado inicial de toda avaliação, e quem abre o catálogo no
 * primeiro dia veria a tela inteira alarmada sem nada ter acontecido. A
 * urgência, quando existe, vem do prazo — que tem cor própria.
 */
export function tomDoEnvio(submissionStatus: string | null | undefined, concluido: boolean): TomSemantico {
  if (concluido) return "success";
  if (submissionStatus === "DRAFT") return "info";
  return "neutral";
}
