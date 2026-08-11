"use client";

import { ArrowRight, BarChart3, FileCog, FilePlus2, Network, Settings2, ShieldCheck, Users2 } from "lucide-react";
import Link from "next/link";
import { PlatformShell } from "@/components/platform-shell";
import { FullPageState } from "@/components/full-page-state";
import { PlatformGuardState } from "@/components/platform-guard-state";
import { usePlatformGuard } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";

// Cada cartão declara o módulo que o libera — o mesmo mapa de perfis que governa
// o menu, sem lista de exceções por rota.
const cards = [
  { href: "/admin/pesquisas", module: PLATFORM_MODULE.ADMIN_SURVEYS, tag: "Configuração", title: "Pesquisas e ciclos", description: "Crie instrumentos, organize seções, defina períodos e publique versões controladas.", metric: "Construtor disponível", icon: FileCog, tone: "bg-blue-50 text-blue-700" },
  { href: "/admin/participantes", module: PLATFORM_MODULE.ADMIN_PARTICIPANTS, tag: "Público", title: "Participantes", description: "Consulte elegibilidade, perfis, e-mails, unidades e situação de participação.", metric: "Base oficial controlada", icon: Users2, tone: "bg-emerald-50 text-emerald-700" },
  { href: "/admin/equipes", module: PLATFORM_MODULE.ADMIN_TEAMS, tag: "Estrutura", title: "Equipes e lideranças", description: "Gerencie vínculos de avaliação, responsáveis e ajustes organizacionais.", metric: "Vínculos auditáveis", icon: Network, tone: "bg-amber-50 text-amber-700" },
  { href: "/admin/configuracoes", module: PLATFORM_MODULE.ADMIN_ACCESS, tag: "Sistema", title: "Configurações do sistema", description: "Marca, aparência e perfis de acesso das pessoas — em um só lugar.", metric: "Marca e acessos", icon: Settings2, tone: "bg-violet-50 text-violet-700" },
  { href: "/paineis", module: PLATFORM_MODULE.DASHBOARDS, tag: "Governança", title: "Indicadores e auditoria", description: "Acompanhe adesão, conclusão, inconsistências e eventos relevantes.", metric: "Visão gerencial", icon: BarChart3, tone: "bg-rose-50 text-rose-700" },
];

