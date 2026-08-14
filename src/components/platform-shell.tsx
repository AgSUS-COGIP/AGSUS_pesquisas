"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirmation-provider";
import { PersonAvatar } from "@/components/person-avatar";
import { usePlatformBranding } from "@/components/platform-branding-provider";
import { PlatformFooter } from "@/components/platform-footer";
import { PlatformLogo } from "@/components/platform-logo";
import { PlatformIcon } from "@/components/platform-icons";
import { PlatformThemeToggle } from "@/components/platform-theme-toggle";
import { Drawer } from "@/components/ui/overlay-panel";
import {
  isPlatformNavItemActive,
  navigationGroupsForModules,
  type PlatformNavGroup,
} from "@/lib/platform-navigation";
import { PARTICIPANT_ROLE_MODULES } from "@/lib/platform-modules";
import { isSuperAdminOnlyRoute } from "@/lib/platform-support";
import {
  isPlatformSidebarCompact,
  PLATFORM_SIDEBAR_ATTRIBUTE,
  PLATFORM_SIDEBAR_STORAGE_KEY,
} from "@/lib/platform-sidebar";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { PlatformBranding } from "@/lib/platform-branding";
const MOBILE_NAVIGATION_ID = "platform-mobile-navigation";

type PlatformUser = {
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
  return (
    <Link
      href="/area"
      aria-label="AgSUS Avaliações — ir para a visão geral"
      className={`flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 ${compact && !mobile ? "justify-center" : ""}`}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200/80 bg-white shadow-[0_8px_22px_-18px_rgba(7,59,98,.8)]">
        <PlatformLogo src={branding.logoUrl} alt="" organizationName={branding.organizationName} width={32} height={32} sizes="32px" loading={brandingLoading} className="h-8 w-8 object-contain text-[10px]" />
      </span>
      {showName ? (
        <span className="min-w-0 leading-none">
          <span className="block truncate text-[9px] font-black uppercase tracking-[.2em] text-[var(--brand-accent)]">{branding.organizationName}</span>
          <span className={`mt-1 block truncate text-sm font-black tracking-tight ${mobile ? "text-[var(--text-primary)]" : "text-[var(--sidebar-foreground)]"}`}>{branding.productName}</span>
        </span>
      ) : null}
    </Link>
  );
}

