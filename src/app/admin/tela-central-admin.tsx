"use client";

import { ArrowRight, BarChart3, FileCog, Network, Settings2, ShieldCheck, Users2 } from "lucide-react";
import Link from "next/link";
import { PlatformShell } from "@/components/platform-shell";
import { FullPageState } from "@/components/full-page-state";
import { PlatformGuardState } from "@/components/platform-guard-state";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Surface } from "@/components/ui/surface";
import { usePlatformGuard } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";

// Cada cartão declara o módulo que o libera — o mesmo mapa de perfis que governa
// o menu, sem lista de exceções por rota. `hint` responde "o que eu consigo
// fazer aqui?"; o texto anterior ("Construtor disponível") ocupava o lugar de
// uma métrica sem ser uma.
const cards = [
  { href: "/admin/pesquisas", module: PLATFORM_MODULE.ADMIN_SURVEYS, tag: "Configuração", title: "Avaliações e ciclos", description: "Crie instrumentos, organize seções e perguntas, defina períodos e publique versões controladas.", hint: "Construir formulário · abrir e encerrar ciclo", icon: FileCog },
  { href: "/admin/participantes", module: PLATFORM_MODULE.ADMIN_PARTICIPANTS, tag: "Público", title: "Participantes", description: "Escolha quem responde cada avaliação e trate bloqueios, reativações e exclusões.", hint: "Vincular pessoas · individual ou em lote", icon: Users2 },
  { href: "/admin/equipes", module: PLATFORM_MODULE.ADMIN_TEAMS, tag: "Estrutura", title: "Equipes e lideranças", description: "Corrija dados funcionais e defina quem avalia quem em cada ciclo.", hint: "Exige justificativa · fica em auditoria", icon: Network },
  { href: "/admin/configuracoes", module: PLATFORM_MODULE.ADMIN_ACCESS, tag: "Sistema", title: "Configurações do sistema", description: "Marca, aparência e perfis de acesso das pessoas — em um só lugar.", hint: "Marca, aparência e acessos", icon: Settings2 },
  { href: "/paineis", module: PLATFORM_MODULE.DASHBOARDS, tag: "Governança", title: "Painéis e indicadores", description: "Acompanhe adesão, conclusão e inconsistências dos ciclos em andamento.", hint: "Somente leitura", icon: BarChart3 },
];

const FLOW_STEPS = [
  ["01", "Estruture", "Crie a avaliação, as seções e as perguntas."],
  ["02", "Defina o público", "Vincule quem deve responder ao ciclo."],
  ["03", "Publique e abra", "Congele a versão e libere o período de resposta."],
  ["04", "Monitore", "Acompanhe adesão e resultados nos painéis."],
] as const;

const GUARANTEES = [
  ["Versionamento", "Publicar congela a estrutura; versões anteriores continuam consultáveis."],
  ["Rastreabilidade", "Operações críticas ficam registradas em auditoria, com autor e momento."],
  ["Segregação", "Cada perfil enxerga apenas os módulos que lhe cabem."],
  ["Privacidade", "Dados pessoais ficam no banco institucional, nunca no repositório."],
] as const;

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

  return <PlatformShell
    user={guard.user}
    eyebrow="Administração"
    title="Central administrativa"
  >
    <div className="mx-auto w-full max-w-[1400px] space-y-5">
      <PageHeader
        eyebrow="Governança da plataforma"
        title="O que você administra aqui"
        description="Da criação do instrumento à abertura do ciclo e ao acompanhamento dos resultados. Cada operação é validada no banco e registrada em auditoria."
        actions={<Badge variant="info">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          {visibleCards.length} {visibleCards.length === 1 ? "módulo liberado" : "módulos liberados"} para {guard.user.profileLabel}
        </Badge>}
      />

      <section aria-label="Módulos administrativos">
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleCards.map((card) => {
            const Icon = card.icon;
            return (
              <li key={card.href} className="h-full">
                <Link
                  href={card.href}
                  className="group flex h-full flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-card)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-[var(--brand-primary)]">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <Badge variant="outline">{card.tag}</Badge>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold tracking-tight text-[var(--text-primary)]">{card.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-6 text-[var(--text-secondary)]">{card.description}</p>
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
                    <span className="text-xs leading-5 text-[var(--text-muted)]">{card.hint}</span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-[var(--brand-secondary)] transition group-hover:translate-x-1" aria-hidden="true" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Surface className="p-6">
          <p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--brand-secondary)]">Como funciona</p>
          <h3 className="mt-1 text-xl font-semibold tracking-tight text-[var(--text-primary)]">Da criação à publicação</h3>
          <ol className="mt-5 grid gap-3 sm:grid-cols-2">
            {FLOW_STEPS.map(([number, title, text]) => (
              <li key={number} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4">
                <span className="text-xs font-semibold text-[var(--brand-secondary)]">{number}</span>
                <strong className="mt-1 block text-sm font-semibold text-[var(--text-primary)]">{title}</strong>
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{text}</p>
              </li>
            ))}
          </ol>
        </Surface>

        <Surface className="p-6">
          <p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--brand-secondary)]">Garantias</p>
          <h3 className="mt-1 text-xl font-semibold tracking-tight text-[var(--text-primary)]">O que a plataforma protege</h3>
          <dl className="mt-5 space-y-4">
            {GUARANTEES.map(([title, text]) => (
              <div key={title} className="flex gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--brand-secondary)]" aria-hidden="true" />
                <div>
                  <dt className="text-sm font-semibold text-[var(--text-primary)]">{title}</dt>
                  <dd className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{text}</dd>
                </div>
              </div>
            ))}
          </dl>
        </Surface>
      </div>
    </div>
  </PlatformShell>;
}
