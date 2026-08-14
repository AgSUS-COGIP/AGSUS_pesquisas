/**
 * Saudação pelo horário de Brasília.
 *
 * Vive aqui porque dois lugares precisam da mesma regra — a recepção da
 * primeira visita e o bloco de identificação da Visão geral — e porque uma
 * saudação errada é o tipo de detalhe que ninguém reporta: quem entra às 19h e
 * lê "bom dia" só sente que o sistema não está prestando atenção.
 *
 * O fuso é sempre `America/Sao_Paulo`, como todas as datas do projeto. Sem
 * isso, quem acessasse de outro fuso — ou de uma máquina com relógio
 * desconfigurado — seria cumprimentado pelo horário errado.
 */
export type Greeting = "Bom dia" | "Boa tarde" | "Boa noite";

/** Hora de Brasília, de 0 a 23. */
export function brasiliaHour(reference: Date = new Date()): number {
  const formatado = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    hour12: false,
    timeZone: "America/Sao_Paulo",
  }).format(reference);

  const hora = Number(formatado.replace(/\D/g, ""));
  // `hour12: false` devolve "24" para a meia-noite em algumas implementações.
  // Sem esta linha, 00h05 cairia em "Boa noite" por acidente e não por regra.
  return hora === 24 ? 0 : hora;
}

/**
 * Faixas: madrugada e manhã até 11h59, tarde até 17h59, noite a partir das 18h.
 * A madrugada recebe "Bom dia" de propósito — é o que se diz em português a
 * quem está começando, e "boa madrugada" soaria estranho num sistema de
 * trabalho.
 */
export function timeGreeting(reference: Date = new Date()): Greeting {
  const hora = brasiliaHour(reference);
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}
