/**
 * "Esta navegação veio de um login."
 *
 * O callback do OAuth marca a primeira tela com `?entrando=1`. Dois lugares
 * precisam dessa informação — o esqueleto, para dizer "Entrando no sistema" em
 * vez de "Carregando …", e a recepção, para aparecer — mas o parâmetro precisa
 * sair do endereço **assim que for lido**: recarregar a página depois não é mais
 * entrar no sistema, e a mensagem passaria a mentir.
 *
 * Quem ler primeiro captura e limpa; os demais leem o valor já guardado. O
 * estado é de módulo, como o cache do contexto da plataforma: sobrevive à
 * navegação no cliente e morre no recarregamento — que é exatamente o
 * comportamento desejado, já que recarregar não é entrar de novo.
 */
let capturado = false;
let entrando = false;
let consumido = false;

/** Lê (uma vez) se esta navegação veio do login, sem gastar o sinal. */
export function captureEnteringFlag(): boolean {
  if (capturado) return entrando;
  capturado = true;

  if (typeof window === "undefined") return false;

  const url = new URL(window.location.href);
  if (url.searchParams.get("entrando") !== "1") return false;

  entrando = true;
  url.searchParams.delete("entrando");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  return true;
}

/**
 * Gasta o sinal: devolve `true` uma única vez por login.
 *
 * É o que a recepção usa. Sem isso ela reapareceria a cada volta para a tela
 * inicial dentro da mesma sessão — e a ideia é receber quem chega, não repetir
 * o cumprimento a cada navegação.
 */
export function consumeEnteringFlag(): boolean {
  if (!captureEnteringFlag() || consumido) return false;
  consumido = true;
  return true;
}

/** Só para teste: devolve o módulo ao estado inicial. */
export function resetEnteringFlagForTests() {
  capturado = false;
  entrando = false;
  consumido = false;
}
