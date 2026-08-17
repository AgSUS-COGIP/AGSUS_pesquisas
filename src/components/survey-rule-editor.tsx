"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ErrorSummary } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/form-controls";
import type { SurveyRuleCondition, SurveyRuleOperator } from "@/lib/survey-conditional-logic";
import {
  RULE_OPERATORS,
  eligibleOriginQuestions,
  emptyCondition,
  normalizeCondition,
  operatorRequirement,
  ruleDraftErrors,
  type RuleDraft,
  type RuleQuestionRef,
} from "@/lib/survey-rule-builder";

type SurveyRuleEditorProps = {
  /** Rascunho em edição; `null` mantém o diálogo fechado. */
  draft: RuleDraft | null;
  onDraftChange: (draft: RuleDraft) => void;
  /** Nome do alvo, para o operador saber sobre o que está legislando. */
  targetLabel: string;
  questions: ReadonlyArray<RuleQuestionRef>;
  /** Existe regra gravada para este alvo? Decide se "Remover regra" aparece. */
  hasSavedRule: boolean;
  working: boolean;
  onClose: () => void;
  onSave: (draft: RuleDraft) => void;
  onDelete: () => void;
};

/**
 * Editor da regra condicional de uma pergunta ou seção.
 *
 * Vive fora da tela do construtor de propósito: aquele arquivo já passa de mil
 * linhas com cinco diálogos, e a regra é um assunto fechado em si.
 *
 * A validação chama `ruleDraftErrors()` a cada render em vez de guardar erros em
 * estado. O operador vê o que falta enquanto monta, e não só depois de tentar
 * salvar — e não existe estado de erro para dessincronizar do formulário.
 *
 * Dependência circular **não** é verificada aqui: quem percorre o grafo é
 * `fc_regra_gera_ciclo()`, no banco. Reimplementar a travessia criaria um
 * segundo algoritmo para a mesma decisão; a recusa do banco chega como erro na
 * tela do construtor.
 */
export function SurveyRuleEditor({
  draft,
  onDraftChange,
  targetLabel,
  questions,
  hasSavedRule,
  working,
  onClose,
  onSave,
  onDelete,
}: SurveyRuleEditorProps) {
  const [tentouSalvar, setTentouSalvar] = useState(false);

  const elegiveis = useMemo(
    () => (draft ? eligibleOriginQuestions(questions, draft) : []),
    [draft, questions],
  );
  const errors = useMemo(
    () => (draft ? ruleDraftErrors(draft, questions) : []),
    [draft, questions],
  );

  function alterarCondicao(indice: number, mudanca: Partial<SurveyRuleCondition>) {
    if (!draft) return;
    const conditions = draft.conditions.map((condition, posicao) =>
      posicao === indice ? normalizeCondition({ ...condition, ...mudanca }) : condition,
    );
    onDraftChange({ ...draft, conditions });
  }

  function fechar() {
    setTentouSalvar(false);
    onClose();
  }

  return (
    <Dialog
      open={Boolean(draft)}
      onOpenChange={(aberto) => { if (!aberto) fechar(); }}
      eyebrow="Lógica condicional"
      title={`Quando mostrar “${targetLabel}”`}
      description="Sem regra, o item aparece sempre. Com regra, ele aparece apenas quando as condições forem satisfeitas."
      className="max-w-2xl"
    >
      {draft && (
        <div className="space-y-5">
          {elegiveis.length === 0 ? (
            <p className="rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-4 text-sm leading-6 text-[var(--status-warning-text)]">
              Não há outra pergunta que possa condicionar este item. Crie ao menos uma pergunta antes
              {draft.targetType === "SECTION" ? " fora desta seção" : ""}.
            </p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  label="O que fazer"
                  value={draft.action}
                  onChange={(event) => onDraftChange({ ...draft, action: event.target.value as RuleDraft["action"] })}
                >
                  <option value="SHOW">Mostrar quando</option>
                  <option value="HIDE">Ocultar quando</option>
                </Select>
                <Select
                  label="Exigir"
                  hint={draft.connector === "ALL" ? "Todas as condições precisam ser verdadeiras." : "Basta uma condição ser verdadeira."}
                  value={draft.connector}
                  onChange={(event) => onDraftChange({ ...draft, connector: event.target.value as RuleDraft["connector"] })}
                >
                  <option value="ALL">Todas as condições</option>
                  <option value="ANY">Qualquer condição</option>
                </Select>
              </div>

              <div className="space-y-3">
                {draft.conditions.map((condition, indice) => {
                  const origem = questions.find((question) => question.id === condition.questionId);
                  const exige = operatorRequirement(condition.operator);

                  return (
                    <fieldset key={indice} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4">
                      <legend className="px-1 text-xs font-bold uppercase tracking-[.1em] text-[var(--text-secondary)]">
                        Condição {indice + 1}
                      </legend>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <Select
                          label="Pergunta"
                          value={condition.questionId}
                          onChange={(event) => alterarCondicao(indice, { questionId: event.target.value, optionId: null })}
                        >
                          <option value="">Escolha a pergunta</option>
                          {elegiveis.map((question) => (
                            <option key={question.id} value={question.id}>{question.title}</option>
                          ))}
                        </Select>

                        <Select
                          label="Condição"
                          value={condition.operator}
                          onChange={(event) => alterarCondicao(indice, { operator: event.target.value as SurveyRuleOperator })}
                        >
                          {RULE_OPERATORS.map((operator) => (
                            <option key={operator.value} value={operator.value}>{operator.label}</option>
                          ))}
                        </Select>
                      </div>

                      {exige === "option" && (
                        <Select
                          label="Alternativa"
                          containerClassName="mt-3"
                          value={condition.optionId ?? ""}
                          hint={origem && origem.options.length === 0 ? "Esta pergunta não tem alternativas — escolha outra condição." : undefined}
                          onChange={(event) => alterarCondicao(indice, { optionId: event.target.value || null })}
                        >
                          <option value="">Escolha a alternativa</option>
                          {(origem?.options ?? []).map((option) => (
                            <option key={option.id ?? option.label} value={option.id ?? ""}>{option.label}</option>
                          ))}
                        </Select>
                      )}

                      {(exige === "text" || exige === "number") && (
                        <Input
                          label={exige === "number" ? "Número comparado" : "Texto comparado"}
                          containerClassName="mt-3"
                          inputMode={exige === "number" ? "decimal" : undefined}
                          value={condition.value ?? ""}
                          onChange={(event) => alterarCondicao(indice, { value: event.target.value })}
                        />
                      )}

                      {draft.conditions.length > 1 && (
                        <div className="mt-3 flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => onDraftChange({ ...draft, conditions: draft.conditions.filter((_, posicao) => posicao !== indice) })}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                            Remover condição {indice + 1}
                          </Button>
                        </div>
                      )}
                    </fieldset>
                  );
                })}

                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onDraftChange({ ...draft, conditions: [...draft.conditions, emptyCondition()] })}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Acrescentar condição
                </Button>
              </div>

              {tentouSalvar && errors.length > 0 && (
                <ErrorSummary title="Revise a regra antes de salvar" errors={errors} />
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
                {hasSavedRule ? (
                  <Button type="button" variant="danger" disabled={working} onClick={onDelete}>
                    Remover regra
                  </Button>
                ) : <span />}

                <div className="flex gap-3">
                  <Button type="button" variant="ghost" disabled={working} onClick={fechar}>
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    disabled={working}
                    onClick={() => {
                      setTentouSalvar(true);
                      if (errors.length === 0) onSave(draft);
                    }}
                  >
                    Salvar regra
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </Dialog>
  );
}
