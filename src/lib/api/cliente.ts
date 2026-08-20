import type {
  AvaliacaoGerenciada,
  CriarAvaliacaoEntrada,
  DuplicarAvaliacaoEntrada,
} from "./contratos";
import { chamar } from "./requisicao";

/** Chamadas do catálogo administrativo de avaliações. */

export { ErroDeApi } from "./requisicao";

/** Catálogo de avaliações administrativas — vigentes ou arquivadas. */
export function listarAvaliacoes(opcoes?: { arquivadas?: boolean }) {
  const consulta = opcoes?.arquivadas ? "?arquivadas=true" : "";
  return chamar<AvaliacaoGerenciada[]>(`/api/avaliacoes${consulta}`);
}

/** Cria uma avaliação em rascunho e devolve o que o banco gravou. */
export function criarAvaliacao(entrada: CriarAvaliacaoEntrada) {
  // O código vem em `code`, não em `applicationCode`: é o nome que
  // `create_survey_draft` devolve.
  return chamar<{
    status: string;
    surveyId: string;
    versionId: string;
    applicationId: string;
    code: string;
  }>("/api/avaliacoes", {
    method: "POST",
    body: JSON.stringify(entrada),
  });
}

/** Duplica uma avaliação; a cópia nasce em rascunho, sem ciclo nem respostas. */
export function duplicarAvaliacao(id: string, entrada: DuplicarAvaliacaoEntrada = {}) {
  return chamar<{ surveyId: string }>(`/api/avaliacoes/${id}/copia`, {
    method: "POST",
    body: JSON.stringify(entrada),
  });
}

/** Exclui uma avaliação em rascunho. O banco recusa se houver resposta. */
export function excluirAvaliacao(id: string) {
  return chamar<unknown>(`/api/avaliacoes/${id}`, { method: "DELETE" });
}

/**
 * Exclui definitivamente uma avaliação já arquivada.
 *
 * A operação remove também o ciclo, as respostas e os dados associados.
 */
export function excluirAvaliacaoArquivada(id: string) {
  return chamar<unknown>(`/api/avaliacoes/${id}?arquivada=true`, { method: "DELETE" });
}
