import { isPlatformNavItemActive, platformNavigationGroups } from "./platform-navigation";
import { PLATFORM_MODULES, isPlatformModule, type PlatformModule } from "./platform-modules";
import { PLATFORM_ROLE, type PlatformRoleCode } from "./platform-roles";
import { ehQuedaDeBackend, type Prontidao } from "./readiness";

/**
 * Manutenção operacional — o núcleo, sem nenhuma entrada e saída.
 *
 * Tudo aqui é função pura sobre dados já lidos. Onde o estado mora é problema
 * de quem chama; a decisão de bloquear ou liberar é sempre a mesma, e fica num
 * lugar só para que a resposta não dependa de qual tela perguntou.
 *
 * ## Manutenção não é permissão
 *
 * Um módulo em manutenção continua constando nas permissões da pessoa. Nada é
 * escrito em `role_module_permissions` nem em `person_module_permissions`, e
 * nenhum perfil é recalculado. É um estado operacional temporário sobreposto à
 * autorização, e não uma alteração dela — por isso retirar a manutenção devolve
 * o acesso na mesma hora, sem nada para desfazer no banco.
 */

/** O que o control plane guarda. Formato estável, validado na entrada. */
export type EstadoDeManutencao = {
  global: boolean;
  modules: readonly PlatformModule[];
  /** Motivo interno da última alteração. Não é exibido a quem usa. */
  reason: string;
  updatedAt: string | null;
  updatedBy: string | null;
};

export const MANUTENCAO_INATIVA: EstadoDeManutencao = Object.freeze({
  global: false,
  modules: Object.freeze([]) as readonly PlatformModule[],
  reason: "",
  updatedAt: null,
  updatedBy: null,
});

/**
 * Aceita apenas módulos do catálogo institucional, sem duplicar e preservando a
 * ordem canônica.
 *
 * Descartar o desconhecido em vez de recusar o conjunto inteiro é deliberado na
 * **leitura**: um módulo removido do código não pode deixar a plataforma
 * inteira sem resposta por causa de uma chave velha no control plane. Na
 * **escrita** a API recusa explicitamente — ali o valor acabou de ser digitado
 * e engolir o erro esconderia um engano de quem opera.
 */
export function normalizarModulosDeManutencao(valores: unknown): PlatformModule[] {
  if (!Array.isArray(valores)) return [];
  const encontrados = new Set<PlatformModule>();
  for (const valor of valores) {
    if (isPlatformModule(valor)) encontrados.add(valor);
  }
  return PLATFORM_MODULES.filter((modulo) => encontrados.has(modulo));
}

/** Separa módulos válidos dos recusados, para a API dizer o que não aceitou. */
export function validarModulosDeManutencao(valores: unknown) {
  if (!Array.isArray(valores)) return { validos: [] as PlatformModule[], invalidos: ["(não é uma lista)"] };
  const invalidos = valores.filter((valor) => !isPlatformModule(valor)).map((valor) => String(valor).slice(0, 40));
  return { validos: normalizarModulosDeManutencao(valores), invalidos };
}

/** Lê o estado bruto do control plane sem confiar em nada que venha dele. */
export function normalizarEstadoDeManutencao(bruto: unknown): EstadoDeManutencao {
  if (!bruto || typeof bruto !== "object") return MANUTENCAO_INATIVA;
  const valor = bruto as Record<string, unknown>;
  return {
    global: valor.global === true,
    modules: normalizarModulosDeManutencao(valor.modules),
    reason: typeof valor.reason === "string" ? valor.reason : "",
    updatedAt: typeof valor.updatedAt === "string" ? valor.updatedAt : null,
    updatedBy: typeof valor.updatedBy === "string" ? valor.updatedBy : null,
  };
}

/**
 * Rotas que a manutenção global nunca derruba.
 *
 * Sem esta lista a manutenção fecha a própria porta por onde se sai dela: a
 * tela institucional deixa de renderizar, o health check passa a mentir que o
 * ambiente está fora, e quem administra perde o caminho para desligar o que
 * ligou. O redirecionamento também entraria em laço, porque o destino do
 * redirect seria ele mesmo redirecionado.
 */
const ROTAS_SEMPRE_LIBERADAS = Object.freeze([
  "/acesso",
  // O destino do rewrite. Sem ele a própria tela de manutenção seria reescrita
  // para si mesma a cada requisição.
  "/manutencao",
  "/api/health",
  "/api/health/readiness",
  // O próprio control plane administrativo: sem ele, desligar a manutenção
  // global dependeria exclusivamente do painel da Vercel.
  "/api/plataforma/manutencao",
  "/admin/configuracoes",
  // Callback de autenticação: o Superadmin precisa conseguir entrar para
  // alcançar a tela acima.
  "/auth/confirm",
]);

/** Prefixos de recurso estático que nunca passam pela decisão de manutenção. */
const PREFIXOS_DE_ASSET = Object.freeze(["/_next/", "/favicon", "/icons/", "/images/"]);

