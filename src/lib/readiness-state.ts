/** Estados compartilhados sem dependências de Node, seguros para Client e Edge. */

/**
 * Prontidão do ambiente, discriminada — e não um booleano.
 *
 * "Degradado" reúne situações que pedem respostas opostas na porta de entrada.
 * Faltar `SMTP_APP_PASSWORD` degrada o ambiente — e-mail não sai —, mas não
 * impede ninguém de entrar; fechar o login por isso trocaria uma falha de envio
 * por uma queda total. Já banco inacessível ou esquema atrás das migrations
 * impedem qualquer jornada autenticada, e aí a tela precisa dizer.
 *
 * Por isso o motivo sobrevive ao retorno: a rota de health reduz tudo a
 * `ready`/`degraded`, enquanto a tela de acesso decide pelo estado.
 */
export type Prontidao =
  | { estado: "pronta" }
  | { estado: "configuracao-ausente"; detalhe: string }
  | { estado: "backend-inacessivel"; detalhe: string }
  | { estado: "esquema-incompativel"; detalhe: string };

/**
 * A plataforma consegue atender uma jornada autenticada?
 *
 * Configuração ausente fica **de fora** de propósito: é build ou
 * pré-visualização sem backend, e mostrar indisponibilidade ali seria mentir
 * sobre produção.
 */
export function ehQuedaDeBackend(prontidao: Prontidao) {
  return prontidao.estado === "backend-inacessivel" || prontidao.estado === "esquema-incompativel";
}
