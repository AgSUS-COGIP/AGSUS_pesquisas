import { chamar } from "./requisicao";
import type {
  DimensoesDoPublico,
  PreviaDoPublico,
  RegraDePublico,
  PessoasEncontradas,
  ResultadoDaAplicacao,
} from "./contratos-publico";

/**
 * Opções de cada dimensão, restringidas pelo que já foi escolhido.
 *
 * Recebe a regra porque a cascata depende dela: escolher a Diretoria enxuga a
 * lista de Unidades. Sem Diretoria escolhida, Unidade volta a mostrar tudo — não
 * é hierarquia obrigatória.
 */
export function obterDimensoesDoPublico(avaliacao: string, regra: RegraDePublico) {
  return chamar<DimensoesDoPublico>(`/api/avaliacoes/${encodeURIComponent(avaliacao)}/publico/dimensoes`, {
    method: "POST",
    body: JSON.stringify(regra),
  });
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
export function buscarPessoasDoPublico(avaliacao: string, busca: string, regra: RegraDePublico) {
  return chamar<PessoasEncontradas>(
    `/api/avaliacoes/${encodeURIComponent(avaliacao)}/publico/pessoas`,
    { method: "POST", body: JSON.stringify({ busca, regra }) },
  );
}
