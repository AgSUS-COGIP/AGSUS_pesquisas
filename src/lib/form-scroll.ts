/**
 * Leva o topo do formulário à vista **sem mexer no documento**.
 *
 * O problema que isto resolve
 * --------------------------
 * `element.scrollIntoView()` rola *todos* os ancestrais roláveis até o elemento
 * aparecer — inclusive o documento. No desktop a casca põe `overflow: hidden` no
 * `html` e usa `.platform-shell-content` como contêiner de rolagem: a barra do
 * documento some, mas ele **continua rolável por código**.
 *
 * O resultado é uma armadilha. Ao trocar de etapa, o `scrollIntoView` empurrava
 * o documento junto; a aplicação inteira subia — 248px numa janela de 1000 — e
 * sobrava uma faixa branca embaixo, com o formulário cortado no meio. Sem barra
 * de rolagem, não havia como voltar: nem arrastando, nem por código, porque o
 * elemento em foco era trazido de volta a cada tentativa. Só recarregando.
 *
 * A correção é rolar explicitamente o contêiner da casca e mais nada.
 *
 * Fora do desktop `.platform-shell-content` não é contêiner de rolagem — a
 * regra que lhe dá altura fixa vive numa media query. Nesse caso quem rola é a
 * janela, e aí `scrollIntoView` é seguro: não há `overflow: hidden` para
 * esconder a barra.
 */
export function scrollFormTopIntoView(element: HTMLElement | null | undefined) {
  if (!element) return;

  const container = element.closest<HTMLElement>(".platform-shell-content");
  const containerRolavel = Boolean(container && container.scrollHeight > container.clientHeight + 1);

  if (!container || !containerRolavel) {
    element.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  // `scroll-margin-top` do elemento é respeitado à mão: `scrollTo` não o aplica
  // sozinho, e é ele que impede o título de ficar sob o cabeçalho fixo.
  const margem = Number.parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
  const destino = element.getBoundingClientRect().top
    - container.getBoundingClientRect().top
    + container.scrollTop
    - margem;

  container.scrollTo({ top: Math.max(0, destino), behavior: "smooth" });
}
