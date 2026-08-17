import { chamar } from "./requisicao";
import type {
  AcaoCicloEntrada,
  ConstrutorAvaliacao,
  DirecaoItemConstrutor,
  IdentidadeVisual,
  IdentidadeVisualAplicacao,
  OperacaoCiclo,
  PerguntaAtualizacaoEntrada,
  PerguntaEntrada,
  SecaoEntrada,
  TipoItemConstrutor,
} from "./contratos-construtor";

/** Chamadas do construtor de formulários e da operação de ciclos. */

/** Estrutura completa do formulário: pesquisa, versão, ciclo e seções. */
export function obterConstrutor(avaliacaoId: string) {
  return chamar<ConstrutorAvaliacao>(`/api/avaliacoes/${avaliacaoId}/construtor`);
}

/** Cria uma seção ao final do rascunho. */
export function criarSecao(avaliacaoId: string, entrada: SecaoEntrada) {
  return chamar<{ status: string; sectionId: string }>(`/api/avaliacoes/${avaliacaoId}/secoes`, {
    method: "POST",
    body: JSON.stringify(entrada),
  });
}

/** Altera título e descrição de uma seção; perguntas e posição permanecem. */
export function atualizarSecao(avaliacaoId: string, secaoId: string, entrada: SecaoEntrada) {
  return chamar<unknown>(`/api/avaliacoes/${avaliacaoId}/secoes/${secaoId}`, {
    method: "PATCH",
    body: JSON.stringify(entrada),
  });
}

/** Cria uma pergunta ao final da seção informada. */
export function criarPergunta(avaliacaoId: string, entrada: PerguntaEntrada) {
  return chamar<{ status: string; questionId: string }>(`/api/avaliacoes/${avaliacaoId}/perguntas`, {
    method: "POST",
    body: JSON.stringify(entrada),
  });
}

/**
 * Edita uma pergunta.
 *
 * As alternativas vão inteiras: é assim que o banco preserva `id` e `value` por
 * posição, sem invalidar respostas já gravadas quando só o rótulo muda.
 */
export function atualizarPergunta(
  avaliacaoId: string,
  perguntaId: string,
  entrada: PerguntaAtualizacaoEntrada,
) {
  return chamar<unknown>(`/api/avaliacoes/${avaliacaoId}/perguntas/${perguntaId}`, {
    method: "PATCH",
    body: JSON.stringify(entrada),
  });
}

/** Exclui uma pergunta do rascunho. Versões publicadas não são afetadas. */
export function excluirPergunta(avaliacaoId: string, perguntaId: string) {
  return chamar<unknown>(`/api/avaliacoes/${avaliacaoId}/perguntas/${perguntaId}`, {
    method: "DELETE",
  });
}

/** Move a pergunta para o final de outra seção, com as alternativas. */
export function moverPergunta(avaliacaoId: string, perguntaId: string, secaoId: string) {
  return chamar<unknown>(`/api/avaliacoes/${avaliacaoId}/perguntas/${perguntaId}/secao`, {
    method: "PUT",
    body: JSON.stringify({ sectionId: secaoId }),
  });
}

/** Duplica uma seção (ao final do formulário) ou uma pergunta (ao final da seção). */
export function duplicarItemDoConstrutor(
  avaliacaoId: string,
  itemType: TipoItemConstrutor,
  itemId: string,
) {
  return chamar<unknown>(`/api/avaliacoes/${avaliacaoId}/itens/copia`, {
    method: "POST",
    body: JSON.stringify({ itemType, itemId }),
  });
}

/** Sobe ou desce uma seção ou pergunta em uma posição. */
export function reordenarItemDoConstrutor(
  avaliacaoId: string,
  itemType: TipoItemConstrutor,
  itemId: string,
  direction: DirecaoItemConstrutor,
) {
  return chamar<unknown>(`/api/avaliacoes/${avaliacaoId}/itens/ordem`, {
    method: "POST",
    body: JSON.stringify({ itemType, itemId, direction }),
  });
}

/** Capa e textos de abertura do ciclo, com o código e o nome da aplicação. */
export function obterIdentidadeVisual(avaliacaoId: string) {
  return chamar<IdentidadeVisualAplicacao>(`/api/avaliacoes/${avaliacaoId}/identidade-visual`);
}

/** Grava a capa inteira; em `INSTITUTIONAL` o banco zera os campos de banner. */
export function salvarIdentidadeVisual(avaliacaoId: string, entrada: IdentidadeVisual) {
  return chamar<unknown>(`/api/avaliacoes/${avaliacaoId}/identidade-visual`, {
    method: "PUT",
    body: JSON.stringify(entrada),
  });
}

/** Estado do ciclo, métricas e checklist de prontidão para publicar e abrir. */
export function obterOperacaoDoCiclo(avaliacaoId: string) {
  return chamar<OperacaoCiclo>(`/api/avaliacoes/${avaliacaoId}/ciclo`);
}

/** Executa uma transição do ciclo — publicar, agendar, abrir, encerrar, cancelar. */
export function executarAcaoDoCiclo(avaliacaoId: string, entrada: AcaoCicloEntrada) {
  return chamar<unknown>(`/api/avaliacoes/${avaliacaoId}/ciclo`, {
    method: "POST",
    body: JSON.stringify(entrada),
  });
}
