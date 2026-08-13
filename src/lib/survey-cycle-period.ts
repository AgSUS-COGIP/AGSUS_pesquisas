/**
 * Regras de período de um ciclo, no formato dos campos `datetime-local`.
 *
 * O banco é a autoridade (`create_survey_draft` e `manage_survey_cycle` revalidam
 * tudo isto). Estas funções existem para que a tela avise **antes** de gravar, e
 * para que a publicação de um rascunho antigo aponte exatamente qual data
 * precisa ser corrigida.
 *
 * `datetime-local` produz e consome hora local sem fuso ("2026-08-11T14:30").
 * Comparar essa string com `new Date()` funciona porque `new Date("…T14:30")`
 * sem sufixo Z também é interpretado como hora local — os dois lados usam o
 * mesmo referencial, então a comparação é consistente com o que o operador vê.
 */

/** Tolerância que absorve o intervalo entre preencher "agora" e gravar. Espelha o `interval '1 minute'` do banco. */
const TOLERANCIA_MS = 60_000;

export type PeriodIssue = {
  field: "opensAt" | "closesAt";
  message: string;
};

function parseLocal(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Momento atual no formato aceito por `<input type="datetime-local">`, para uso em `min`. */
export function nowLocalInputValue(reference: Date = new Date()) {
  const local = new Date(reference.getTime() - reference.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

/**
 * Valida o par abertura/encerramento.
 *
 * Campo vazio não é erro aqui: o período é opcional na criação, e a
 * obrigatoriedade de cada tela é decidida por quem chama.
 */
export function periodIssues(
  opensAt: string,
  closesAt: string,
  reference: Date = new Date(),
): PeriodIssue[] {
  const issues: PeriodIssue[] = [];
  const opens = parseLocal(opensAt);
  const closes = parseLocal(closesAt);
  const limite = reference.getTime() - TOLERANCIA_MS;

  if (opens && opens.getTime() < limite) {
    issues.push({
      field: "opensAt",
      message: "A abertura não pode ser anterior à data e hora atuais.",
    });
  }

  if (closes && !opens && closes.getTime() < limite) {
    issues.push({
      field: "closesAt",
      message: "O encerramento não pode ser anterior à data e hora atuais.",
    });
  }

  if (opens && closes && closes.getTime() <= opens.getTime()) {
    issues.push({
      field: "closesAt",
      message: "O encerramento deve ocorrer após a abertura.",
    });
  }

  return issues;
}

/**
 * Mensagem única para o toast que barra a publicação de um rascunho cujo período
 * envelheceu entre salvar e publicar. Devolve `null` quando o período está apto.
 */
export function publishBlockedMessage(
  opensAt: string,
  closesAt: string,
  reference: Date = new Date(),
): string | null {
  const issues = periodIssues(opensAt, closesAt, reference);
  if (!issues.length) return null;

  const passou = issues.some((issue) => issue.message.includes("anterior à data e hora atuais"));
  return passou
    ? "O período informado já passou. Atualize a abertura e o encerramento antes de publicar."
    : issues[0].message;
}

/**
 * Valida a data de reabertura de um ciclo `CLOSED`. A abertura deixou de ser
 * digitada — o banco a resolve como `now()` quando a tela envia `null` (ver
 * `manage_survey_cycle`/`REOPEN` em `supabase/CLAUDE.md`) — então só o
 * encerramento precisa ser validado aqui. A regra do banco é
 * `target_closes_at > greatest(target_opens_at, now())`, **sem tolerância**:
 * neste fluxo ela se reduz a `closesAt > agora do banco`. Por isso a margem de
 * um minuto entra no sentido **mais estrito** que o banco — exigir
 * `closesAt > agora + 1min` absorve o trânsito entre o clique de confirmação e
 * a chegada da requisição; aceitar valores já passados faria a pré-validação
 * liberar exatamente o que o banco recusa.
 *
 * Diferente de `periodIssues()`, aqui campo vazio É erro: o encerramento é o
 * único dado obrigatório deste fluxo, não um período opcional.
 */
export function reopenIssue(
  closesAt: string,
  reference: Date = new Date(),
): string | null {
  const closes = parseLocal(closesAt);
  if (!closes) return "Informe o novo encerramento para reabrir o ciclo.";
  const limite = reference.getTime() + TOLERANCIA_MS;
  return closes.getTime() <= limite
    ? "O novo encerramento deve estar no futuro."
    : null;
}
