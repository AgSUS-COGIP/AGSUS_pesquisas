"use client";

import Link from "next/link";
import { Activity, BarChart3, LockKeyhole, UsersRound } from "lucide-react";
import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { deriveModules, profileLabel, usePlatformContext } from "@/lib/platform-context";

export default function DashboardsPage() {
  const { context, loading, error } = usePlatformContext();
  if (loading) return <PlatformSkeleton title="Carregando painéis" />;
  if (!context?.person) return <main className="p-10 text-red-700">{error || "Acesso não identificado."}</main>;
  const modules = deriveModules(context);

  const dashboards = [
    {
      title: "AgSUS Monitora CDDI",
      description: "Indicadores, filtros, competências, evolução das respostas e acompanhamento operacional por participante.",
      href: "/paineis/cddi",
      enabled: true,
      icon: Activity,
      tone: "bg-blue-50 text-blue-700",
    },
    {
      title: "Painel da liderança",
      description: "Acompanhamento das avaliações e pendências das pessoas vinculadas à equipe.",
      href: "/paineis/cddi",
      enabled: modules.includes("TEAM"),
      icon: UsersRound,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      title: "Resultados consolidados",
      description: "Indicadores consolidados liberados após publicação administrativa.",
      href: "#",
      enabled: false,
      icon: BarChart3,
      tone: "bg-amber-50 text-amber-700",
    },
  ];

  return (
    <PlatformShell user={{ fullName: context.person.fullName, institutionalEmail: context.person.institutionalEmail, employeeNumber: context.person.employeeNumber, profileLabel: profileLabel(context), roles: context.roles, modules }} eyebrow="Visualizações autorizadas" title="Painéis">
      <section className="border-b border-slate-200 pb-5">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0b8f58]">Acesso por perfil</p>
        <h2 className="mt-1 text-2xl font-black text-[#003b70]">Painéis disponíveis para você</h2>
        <p className="mt-2 text-sm text-slate-500">Cada visualização respeita automaticamente o escopo autorizado: individual, equipe ou institucional.</p>
      </section>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {dashboards.map((item) => {
          const Icon = item.enabled ? item.icon : LockKeyhole;
          return (
            <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className={`grid h-11 w-11 place-items-center rounded-xl ${item.tone}`}><Icon className="h-5 w-5" /></div>
              <h3 className="mt-4 text-lg font-black text-[#003b70]">{item.title}</h3>
              <p className="mt-2 min-h-16 text-sm leading-6 text-slate-500">{item.description}</p>
              {item.enabled ? (
                <Link href={item.href} className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-[#075ea8] px-4 py-2.5 text-sm font-black text-white transition hover:bg-[#003b70]">Abrir painel</Link>
              ) : (
                <button disabled className="mt-5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-black text-slate-400">Aguardando liberação</button>
              )}
            </article>
          );
        })}
      </div>
    </PlatformShell>
  );
}
