/** Regra pura do gate global, isolada das dependências Edge do proxy. */
export function deveBloquearManutencaoGlobal(globalAtiva: boolean, temBypass: boolean) {
  return globalAtiva && !temBypass;
}
