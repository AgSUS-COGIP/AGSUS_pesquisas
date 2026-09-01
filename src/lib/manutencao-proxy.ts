/** Regras puras do gate global, isoladas das dependências de runtime do proxy. */
export function deveBloquearManutencaoGlobal(globalAtiva: boolean, temBypass: boolean) {
  return globalAtiva && !temBypass;
}

/**
 * Traduz a resposta de `/api/plataforma/manutencao/desvio` em passar ou não.
 *
 * Fecha por padrão: só `200` com exatamente `{"desvio": true}` concede. Status
 * diferente, corpo ilegível, campo ausente ou valor apenas truthy — `"true"`,
 * `1`, `{}` — não concedem. A comparação é estrita de propósito: a única forma
 * de atravessar a manutenção global precisa ser uma afirmação inequívoca de
 * quem consultou o banco, e não uma coincidência de coerção de tipo.
 */
export function interpretarDesvioAdministrativo(status: number, corpo: unknown) {
  if (status !== 200) return false;
  if (typeof corpo !== "object" || corpo === null) return false;
  return (corpo as { desvio?: unknown }).desvio === true;
}
