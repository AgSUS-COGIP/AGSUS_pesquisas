/**
 * Acesso em janela separada.
 *
 * O redirecionamento de página inteira deixa a tela em branco enquanto o
 * callback troca o código por sessão — quase um segundo em que quem entrou não
 * vê nada e não sabe se deu certo. Com a janela do Google por cima, a tela de
 * acesso continua visível atrás e o buraco desaparece: não porque ficou mais
 * rápido, mas porque a página principal nunca sai do ar.
 *
 * **O caminho antigo continua existindo.** Tudo aqui é a tentativa; qualquer
 * falha cai no redirecionamento de sempre. É o único caminho de entrada do
 * sistema, e um erro nele não degrada nada — tranca todo mundo do lado de fora.
 */

/** Aviso que a janela pequena manda para quem a abriu. */
export const LOGIN_POPUP_MESSAGE = "agsus:login-concluido";

/** Rota onde a janela pequena termina, avisa e se fecha. */
export const LOGIN_POPUP_LANDING = "/auth/concluido";

/**
 * Abaixo desta largura a janela separada atrapalha mais que ajuda: no celular
 * ela vira uma aba solta, sem a tela de trás visível, que é justamente o ganho.
 */
const LARGURA_MINIMA_PARA_JANELA = 768;

export function suportaJanelaDeLogin(): boolean {
  if (typeof window === "undefined") return false;
  // `window.open` existe em qualquer navegador; o que decide é o tamanho.
  return window.innerWidth >= LARGURA_MINIMA_PARA_JANELA;
}

/**
 * Abre a janela **vazia**, e isso precisa acontecer no mesmo instante do
 * clique.
 *
 * Chamar `window.open` depois de um `await` faz o navegador perder o vínculo
 * com o gesto da pessoa e bloquear a janela como pop-up indesejado. Por isso a
 * abertura vem primeiro e o endereço só é apontado depois, quando a URL do
 * Google chega.
 */
export function abrirJanelaDeLogin(): Window | null {
  if (typeof window === "undefined") return null;

  const largura = 520;
  const altura = 680;
  // Centraliza na tela onde a janela do navegador está, não na principal —
  // quem usa dois monitores esperaria a janela perto do que está olhando.
  const esquerda = Math.max(0, window.screenX + (window.outerWidth - largura) / 2);
  const topo = Math.max(0, window.screenY + (window.outerHeight - altura) / 3);

  return window.open(
    "about:blank",
    "agsus-login",
    `popup=yes,width=${largura},height=${altura},left=${Math.round(esquerda)},top=${Math.round(topo)}`,
  );
}
