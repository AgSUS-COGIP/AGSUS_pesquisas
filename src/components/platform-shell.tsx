"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useLayoutEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirmation-provider";
import { PersonAvatar } from "@/components/person-avatar";
import { usePlatformBranding } from "@/components/platform-branding-provider";
import { PlatformFooter } from "@/components/platform-footer";
import { PlatformLogo } from "@/components/platform-logo";
import { OnlinePresenceIndicator } from "@/components/online-presence-indicator";
import { PlatformIcon } from "@/components/platform-icons";
import { PlatformThemeToggle } from "@/components/platform-theme-toggle";
import { Drawer } from "@/components/ui/overlay-panel";
import {
  isPlatformNavItemActive,
  navigationGroupsForModules,
  type PlatformNavGroup,
} from "@/lib/platform-navigation";
import { PARTICIPANT_ROLE_MODULES, resolvePlatformRole } from "@/lib/platform-modules";
import { isSuperAdminOnlyRoute } from "@/lib/platform-support";
import { finishLocalSignOut } from "@/lib/local-sign-out";
import {
  isPlatformSidebarCompact,
  PLATFORM_SIDEBAR_ATTRIBUTE,
  PLATFORM_SIDEBAR_STORAGE_KEY,
} from "@/lib/platform-sidebar";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { platformBrandingTitle, type PlatformBranding } from "@/lib/platform-branding";
import { needsLightForeground } from "@/lib/color-contrast";
const MOBILE_NAVIGATION_ID = "platform-mobile-navigation";

type PlatformUser = {
  id?: string;
  fullName: string;
  institutionalEmail?: string | null;
  employeeNumber?: string | null;
  profileLabel: string;
  avatarUrl?: string | null;
  roles?: string[];
  modules?: string[];
};

function Avatar({ user, compact = false }: { user: PlatformUser; compact?: boolean }) {
  return (
    <PersonAvatar
      fullName={user.fullName}
      avatarUrl={user.avatarUrl}
      className={compact ? "h-9 w-9 rounded-xl" : "h-10 w-10 rounded-xl"}
      fallbackClassName="text-sm"
    />
  );
}

function BrandLockup({ compact, branding, brandingLoading, mobile = false }: { compact: boolean; branding: PlatformBranding; brandingLoading: boolean; mobile?: boolean }) {
  const showName = !compact || mobile;
  /*
    Sobre barra escura o logotipo precisa de contraste, e há duas saídas: achatar
    a arte em silhueta branca (`brightness(0) invert(1)`) ou apoiá-la num quadrado
    branco. A primeira **altera as cores da marca** — está registrado assim no
    comentário de `tela-acesso.tsx`, onde é decisão de produto por ser uma
    assinatura em tela pública. Aqui não: a barra lateral apresenta a marca
    institucional, e o mesmo comentário aponta o quadrado branco como a
    alternativa que preserva as cores originais. É a que fica.
  */
  const needsLightPlate = !mobile && needsLightForeground(branding.sidebarColor ?? "#052f55");
  return (
    <Link
      href="/area"
      // O rótulo acompanha a marca configurada: fixá-lo faria o leitor de tela
      // anunciar um nome que a tela ao lado já não usa.
      aria-label={`${platformBrandingTitle(branding)} — ir para a visão geral`}
      className={`flex min-w-0 items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${compact && !mobile ? "justify-center" : ""}`}
    >
      <span className={needsLightPlate ? "grid h-9 w-9 shrink-0 place-items-center rounded-md bg-white p-1" : "contents"}>
        <PlatformLogo
          src={branding.logoUrl}
          alt=""
          organizationName={branding.organizationName}
          width={36}
          height={36}
          sizes="36px"
          loading={brandingLoading}
          className={needsLightPlate ? "h-full w-full object-contain text-[9px]" : "h-9 w-9 shrink-0 object-contain text-[9px]"}
        />
      </span>
      {showName ? (
        <span className="platform-sidebar-expanded-only min-w-0 leading-tight">
          <strong className={`block truncate text-[15px] font-semibold tracking-[-.015em] ${mobile ? "text-[var(--text-primary)]" : "text-[var(--sidebar-foreground)]"}`}>{branding.productName}</strong>
          <span className={`mt-0.5 block truncate text-[11px] font-medium ${mobile ? "text-[var(--text-secondary)]" : "text-[var(--sidebar-muted)]"}`}>{branding.organizationName}</span>
        </span>
      ) : null}
    </Link>
  );
}

