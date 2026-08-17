/**
 * O que a plataforma promete — e o que ela não promete — num ciclo anônimo.
 *
 * O texto mora aqui, e não nas telas, porque a mesma promessa aparece em dois
 * lugares com públicos opostos: quem **configura** o ciclo precisa saber o que
 * está ligando, e quem **responde** precisa saber o que foi prometido a ele. Se
 * os dois textos divergirem, um dos dois está mentindo.
 *
 * As garantias descrevem o que o banco faz, não uma intenção de política:
 * `20260813220000_anonimato_estrutural.sql` destrói no envio o vínculo entre
 * pessoa e submissão, e `20260814120000_limiar_anonimato_no_painel.sql` suprime
 * recorte abaixo do limiar, zera o horário de envio e ordena texto por `md5`.
 *
 * **As ressalvas são tão obrigatórias quanto as garantias.** Prometer que
 * "ninguém nunca saberá" seria falso em dois pontos concretos, e os dois estão
 * escritos abaixo. Ao mexer neste arquivo, mexa junto na migration que sustenta
 * a frase — ou a frase vira promessa sem lastro.
 */

/** O que deixa de existir, ou de ser exibido, num ciclo anônimo. */
export const ANONYMITY_GUARANTEES = [
  "Depois que você enviar, não existe no banco nenhum registro ligando você às suas respostas.",
  "O painel não mostra a data nem a hora do envio.",
  "Respostas em texto aparecem em ordem embaralhada, e não na ordem em que foram enviadas.",
  "Recortes com poucas pessoas ficam ocultos no painel, para que um grupo pequeno não identifique alguém por eliminação.",
] as const;

/** O que continua existindo, de propósito, e precisa estar dito. */
export const ANONYMITY_LIMITS = [
  "Enquanto o rascunho existe, a plataforma sabe que ele é seu — é isso que permite você parar e continuar depois. Esse vínculo é destruído no envio.",
  "Continua registrado que você participou, com a data. É o que permite cobrar quem ainda não respondeu e impedir resposta em dobro. Saber que você participou é diferente de saber o que você respondeu.",
] as const;

/**
 * Resumo de uma linha, para onde não cabe a lista inteira.
 *
 * A ressalva vem na mesma frase de propósito: uma chamada que só promete e
 * remete a ressalva para outro lugar é lida como promessa integral.
 */
export const ANONYMITY_SUMMARY =
  "Ciclo anônimo: depois do envio, nada no banco liga você às suas respostas. Fica registrado apenas que você participou.";

/**
 * O que muda para quem administra ao marcar a opção.
 *
 * A irreversibilidade é a informação mais importante da tela de criação: o
 * gatilho `tba_ciclo_anonimo` recusa ligar ou desligar o anonimato depois que o
 * ciclo tem resposta. Quem descobre isso depois não tem correção possível
 * dentro do ciclo.
 */
export const ANONYMITY_ADMIN_EFFECTS = [
  "O painel deste ciclo mostra apenas números agregados, sem nome e sem horário de envio.",
  "Recortes com poucas pessoas ficam ocultos, mesmo para a administração.",
  "Depois da primeira resposta, o anonimato não pode mais ser ligado nem desligado.",
] as const;

/** Rótulo do modo de identificação, para telas de revisão e listagem. */
export function identificationLabel(anonymous: boolean) {
  return anonymous ? "Anônima" : "Nominal";
}
