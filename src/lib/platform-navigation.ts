import type { PlatformIconName } from "@/components/platform-icons";
import { PLATFORM_MODULE, normalizePlatformModules, type PlatformModule } from "./platform-modules";

export type PlatformNavItem = {
  href: string;
  label: string;
  description: string;
  icon: PlatformIconName;
  module?: PlatformModule;
  exact?: boolean;
};

export type PlatformNavGroup = {
  title: "Principal" | "Atuação" | "Administração";
  items: readonly PlatformNavItem[];
};

/**
 * Fonte única do menu lateral e da paleta de comandos.
 *
 * Item sem `module` aparece para todo usuário autenticado — por isso toda entrada
 * administrativa precisa declarar o módulo correspondente.
 */
export const platformNavigationGroups: readonly PlatformNavGroup[] = [
  {
    title: "Principal",
    items: [
      { href: "/area", label: "Visão geral", description: "Abrir o painel institucional", icon: "home", module: PLATFORM_MODULE.HOME, exact: true },
      { href: "/pesquisas", label: "Avaliações", description: "Consultar avaliações disponíveis", icon: "surveys", module: PLATFORM_MODULE.SURVEYS },
      { href: "/paineis", label: "Painéis", description: "Abrir indicadores e análises", icon: "dashboard", module: PLATFORM_MODULE.DASHBOARDS },
    ],
  },
  {
    title: "Atuação",
    items: [
      { href: "/equipe", label: "Minha equipe", description: "Acompanhar pessoas e avaliações", icon: "team", module: PLATFORM_MODULE.TEAM },
      { href: "/resultados", label: "Resultados", description: "Consultar devolutivas e indicadores", icon: "results", module: PLATFORM_MODULE.RESULTS },
    ],
  },
  {
    title: "Administração",
    items: [
      { href: "/admin", label: "Administração", description: "Abrir a gestão da plataforma", icon: "admin", module: PLATFORM_MODULE.ADMIN_SURVEYS, exact: true },
      { href: "/admin/pesquisas", label: "Pesquisas e ciclos", description: "Criar pesquisas e operar ciclos", icon: "edit", module: PLATFORM_MODULE.ADMIN_SURVEYS },
      { href: "/admin/participantes", label: "Participantes", description: "Gerenciar público e elegibilidade", icon: "users", module: PLATFORM_MODULE.ADMIN_PARTICIPANTS },
      { href: "/admin/equipes", label: "Equipes", description: "Organizar lideranças e integrantes", icon: "hierarchy", module: PLATFORM_MODULE.ADMIN_TEAMS },
      { href: "/admin/acessos", label: "Acessos", description: "Administrar papéis e módulos", icon: "settings", module: PLATFORM_MODULE.ADMIN_ACCESS },
      { href: "/admin/configuracoes", label: "Configurações", description: "Personalizar marca e aparência", icon: "settings", module: PLATFORM_MODULE.ADMIN_ACCESS },
      { href: "/admin/importacao", label: "Importações", description: "Validar e processar planilhas", icon: "import", module: PLATFORM_MODULE.ADMIN_IMPORT },
    ],
  },
];

/** Filtra o menu pelos módulos permitidos e descarta grupos que ficaram vazios. */
export function navigationGroupsForModules(modules: readonly string[]) {
  const allowedModules = new Set(normalizePlatformModules(modules));
  return platformNavigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.module || allowedModules.has(item.module)),
    }))
    .filter((group) => group.items.length > 0);
}

/**
 * Indica se um item do menu corresponde à rota atual.
 *
 * `exact` existe para rotas que são prefixo de outras: sem ele, `/admin` ficaria
 * ativo em `/admin/pesquisas` e dois itens apareceriam selecionados ao mesmo tempo.
 */
export function isPlatformNavItemActive(pathname: string, item: PlatformNavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
