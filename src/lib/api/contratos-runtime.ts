/** Contratos da jornada de resposta — o que o participante consome. */

/** Resposta gravada, no formato aceito por `save_my_survey_answer`. */
export type RespostaEntrada = {
  questionId: string;
  optionIds?: string[] | null;
  text?: string | null;
  number?: number | null;
  boolean?: boolean | null;
  date?: string | null;
  datetime?: string | null;
  json?: unknown;
};

/** Tipo de submissão do CDDI: autoavaliação ou avaliação de chefia. */
export type TipoSubmissaoCddi = "AUTO" | "CHEFIA";
