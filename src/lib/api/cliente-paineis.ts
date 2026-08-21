import { chamar } from "./requisicao";

/**
 * Chamadas dos painéis e da galeria de modelos.
 *
 * Ciclos anônimos chegam agregados e sem identidade de quem respondeu.
 */

/** Painel de resultados de um ciclo, pelo código da aplicação. */
export function obterPainelDoCiclo(codigoAplicacao: string) {
  return chamar<unknown>(`/api/paineis/${encodeURIComponent(codigoAplicacao)}`);
}

/** Painel de monitoramento do CDDI, com autoavaliação e chefia lado a lado. */
export function obterPainelCddi(codigoCiclo: string) {
  return chamar<unknown>(`/api/paineis/cddi?ciclo=${encodeURIComponent(codigoCiclo)}`);
}

/** Galeria de modelos de avaliação. */
export function listarModelosDeAvaliacao() {
  return chamar<unknown[]>("/api/modelos-avaliacao");
}