/**
 * Rótulo que aparece ao lado do ícone quando o menu está compacto.
 *
 * Com 68px de largura não cabe texto sob o ícone — "Gerenciar avaliações" não
 * cabe de jeito nenhum —, então o compacto escondia o nome e deixava o `title`
 * nativo como única pista: meio segundo de espera, sem estilo, e **invisível
 * para quem navega por teclado**.
 *
 * O rótulo não pode morar dentro da barra: o `aside` declara
 * `contain: layout paint` e a área de navegação precisa de `overflow-x: hidden`
 * (sem isso surge rolagem horizontal dentro da barra em telas baixas). Qualquer
 * um dos dois recorta o que passar da borda, inclusive elemento `fixed`. Por
 * isso quem o renderiza é a casca, fora do `aside`, a partir da posição que o
 * item informa ao entrar em foco ou sob o cursor.
 */
type NavTip = { label: string; description: string; top: number } | null;

function NavGroup({ group, pathname, compact, mobile = false, onNavigate, onTip }: { group: PlatformNavGroup; pathname: string; compact: boolean; mobile?: boolean; onNavigate?: () => void; onTip?: (tip: NavTip) => void }) {
  /*
    A casca renderiza a navegação duas vezes — a barra do desktop e a gaveta do
    celular. O id derivado do título do grupo era o mesmo nas duas, então cada
    `nav-group-*` existia em dobro e o `aria-labelledby` resolvia para a
    primeira ocorrência, que costuma ser a cópia escondida. `useId()` dá um
    identificador por instância, como já se faz nos controles de formulário.

    O título também deixa de compor o id: "Atuação" gerava `nav-group-atuação`,
    com acento, que exige escape em qualquer `querySelector`.
  */
  const tituloId = useId();

  return (
    <section className="mt-4" aria-labelledby={compact ? undefined : tituloId} aria-label={compact ? group.title : undefined}>
      {!compact ? <p id={tituloId} className="platform-sidebar-expanded-only px-3 text-[11px] font-semibold tracking-[0.04em] text-slate-400">{group.title}</p> : null}
      <nav className="mt-2 space-y-1" aria-label={compact ? `Navegação — ${group.title}` : undefined}>
        {group.items.map((item) => {
          const active = isPlatformNavItemActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              // Sem `title` no compacto: o rótulo flutuante o substitui, e os
              // dois juntos mostrariam a mesma frase duas vezes.
              aria-label={compact ? `${item.label}: ${item.description}` : undefined}
              aria-current={active ? "page" : undefined}
              onMouseEnter={compact && onTip ? (event) => {
                const r = event.currentTarget.getBoundingClientRect();
                onTip({ label: item.label, description: item.description, top: r.top + r.height / 2 });
              } : undefined}
              onMouseLeave={compact && onTip ? () => onTip(null) : undefined}
              // Foco também mostra: quem chega por Tab não tem cursor para
              // revelar o nome, e era esse o caso que o `title` nunca cobriu.
              onFocus={compact && onTip ? (event) => {
                const r = event.currentTarget.getBoundingClientRect();
                onTip({ label: item.label, description: item.description, top: r.top + r.height / 2 });
              } : undefined}
              onBlur={compact && onTip ? () => onTip(null) : undefined}
              /*
                O estado ativo tem duas versões porque o fundo é diferente nos
                dois lugares onde este item aparece. Na barra do desktop, o CSS
                de `sidebar-monitora.css` pinta o fundo escuro — lá `bg-white/10`
                é um véu claro e `text-white` lê bem. A gaveta móvel fica abaixo
                de `lg`, onde aquele CSS não se aplica: o fundo é
                `--surface-card`, branco. Ali `bg-white/10` continua branco e
                `text-white` desaparece.
              */
              className={`group relative flex min-h-11 items-center gap-3 rounded-lg border-l-2 px-2.5 text-sm font-semibold transition-colors ${
                active
                  ? mobile
                    ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]"
                    : "border-[var(--brand-accent)] bg-white/10 text-white"
                  : "border-transparent text-slate-600 hover:bg-slate-100 hover:text-[var(--brand-primary)]"
              } ${compact ? "justify-center" : ""}`}
            >
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors ${active ? "bg-white/10" : "bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-[var(--brand-primary)]"}`} aria-hidden="true">
                <PlatformIcon name={item.icon} className="h-[18px] w-[18px]" />
              </span>
              {!compact ? <span className="platform-sidebar-expanded-only truncate">{item.label}</span> : null}
            </Link>
          );
        })}
      </nav>
    </section>
  );
}

function SidebarContent({ user, branding, brandingLoading, compact, modules, mobile = false, onNavigate, onSignOut, onTip }: { user: PlatformUser; branding: PlatformBranding; brandingLoading: boolean; compact: boolean; modules: string[]; mobile?: boolean; onNavigate?: () => void; onSignOut: () => void; onTip?: (tip: NavTip) => void }) {
  const pathname = usePathname();
  const groups = navigationGroupsForModules(modules);

  return (
    <div className={`relative flex h-full min-h-0 flex-col overflow-hidden ${mobile ? "bg-[var(--surface-card)] text-[var(--text-primary)]" : "bg-[var(--sidebar-background)] text-[var(--sidebar-foreground)]"}`}>
      <div className={`flex h-[4.5rem] shrink-0 items-center border-b px-4 ${mobile ? "border-[var(--border-subtle)]" : "border-white/10"} ${compact && !mobile ? "justify-center px-2" : ""}`}>
        <BrandLockup compact={compact} branding={branding} brandingLoading={brandingLoading} mobile={mobile} />
      </div>
      {/*
        `overflow-x-hidden` é obrigatório aqui, não decorativo: pela regra do
        CSS, quando um eixo deixa de ser `visible`, o outro também deixa — então
        `overflow-y-auto` sozinho fazia o eixo horizontal virar `auto` e uma
        barra de rolagem horizontal aparecia dentro da sidebar em telas baixas,
        roubando altura e cortando os ícones.
      */}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-2.5 pb-4">
        {groups.map((group) => <NavGroup key={group.title} group={group} pathname={pathname} compact={compact && !mobile} mobile={mobile} onNavigate={onNavigate} onTip={onTip} />)}
      </div>
      <div className={`shrink-0 border-t border-[var(--border-subtle)] p-2.5 ${mobile ? "bg-[var(--surface-card)]" : "bg-transparent"}`}>
        {/*
          Só na gaveta. No desktop isto repetia o que o cabeçalho já mostra —
          o avatar leva ao perfil a partir de `sm`, e a partir de `xl` ele exibe
          nome e perfil por extenso, então o rodapé da barra dizia "Meu perfil ·
          Superadmin" ao lado de um cabeçalho dizendo a mesma coisa.

          Abaixo de `sm` o cabeçalho esconde o link de perfil, e aí a gaveta é o
          único caminho até `/perfil`. Por isso não dá para remover dos dois
          lugares: some o acesso justamente em tela pequena.
        */}
        {mobile ? (
          <Link href="/perfil" onClick={onNavigate} className="flex min-h-11 items-center gap-2 rounded-xl p-2 transition hover:bg-[var(--surface-hover)]" aria-label={`Abrir perfil de ${user.fullName}`}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-[var(--brand-primary)]" aria-hidden="true">
              <PlatformIcon name="profile" className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0">
              <strong className="block truncate text-xs text-[var(--text-primary)]">Meu perfil</strong>
              <span className="block truncate text-[11px] text-[var(--text-secondary)]">{user.profileLabel}</span>
            </span>
          </Link>
        ) : null}
        <button type="button" onClick={onSignOut} aria-label="Sair da sessão atual" className={`mt-1 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 ${compact && !mobile ? "px-2" : ""}`}>
          <PlatformIcon name="logout" className="h-4 w-4" />
          {(!compact || mobile) ? <span className={mobile ? undefined : "platform-sidebar-expanded-only"}>Sair</span> : null}
        </button>
      </div>
    </div>
  );
}

function DesktopSidebar({ user, branding, brandingLoading, compact, modules, onToggle, onSignOut }: { user: PlatformUser; branding: PlatformBranding; brandingLoading: boolean; compact: boolean; modules: string[]; onToggle: () => void; onSignOut: () => void }) {
  const [tip, setTip] = useState<NavTip>(null);

  // Recolher ou expandir move todos os itens: a posição guardada deixa de valer.
  useEffect(() => setTip(null), [compact]);

  return (
    <>
      {/*
        A cor de fundo vem da marca configurada e sobrescreve a do CSS. Vai em
        `style`, e não em classe: o valor é arbitrário, escolhido por quem
        administra, e o Tailwind só gera as classes que consegue ver no código.

        Nula mantém o que a folha de estilo define — é o estado institucional
        padrão, e não um branco forçado.
      */}
      <aside
        data-print-hidden="true"
        aria-label="Navegação principal"
        className="platform-desktop-sidebar fixed left-0 top-0 z-50 hidden h-dvh max-h-dvh flex-col overflow-hidden border-r border-slate-200 bg-white shadow-[12px_0_35px_-28px_rgba(15,23,42,.35)] transition-[width] duration-300 lg:flex"
        style={branding.sidebarColor ? { backgroundColor: branding.sidebarColor } : undefined}
      >
        <SidebarContent user={user} branding={branding} brandingLoading={brandingLoading} compact={compact} modules={modules} onSignOut={onSignOut} onTip={setTip} />
      </aside>
      <button
        type="button"
        onClick={onToggle}
        data-print-hidden="true"
        className="platform-sidebar-edge-toggle fixed top-[5.25rem] z-[60] hidden h-7 w-7 -translate-x-1/2 place-items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--brand-primary)] shadow-sm transition-[left,background-color,color] duration-300 hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] lg:grid"
        style={{ left: "var(--platform-sidebar-width)" }}
        aria-label={compact ? "Expandir menu lateral" : "Recolher menu lateral"}
        aria-expanded={!compact}
      >
        <PlatformIcon name={compact ? "chevron-right" : "chevron-left"} className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {/*
        Fora do `aside` de propósito — ver o comentário de `NavTip`. `aria-hidden`
        porque o nome já vai no `aria-label` do próprio link: para quem usa leitor
        de tela isto seria a mesma frase repetida.
      */}
      {compact && tip ? (
        <div
          data-print-hidden="true"
          aria-hidden="true"
          className="pointer-events-none fixed z-[60] hidden max-w-xs -translate-y-1/2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-2 shadow-[0_18px_45px_-20px_rgba(15,23,42,.55)] lg:block"
          style={{ top: tip.top, left: "calc(var(--platform-sidebar-compact-width, 4.25rem) + 0.5rem)" }}
        >
          <strong className="block whitespace-nowrap text-xs font-bold text-[var(--text-primary)]">{tip.label}</strong>
          <span className="mt-0.5 block text-[11px] leading-4 text-[var(--text-secondary)]">{tip.description}</span>
        </div>
      ) : null}
    </>
  );
}

/**
 * Casca visual de todas as telas internas: barra lateral, cabeçalho, gaveta móvel
 * e encerramento de sessão.
 *
 * A navegação é filtrada por `user.modules`, de modo que ninguém vê link para área
 * que não pode abrir. O fallback é o conjunto do participante — nunca um módulo
 * administrativo.
 */
export function PlatformShell({ user, title, eyebrow, children, actions, focus = false, exitHref = "/pesquisas" }: { user: PlatformUser; title: string; eyebrow?: string; children: ReactNode; actions?: ReactNode; focus?: boolean; exitHref?: string }) {
  const { branding, loading: brandingLoading } = usePlatformBranding();
  const pathname = usePathname();
  const [compact, setCompact] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const confirm = useConfirm();
  // Sem módulos informados, a casca assume o piso do modelo (Participante) —
  // nunca um conjunto mais amplo do que o perfil da pessoa permite.
  const modules = user.modules ?? [...PARTICIPANT_ROLE_MODULES];
  const canViewPresence = branding.onlinePresenceViewerRoles.includes(resolvePlatformRole(user.roles ?? []));
  // O rodapé de suporte fica fora das rotas exclusivas do Superadmin (quem já é
  // o canal de suporte) e do modo foco, onde a barra de ações da avaliação ocupa
  // o rodapé da tela.
  const showFooter = !focus && !isSuperAdminOnlyRoute(pathname);

  // O script beforeInteractive aplica a preferência ao <html> antes da primeira
  // pintura e o CSS já apresenta a barra no formato correto. O estado inicial do
  // React continua `false` para que a primeira árvore do cliente seja idêntica à
  // árvore renderizada no servidor; o layout effect assume a preferência antes
  // da pintura seguinte e também repõe o atributo após remounts do Strict Mode.
  useLayoutEffect(() => {
    let next = isPlatformSidebarCompact(document.documentElement.getAttribute(PLATFORM_SIDEBAR_ATTRIBUTE));
    try {
      next = isPlatformSidebarCompact(window.localStorage.getItem(PLATFORM_SIDEBAR_STORAGE_KEY));
    } catch {
      // O atributo aplicado no bootstrap é o fallback quando o storage está indisponível.
    }
    document.documentElement.setAttribute(PLATFORM_SIDEBAR_ATTRIBUTE, String(next));
    setCompact(next);
  }, []);
  // Trocar de rota fecha a gaveta móvel, senão ela permanece sobre a nova tela.
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  function toggleCompact() {
    setCompact((current) => {
      const next = !current;
      window.localStorage.setItem(PLATFORM_SIDEBAR_STORAGE_KEY, String(next));
      document.documentElement.setAttribute(PLATFORM_SIDEBAR_ATTRIBUTE, String(next));
      return next;
    });
  }

  /**
   * Encerra a sessão, com confirmação e estado de saída.
   *
   * Sair era um clique só, sem volta — e a barra lateral é estreita, então o
   * botão fica a poucos pixels da navegação. Quem estava respondendo uma
   * avaliação perdia o contexto por engano e voltava para a tela de acesso sem
   * entender o que aconteceu.
   *
   * A confirmação avisa também que o encerramento é **deste navegador**: quem
   * usa a plataforma no celular continua conectado lá, e isso não é óbvio.
   */
  async function signOut() {
    const confirmed = await confirm({
      title: "Deseja realmente sair?",
      description: "Sua sessão será encerrada neste navegador. Respostas já salvas são preservadas — o preenchimento automático grava conforme você responde.",
      confirmLabel: "Sair",
      cancelLabel: "Continuar no sistema",
      tone: "danger",
    });
    if (!confirmed) return;

    setSigningOut(true);
    const supabase = createBrowserSupabaseClient();
    // `scope: "local"` encerra apenas esta sessão: quem usa a plataforma em outro
    // dispositivo não é desconectado ao sair aqui.
    const result = await finishLocalSignOut({
      signOut: (options) => supabase.auth.signOut(options),
      navigate: (destination) => window.location.replace(destination),
    });
    if (!result.ok) {
      setSigningOut(false);
      toast.error("Não foi possível encerrar esta sessão. Tente novamente.");
      return;
    }
  }

  return (
    <div className="min-h-screen overflow-x-clip bg-[var(--surface-page)] text-[var(--text-primary)]">
      {/*
        Entre confirmar a saída e o navegador trocar de página passa a chamada de
        `signOut` mais o redirecionamento. Sem cobrir esse intervalo, a tela fica
        parada respondendo a cliques que já não valem — e quem clicou não sabe se
        a ação pegou.
      */}
      {signingOut ? (
        <div
          role="status"
          aria-live="assertive"
          aria-busy="true"
          className="fixed inset-0 z-[200] grid cursor-wait place-items-center bg-slate-950/20 px-4 backdrop-blur-[2px]"
        >
          <div className="flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-overlay)]/95 px-6 py-5 text-center shadow-2xl">
            <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-[var(--border-subtle)] border-t-[var(--brand-primary)] motion-reduce:animate-none" aria-hidden="true" />
            <p className="text-sm font-bold text-[var(--text-primary)]">Saindo do sistema…</p>
            <p className="text-xs text-[var(--text-secondary)]">Encerrando sua sessão neste navegador.</p>
          </div>
        </div>
      ) : null}
      <a href="#conteudo-principal" className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-lg bg-[var(--surface-card)] px-4 py-2 font-bold text-[var(--brand-primary)] shadow-lg transition focus:translate-y-0">Ir para o conteúdo</a>
      {!focus ? <DesktopSidebar user={user} branding={branding} brandingLoading={brandingLoading} compact={compact} modules={modules} onToggle={toggleCompact} onSignOut={signOut} /> : null}
      {!focus ? (
        <Drawer
          id={MOBILE_NAVIGATION_ID}
          open={mobileOpen}
          onOpenChange={setMobileOpen}
          title="Navegação principal"
          description="Acesse os módulos disponíveis para o seu perfil."
          side="left"
          className="max-w-[20rem]"
          contentClassName="flex p-0 sm:p-0"
          closeLabel="Fechar menu"
        >
          <SidebarContent user={user} branding={branding} brandingLoading={brandingLoading} compact={false} modules={modules} mobile onNavigate={() => setMobileOpen(false)} onSignOut={signOut} />
        </Drawer>
      ) : null}
      {/* `platform-shell-content` é o container de rolagem no desktop (html/body
          ficam overflow:hidden) — o modo foco mantém a classe e apenas remove o
          recuo reservado à barra lateral. */}
      <div className={`platform-shell-content min-w-0 w-full transition-[padding] duration-300 ${focus ? "platform-shell-content--focus" : ""}`}>
        <header data-print-hidden="true" className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-4 shadow-[0_8px_28px_-26px_rgba(15,23,42,.8)] backdrop-blur-xl sm:px-5 lg:px-6">
          <div className="mx-auto flex min-h-16 max-w-[1760px] items-center justify-between gap-3 py-2">
            <div className="flex min-w-0 items-center gap-3">
              {focus ? (
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--border-subtle)] bg-white shadow-[0_8px_22px_-18px_rgba(7,59,98,.8)]">
                  <PlatformLogo src={branding.logoUrl} alt="" organizationName={branding.organizationName} width={30} height={30} sizes="30px" loading={brandingLoading} className="h-7 w-7 object-contain text-[10px]" />
                </span>
              ) : (
                <button type="button" onClick={() => setMobileOpen(true)} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-[var(--brand-primary)] shadow-sm lg:hidden" aria-label="Abrir menu" aria-expanded={mobileOpen} aria-controls={MOBILE_NAVIGATION_ID}>
                  <PlatformIcon name="menu" />
                </button>
              )}
              <div className="flex min-w-0 items-center gap-2 text-sm">
                {/*
                  Regra: **um** dos dois trunca, nunca os dois.

                  Antes ambos tinham `truncate` e encolhiam juntos — em tela
                  estreita o cabeçalho virava "ADMINISTRAÇÃO ·… / Ciclo de
                  Devolutivas e Desenvol…", as duas metades cortadas e nenhuma
                  informação inteira. A primeira tentativa de correção limitou o
                  contexto a um terço da linha, e isso o cortava mesmo **sobrando
                  espaço**: "Ambiente institucional" precisa de 200px, recebia 97
                  numa linha de 294 e virava "AMBIENT…".

                  O contexto é um rótulo curto, autoral e fixo por rota, então
                  não encolhe (`shrink-0`) nem quebra (`whitespace-nowrap`). Quem
                  absorve a pressão é o título, que é o texto variável e o único
                  com motivo para truncar. Abaixo de `sm` o contexto some, e o
                  título fica com a linha inteira.
                */}
                {eyebrow ? <p className="hidden shrink-0 whitespace-nowrap text-xs font-medium text-[var(--text-secondary)] sm:block">{eyebrow}</p> : null}
                {eyebrow ? <span className="hidden shrink-0 text-[var(--border-strong)] sm:inline" aria-hidden="true">/</span> : null}
                <h1 className="min-w-0 truncate font-semibold tracking-tight text-[var(--text-primary)]">{title}</h1>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {branding.onlinePresenceEnabled ? <OnlinePresenceIndicator user={user} canView={canViewPresence} /> : null}
              <PlatformThemeToggle compact />
              {focus ? (
                <Link href={exitHref} className="secondary-button" aria-label="Sair da avaliação">
                  <X className="h-4 w-4" aria-hidden="true" />
                  Sair
                </Link>
              ) : actions}
              <Link href="/perfil" className="hidden min-h-11 items-center gap-2 rounded-xl border border-transparent px-1.5 py-1 transition hover:border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] sm:flex" aria-label={`Abrir perfil de ${user.fullName}`}>
                <Avatar user={user} compact />
                <span className="hidden max-w-40 text-left xl:block"><strong className="block truncate text-xs text-[var(--text-primary)]">{user.fullName}</strong><span className="block truncate text-xs text-[var(--text-secondary)]">{user.profileLabel}</span></span>
              </Link>
            </div>
          </div>
        </header>
        <main id="conteudo-principal" tabIndex={-1} className="mx-auto min-w-0 max-w-[1760px] px-4 py-4 outline-none sm:px-5 lg:px-6 lg:py-5">{children}</main>
        {showFooter ? <PlatformFooter /> : null}
      </div>
    </div>
  );
}

export { PlatformSkeleton } from "@/components/platform-skeleton";
