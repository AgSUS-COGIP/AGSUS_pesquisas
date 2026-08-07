export type StoredSurveyAnswer = {
  answerText?: string | null;
  answerNumber?: number | null;
  answerBoolean?: boolean | null;
  answerDate?: string | null;
  answerDatetime?: string | null;
  optionIds?: string[];
};

export type SurveyAnswerValue = {
  text?: string;
  number?: number;
  boolean?: boolean;
  date?: string;
  datetime?: string;
  optionIds?: string[];
};

function datetimeLocalValue(value: string | null | undefined) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function restoreSurveyAnswer(value: StoredSurveyAnswer): SurveyAnswerValue {
  return {
    text: value.answerText ?? undefined,
    number: value.answerNumber ?? undefined,
    boolean: value.answerBoolean ?? undefined,
    date: value.answerDate ?? undefined,
    datetime: datetimeLocalValue(value.answerDatetime),
    optionIds: value.optionIds ?? [],
  };
}

export function isSurveyAnswerComplete(questionType: string, value?: SurveyAnswerValue) {
  if (!value) return false;
  if (["SCALE", "SINGLE_CHOICE", "MULTIPLE_CHOICE"].includes(questionType)) return Boolean(value.optionIds?.length);
  if (["INTEGER", "DECIMAL"].includes(questionType)) return typeof value.number === "number" && Number.isFinite(value.number);
  if (questionType === "BOOLEAN") return typeof value.boolean === "boolean";
  if (questionType === "DATE") return Boolean(value.date);
  if (questionType === "DATETIME") return Boolean(value.datetime && !Number.isNaN(new Date(value.datetime).getTime()));
  return Boolean(value.text?.trim());
}

export function buildSurveyAnswerPayload(questionType: string, value: SurveyAnswerValue) {
  const isNumeric = questionType === "INTEGER" || questionType === "DECIMAL";
  const datetime = questionType === "DATETIME" && value.datetime ? new Date(value.datetime) : null;
  return {
    target_option_ids: value.optionIds ?? [],
    target_text: ["SHORT_TEXT", "LONG_TEXT"].includes(questionType) ? value.text ?? null : null,
    target_number: isNumeric && typeof value.number === "number" && Number.isFinite(value.number) ? value.number : null,
    target_boolean: questionType === "BOOLEAN" ? value.boolean ?? null : null,
    target_date: questionType === "DATE" ? value.date || null : null,
    target_datetime: datetime && !Number.isNaN(datetime.getTime()) ? datetime.toISOString() : null,
    target_json: null,
  };
}
