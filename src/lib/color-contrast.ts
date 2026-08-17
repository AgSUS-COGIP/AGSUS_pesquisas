/**
 * Contraste derivado de uma cor de fundo.
 *
 * Existe porque a cor do painel da tela de acesso é configurável pela
 * administração, e cor livre sem tratamento produz tela ilegível: o texto e o
 * botão daquela tela são azul-escuro, então um fundo escuro faz os dois
 * desaparecerem. Quem configurou não vê o problema — quem não consegue entrar, vê.
 *
 * A saída é não deixar o contraste como segunda escolha do operador: ele é
 * **derivado** da cor escolhida. Escolhe-se a cor; a legibilidade vem junto.
 *
 * Funções puras, sem DOM — testáveis e usadas tanto na tela quanto na prévia da
 * configuração.
 */

/** Luminância relativa (WCAG 2.1, 1.4.3). Devolve 0 (preto) a 1 (branco). */
export function relativeLuminance(hex: string): number | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;

  const channels = [0, 2, 4].map((offset) => {
    const value = Number.parseInt(match[1].slice(offset, offset + 2), 16) / 255;
    // A curva de correção de gama do sRGB: o olho não percebe o canal
    // linearmente, então o valor bruto não serve para julgar claro ou escuro.
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** Texto claro e texto escuro que a plataforma usa sobre painel colorido. */
export const LIGHT_FOREGROUND = "#ffffff";
export const DARK_FOREGROUND = "#003b70";

/**
 * Indica se uma cor exige texto claro por cima.
 *
 * Decide por **limiar de luminância**, e não comparando o contraste real das
 * duas opções. É uma escolha de produto, tomada com o número na mesa, e vale a
 * pena deixar registrado o que ela custa — porque uma leitura desatenta faria
 * isso parecer um descuido a "corrigir".
 *
 * Em 17/08/2026 esta função chegou a comparar os dois contrastes e escolher o
 * maior. Sobre o lilás `#ba93ef` configurado na tela de acesso, isso trocava o
 * texto branco pelo azul institucional — tecnicamente melhor (4,88 contra 2,47,
 * e a WCAG AA exige 4,5), e visualmente pior no julgamento de quem responde
 * pela identidade da plataforma. O comportamento anterior foi restabelecido.
 *
 * **A consequência é real: no lilás claro atual, o texto branco fica em 2,47 e
 * não atinge o mínimo da WCAG AA.** Isso não se conserta aqui — o lugar certo é
 * a cor do painel. Um lilás mais fundo entrega a mesma aparência e passa:
 * `#9333ea` dá 5,38, `#7c3aed` dá 5,70, `#7e22ce` dá 6,98. Trocar a cor em
 * /admin/configuracoes resolve sem mexer em código.
 *
 * O corte em 0,45 (e não 0,5) é deliberado: entre dois fundos de luminância
 * parecida, errar para o lado do texto escuro costuma ser mais legível do que
 * errar para o texto claro, que "some" antes.
 *
 * Cor inválida devolve `false` — o padrão é o painel branco com texto escuro,
 * que é o estado seguro.
 */
export function needsLightForeground(hex: string | null | undefined): boolean {
  if (!hex) return false;
  const luminance = relativeLuminance(hex);
  if (luminance === null) return false;
  return luminance < 0.45;
}

/**
 * Razão de contraste entre duas cores (WCAG 2.1). De 1 (idênticas) a 21.
 *
 * Serve para a tela de configuração avisar quando a combinação escolhida fica
 * abaixo do mínimo legível, em vez de aceitar em silêncio.
 */
export function contrastRatio(foreground: string, background: string): number | null {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  if (first === null || second === null) return null;
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Mínimo da WCAG AA para texto normal. */
export const WCAG_AA_NORMAL_TEXT = 4.5;
