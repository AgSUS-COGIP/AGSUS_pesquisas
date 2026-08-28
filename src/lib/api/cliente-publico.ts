import { chamar } from "./requisicao";
import type {
  DimensoesDoPublico,
  PreviaDoPublico,
  RegraDePublico,
  PessoasEncontradas,
  ResultadoDaAplicacao,
} from "./contratos-publico";

/** Opções institucionais disponíveis em cada dimensão do público. */
export function obterDimensoesDoPublico(avaliacao: string) {
  return chamar<DimensoesDoPublico>(`/api/avaliacoes/${encodeURIComponent(avaliacao)}/publico`);
}

/**
 * Prévia do público. Leitura pura — não altera o vínculo de ninguém.
 *
 * Prévia e aplicação resolvem a regra pela mesma função no banco, então o
 * número mostrado aqui é o número que a aplicação vai gravar.
 */
export function previsualizarPublico(avaliacao: string, regra: RegraDePublico) {
  return chamar<PreviaDoPublico>(`/api/avaliacoes/${encodeURIComponent(avaliacao)}/publico/previa`, {
    method: "POST",
    body: JSON.stringify(regra),
  });
}

/** Materializa o público. Mutação explícita, auditada, numa transação só. */
export function aplicarPublico(avaliacao: string, regra: RegraDePublico) {
  return chamar<ResultadoDaAplicacao>(`/api/avaliacoes/${encodeURIComponent(avaliacao)}/publico`, {
    method: "POST",
    body: JSON.stringify(regra),
  });
}

/**
 * Pessoas elegíveis para inclusão ou exclusão individual.
 *
 * Termo vazio devolve as primeiras em ordem alfabética — abrir o seletor e ver
 * uma lista em branco não ajuda ninguém a entender o que ele faz.
 */
export function buscarPessoasDoPublico(avaliacao: string, busca: string) {
  const consulta = busca.trim() ? `?busca=${encodeURIComponent(busca.trim())}` : "";
  return chamar<PessoasEncontradas>(
    `/api/avaliacoes/${encodeURIComponent(avaliacao)}/publico/pessoas${consulta}`,
  );
}
