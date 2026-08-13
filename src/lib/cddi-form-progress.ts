/**
 * Progresso de preenchimento das jornadas do CDDI (autoavaliação e avaliação
 * pela chefia). É cálculo de interface: quem decide se uma resposta vale é o
 * banco, nas RPCs de gravação e envio.
 *
 * As duas jornadas são deliberadamente separadas (ver regra do módulo em
 * `CLAUDE.md`) e cada tela tipa o subconjunto do contrato RPC que consome —
 * por isso estas funções trabalham sobre a forma estrutural mínima, sem
 * acoplar os tipos das telas.
 */

type QuestionLike = { id: string; required: boolean };
type AnswersLike = Record<string, { value?: string } | undefined>;

/** Uma pergunta conta como respondida quando há texto/valor não vazio gravado. */
export function isCddiQuestionAnswered(question: QuestionLike, answers: AnswersLike): boolean {
  return Boolean(answers[question.id]?.value?.trim());
}

/** Percentual das obrigatórias da seção já respondidas. Seção sem obrigatórias conta como completa. */
export function cddiSectionCompletion(section: { questions: QuestionLike[] }, answers: AnswersLike): number {
  const required = section.questions.filter((question) => question.required);
  if (!required.length) return 100;
  return Math.round((required.filter((question) => isCddiQuestionAnswered(question, answers)).length / required.length) * 100);
}