export function ehRotaSempreLiberada(pathname: string) {
  if (PREFIXOS_DE_ASSET.some((prefixo) => pathname.startsWith(prefixo))) return true;
  if (/\.(png|svg|jpg|jpeg|webp|gif|ico|txt|xml|json|webmanifest)$/.test(pathname)) return true;
  return ROTAS_SEMPRE_LIBERADAS.some(
    (rota) => pathname === rota || pathname.startsWith(`${rota}/`),
  );
}

/**
 * Qual módulo institucional atende esta rota.
 *
 * Derivado de `platformNavigationGroups`, que já é a fonte única do menu e da
 * paleta de comandos — e não de uma segunda lista de prefixos, que envelheceria
 * em silêncio assim que alguém movesse uma rota.
 *
 * O casamento mais específico vence: `/admin/participantes` precisa resolver
 * para `ADMIN_PARTICIPANTS` mesmo com `/admin/pesquisas` na mesma lista.
 *
 * Rota sem módulo devolve `null`, e `null` significa **não bloqueável por
 * módulo** — `/perfil`, `/responder/...` e as rotas anônimas continuam de pé
 * enquanto só um módulo estiver em manutenção.
 */
export function moduleForPathname(pathname: string): PlatformModule | null {
  const itens = platformNavigationGroups
    .flatMap((grupo) => grupo.items)
    .filter((item) => Boolean(item.module))
    .sort((a, b) => b.href.length - a.href.length);

  for (const item of itens) {
    if (isPlatformNavItemActive(pathname, item)) return item.module ?? null;
  }
  return null;
}

/** Rótulo institucional do módulo, vindo do mesmo menu — nunca redigitado. */
export function rotuloDoModulo(modulo: PlatformModule): string {
  const item = platformNavigationGroups
    .flatMap((grupo) => grupo.items)
    .find((candidato) => candidato.module === modulo);
  return item?.label ?? modulo;
}

/**
 * O que a plataforma deve fazer com esta requisição, agora.
 *
 * `liberado` é o único desfecho que segue adiante; `administrativo` também
 * segue, mas pedindo que a tela avise em que condição a pessoa está entrando.
 */
export type EstadoOperacional =
  | { situacao: "liberado" }
  | { situacao: "indisponivel" }
  | { situacao: "manutencao-global" }
  | { situacao: "manutencao-de-modulo"; modulo: PlatformModule }
  | { situacao: "administrativo"; modulo: PlatformModule | null };

export type EntradaOperacional = {
  prontidao: Prontidao;
  /**
   * `null` significa **não foi possível ler o control plane** — e não "não há
   * manutenção".
   *
   * A distinção existe para que a leitura falhar não vire pane. Se o control
   * plane está fora e a plataforma está saudável, o conservador é deixar
   * passar: bloquear todo mundo por não conseguir ler uma bandeira transforma
   * uma indisponibilidade de configuração numa queda total, sem que ninguém
   * tenha pedido manutenção. Quem opera vê o aviso no log.
   *
   * O contrário — queda de backend — continua fechando, porque ali a plataforma
   * realmente não atende.
   */
  manutencao: EstadoDeManutencao | null;
  pathname: string;
  papel: PlatformRoleCode | null;
};

/**
 * A precedência, e por que ela é esta.
 *
 * 1. **Rota sempre liberada** vem antes de tudo, inclusive da queda de backend:
 *    é o que permite ver a tela institucional e desligar a manutenção.
 * 2. **Queda de backend** vence manutenção planejada. As duas fecham a
 *    plataforma, mas dizem coisas diferentes a quem opera: uma é decisão, a
 *    outra é incidente. Anunciar "em manutenção" durante uma queda esconderia o
 *    incidente de quem precisa agir.
 * 3. **Manutenção global** vem antes da de módulo — parar tudo já inclui a
 *    parte.
 * 4. **Manutenção de módulo**, com desvio para o Superadmin.
 *
 * O desvio existe para que quem colocou o módulo em manutenção consiga conferir
 * a correção antes de liberar, e para que marcar `ADMIN_ACCESS` não tranque a
 * própria tela onde a manutenção é desligada. Ele vale só para
 * `ADMINISTRATOR`; todo o resto continua bloqueado.
 */
export function resolverEstadoOperacional({
  prontidao,
  manutencao,
  pathname,
  papel,
}: EntradaOperacional): EstadoOperacional {
  if (ehRotaSempreLiberada(pathname)) return { situacao: "liberado" };

  if (ehQuedaDeBackend(prontidao)) return { situacao: "indisponivel" };

  // Control plane ilegível com plataforma saudável não bloqueia ninguém.
  if (!manutencao) return { situacao: "liberado" };

  const ehSuperadmin = papel === PLATFORM_ROLE.SUPER_ADMIN;

  if (manutencao.global) {
    return ehSuperadmin ? { situacao: "administrativo", modulo: null } : { situacao: "manutencao-global" };
  }

  const modulo = moduleForPathname(pathname);
  if (modulo && manutencao.modules.includes(modulo)) {
    return ehSuperadmin
      ? { situacao: "administrativo", modulo }
      : { situacao: "manutencao-de-modulo", modulo };
  }

  return { situacao: "liberado" };
}

/** Aviso mostrado ao Superadmin que entrou por desvio. */
export const AVISO_MODO_ADMINISTRATIVO =
  "Este módulo está em manutenção. Você está acessando em modo administrativo.";