function NavGroup({ group, pathname, compact, onNavigate }: { group: PlatformNavGroup; pathname: string; compact: boolean; onNavigate?: () => void }) {
  return (
    <section className="mt-4" aria-labelledby={`nav-group-${group.title.toLowerCase()}`}>
      {!compact ? <p id={`nav-group-${group.title.toLowerCase()}`} className="px-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{group.title}</p> : null}
      <nav className="mt-2 space-y-1" aria-label={compact ? `Navegação — ${group.title}` : undefined}>
        {group.items.map((item) => {
          const active = isPlatformNavItemActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              title={compact ? item.label : undefined}
              aria-label={compact ? `${item.label}: ${item.description}` : undefined}
              aria-current={active ? "page" : undefined}
              className={`group relative flex min-h-11 items-center gap-3 rounded-xl px-2.5 text-sm font-bold transition-colors ${active ? "bg-[var(--brand-primary)] text-white shadow-[0_10px_24px_-18px_rgba(7,59,98,.95)]" : "text-slate-600 hover:bg-slate-100 hover:text-[var(--brand-primary)]"} ${compact ? "justify-center" : ""}`}
            >
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors ${active ? "bg-white/10" : "bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-[var(--brand-primary)]"}`} aria-hidden="true">
                <PlatformIcon name={item.icon} className="h-[18px] w-[18px]" />
              </span>
              {!compact ? <span className="truncate">{item.label}</span> : null}
            </Link>
          );
        })}
      </nav>
    </section>
  );
}

function SidebarContent({ user, branding, brandingLoading, compact, modules, mobile = false, onNavigate, onToggle, onSignOut }: { user: PlatformUser; branding: PlatformBranding; brandingLoading: boolean; compact: boolean; modules: string[]; mobile?: boolean; onNavigate?: () => void; onToggle?: () => void; onSignOut: () => void }) {
  const pathname = usePathname();
  const groups = navigationGroupsForModules(modules);

  return (
    <div className={`relative flex h-full min-h-0 flex-col overflow-hidden ${mobile ? "bg-[var(--surface-card)] text-[var(--text-primary)]" : "bg-[var(--sidebar-background)] text-[var(--sidebar-foreground)]"}`}>
      <div className={`flex h-16 shrink-0 items-center border-b border-[var(--border-subtle)] px-3 ${compact && !mobile ? "justify-center" : ""}`}>
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
        {groups.map((group) => <NavGroup key={group.title} group={group} pathname={pathname} compact={compact && !mobile} onNavigate={onNavigate} />)}
      </div>
      <div className={`shrink-0 border-t border-[var(--border-subtle)] p-2.5 ${mobile ? "bg-[var(--surface-card)]" : "bg-transparent"}`}>
        {!mobile && onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            className={`mb-1 flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-[var(--sidebar-muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--brand-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-1 ${compact ? "justify-center px-2" : ""}`}
            aria-label={compact ? "Expandir menu lateral" : "Recolher menu lateral"}
            aria-expanded={!compact}
          >
            <PlatformIcon name={compact ? "chevron-right" : "chevron-left"} className="h-4 w-4" aria-hidden="true" />
            {!compact ? <span>Recolher menu</span> : null}
          </button>
        ) : null}
        <Link href="/perfil" onClick={onNavigate} className={`flex min-h-11 items-center gap-2 rounded-xl p-2 transition hover:bg-[var(--surface-hover)] ${compact && !mobile ? "justify-center" : ""}`} aria-label={`Abrir perfil de ${user.fullName}`}>
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${mobile ? "bg-[var(--surface-muted)] text-[var(--brand-primary)]" : "bg-white/10 text-[var(--sidebar-foreground)]"}`} aria-hidden="true">
            <PlatformIcon name="profile" className="h-[18px] w-[18px]" />
          </span>
          {(!compact || mobile) ? <span className="min-w-0"><strong className={`block truncate text-xs ${mobile ? "text-[var(--text-primary)]" : "text-[var(--sidebar-foreground)]"}`}>Meu perfil</strong><span className={`block truncate text-[11px] ${mobile ? "text-[var(--text-secondary)]" : "text-[var(--sidebar-muted)]"}`}>{user.profileLabel}</span></span> : null}
        </Link>
        <button type="button" onClick={onSignOut} aria-label="Sair da sessão atual" className={`mt-1 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 ${compact && !mobile ? "px-2" : ""}`}>
          <PlatformIcon name="logout" className="h-4 w-4" />
          {(!compact || mobile) ? "Sair" : null}
        </button>
      </div>
    </div>
  );
}

function DesktopSidebar({ user, branding, brandingLoading, compact, modules, onToggle, onSignOut }: { user: PlatformUser; branding: PlatformBranding; brandingLoading: boolean; compact: boolean; modules: string[]; onToggle: () => void; onSignOut: () => void }) {
  return (
    <aside data-print-hidden="true" aria-label="Navegação principal" className="platform-desktop-sidebar fixed left-0 top-0 z-50 hidden h-dvh max-h-dvh flex-col overflow-hidden border-r border-slate-200 bg-white shadow-[12px_0_35px_-28px_rgba(15,23,42,.35)] transition-[width] duration-300 lg:flex">
      <SidebarContent user={user} branding={branding} brandingLoading={brandingLoading} compact={compact} modules={modules} onToggle={onToggle} onSignOut={onSignOut} />
    </aside>
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
  // O rodapé de suporte fica fora das rotas exclusivas do Superadmin (quem já é
  // o canal de suporte) e do modo foco, onde a barra de ações da avaliação ocupa
  // o rodapé da tela.
  const showFooter = !focus && !isSuperAdminOnlyRoute(pathname);

  // O estado recolhido já foi aplicado ao <html> pelo script beforeInteractive do
  // layout raiz; aqui apenas sincronizamos o React com o DOM para não sobrescrever
  // a preferência com o valor inicial `false`.
  useEffect(() => {
    setCompact(isPlatformSidebarCompact(document.documentElement.getAttribute(PLATFORM_SIDEBAR_ATTRIBUTE)));
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
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      setSigningOut(false);
      toast.error("Não foi possível encerrar esta sessão. Tente novamente.");
      return;
    }
    window.location.replace("/acesso");
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
          className="fixed inset-0 z-[200] grid place-items-center bg-[var(--surface-page)]/85 backdrop-blur-sm"
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-[var(--border-subtle)] border-t-[var(--brand-primary)] motion-reduce:animate-none" aria-hidden="true" />
            <p className="text-sm font-semibold text-[var(--text-primary)]">Encerrando sua sessão...</p>
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
                  Os dois truncavam ao mesmo tempo, e em tela estreita o
                  cabeçalho virava "ADMINISTRAÇÃO ·… / Ciclo de Devolutivas e
                  Desenvol…" — as duas metades cortadas, nenhuma informação
                  inteira. O título é o que identifica a página; o contexto é
                  quem cede. Abaixo de `sm` ele desaparece e o título fica com a
                  largura toda; a partir dali volta, limitado a um terço, para
                  encolher antes do título.
                */}
                {eyebrow ? <p className="hidden max-w-[33%] shrink truncate text-[10px] font-black uppercase tracking-[.14em] text-[var(--brand-accent)] sm:block sm:text-xs">{eyebrow}</p> : null}
                {eyebrow ? <span className="hidden shrink-0 text-[var(--border-strong)] sm:inline" aria-hidden="true">/</span> : null}
                <h1 className="min-w-0 truncate font-black tracking-tight text-[var(--text-primary)]">{title}</h1>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
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