export default function AdminDashboardPage() {
  // A central não exige um módulo específico: abre para quem tem qualquer
  // módulo administrativo e mostra apenas os cartões correspondentes.
  const guard = usePlatformGuard();

  if (guard.state !== "granted") {
    return <PlatformGuardState guard={guard} title="administração" unidentifiedTitle="Não foi possível abrir a administração" restrictedTitle="Central administrativa restrita" restrictedDescription="Seu perfil não possui permissão para acessar os módulos de administração." />;
  }

  const { modules } = guard;
  // A central abre para qualquer módulo administrativo — a regra é o prefixo,
  // não a lista de cartões (que inclui atalhos não administrativos, como /paineis).
  if (!modules.some((module) => module.startsWith("ADMIN_"))) {
    return <FullPageState tone="restricted" title="Central administrativa restrita" description="Seu perfil não possui permissão para acessar os módulos de administração." />;
  }

  const visibleCards = cards.filter((card) => modules.includes(card.module));

  return <PlatformShell user={guard.user} eyebrow="Administração" title="Central administrativa" actions={modules.includes(PLATFORM_MODULE.ADMIN_SURVEYS) ? <Link href="/admin/pesquisas/nova" className="primary-button hidden md:inline-flex"><FilePlus2 className="h-4 w-4" />Nova pesquisa</Link> : null}>
    <section className="rounded-2xl border border-[var(--border-subtle)] border-t-[3px] border-t-[var(--brand-solid)] bg-[var(--surface-card)] p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-3 py-1 text-[11px] font-black uppercase tracking-[.12em] text-[var(--status-success-text)]"><ShieldCheck className="h-3.5 w-3.5" />Ambiente de governança</span>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-[var(--text-primary)]">Operação das avaliações institucionais</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Crie instrumentos, organize públicos, acompanhe equipes e controle cada etapa de publicação em um fluxo auditável.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:min-w-72">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-interactive)] p-4"><span className="text-xs font-bold text-[var(--text-secondary)]">Módulos disponíveis</span><strong className="mt-1 block text-3xl font-black tabular-nums text-[var(--text-primary)]">{visibleCards.length}</strong><small className="block text-xs text-[var(--text-muted)]">conforme seu perfil</small></div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-interactive)] p-4"><span className="text-xs font-bold text-[var(--text-secondary)]">Ciclo atual</span><strong className="mt-1 block text-xl font-black text-[var(--text-primary)]">CDDI 2026</strong><small className="block text-xs text-[var(--text-muted)]">acompanhe em Painéis</small></div>
        </div>
      </div>
    </section>

    <section className="mt-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[var(--brand-secondary)]">Operação da plataforma</p><h2 className="mt-1 text-2xl font-black text-[var(--brand-primary)]">Módulos administrativos</h2><p className="mt-2 text-slate-600">Cada módulo representa uma etapa clara do ciclo de governança.</p></div>{modules.includes(PLATFORM_MODULE.DASHBOARDS) ? <Link href="/paineis" className="text-sm font-black text-[var(--brand-secondary)]">Ver indicadores →</Link> : null}</div><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visibleCards.map((card) => { const Icon = card.icon; return <Link href={card.href} key={card.href} className="group rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl"><div className="flex items-start justify-between gap-4"><div className={`grid h-11 w-11 place-items-center rounded-2xl ${card.tone}`}><Icon className="h-5 w-5" /></div><span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase tracking-[.08em] text-slate-500">{card.tag}</span></div><h3 className="mt-5 text-xl font-black text-[var(--brand-primary)]">{card.title}</h3><p className="mt-3 min-h-18 text-sm leading-6 text-slate-500">{card.description}</p><div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4"><span className="text-xs font-black uppercase tracking-[.08em] text-slate-400">{card.metric}</span><ArrowRight className="h-4 w-4 text-[var(--brand-secondary)] transition group-hover:translate-x-1" /></div></Link>; })}</div></section>

    <section className="mt-8 grid gap-5 lg:grid-cols-[1.05fr_.95fr]"><article className="rounded-[2rem] border border-slate-200/80 bg-white p-6 shadow-sm sm:p-7"><p className="text-xs font-black uppercase tracking-[.15em] text-[var(--brand-secondary)]">Fluxo inteligente</p><h3 className="mt-1 text-xl font-black text-[var(--brand-primary)]">Da ideia à publicação</h3><ol className="mt-6 grid gap-4 sm:grid-cols-2">{[["01","Estruture","Crie a avaliação, seções e perguntas."],["02","Valide","Revise regras, público e períodos."],["03","Publique","Abra o ciclo para o público definido."],["04","Monitore","Acompanhe adesão e resultados."]].map(([number,title,text]) => <li key={number} className="rounded-2xl bg-slate-50 p-4"><span className="text-xs font-black text-[var(--brand-secondary)]">{number}</span><strong className="mt-2 block text-[var(--brand-primary)]">{title}</strong><p className="mt-1 text-sm leading-6 text-slate-500">{text}</p></li>)}</ol></article><article className="rounded-[2rem] border border-slate-200/80 bg-white p-6 shadow-sm sm:p-7"><p className="text-xs font-black uppercase tracking-[.15em] text-[var(--brand-secondary)]">Controles essenciais</p><h3 className="mt-1 text-xl font-black text-[var(--brand-primary)]">Segurança por padrão</h3><div className="mt-6 space-y-4">{[["Versionamento","Preserva versões anteriores e histórico."],["Rastreabilidade","Registra mudanças e operações críticas."],["Segregação","Libera módulos conforme o papel institucional."],["Privacidade","Mantém dados pessoais fora do repositório."]].map(([title,text]) => <div key={title} className="flex gap-3"><div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" /><div><strong className="text-[var(--brand-primary)]">{title}</strong><p className="mt-1 text-sm leading-6 text-slate-500">{text}</p></div></div>)}</div></article></section>
  </PlatformShell>;
}
