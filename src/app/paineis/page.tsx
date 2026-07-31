"use client";

import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { deriveModules, profileLabel, usePlatformContext } from "@/lib/platform-context";

export default function DashboardsPage() {
  const { context, loading, error } = usePlatformContext();
  if (loading) return <PlatformSkeleton title="Carregando painéis" />;
  if (!context?.person) return <main className="p-10 text-red-700">{error || "Acesso não identificado."}</main>;
  const modules = deriveModules(context);

  const dashboards = [
    { title: "Meu acompanhamento", description: "Situação individual, etapas concluídas e pendências dos ciclos.", color: "border-blue-500", enabled: true },
    { title: "Painel da liderança", description: "Acompanhamento das avaliações e pendências das pessoas vinculadas à equipe.", color: "border-emerald-500", enabled: modules.includes("TEAM") },
    { title: "Resultados consolidados", description: "Indicadores consolidados liberados após publicação administrativa.", color: "border-amber-500", enabled: false },
  ];

  return (
    <PlatformShell user={{ fullName: context.person.fullName, institutionalEmail: context.person.institutionalEmail, employeeNumber: context.person.employeeNumber, profileLabel: profileLabel(context), roles: context.roles, modules }} eyebrow="Visualizações autorizadas" title="Painéis">
      <section className="rounded-3xl border-t-4 border-emerald-500 bg-white p-6 shadow-sm ring-1 ring-[#d7e5f2]">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0b8f58]">Acesso por perfil</p>
        <h2 className="mt-1 text-2xl font-black text-[#003b70]">Painéis disponíveis para você</h2>
        <p className="mt-2 text-slate-600">A administração define quais visualizações cada usuário ou papel institucional pode consultar.</p>
      </section>

      <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {dashboards.filter((item) => item.enabled || item.title === "Resultados consolidados").map((item) => (
          <article key={item.title} className={`rounded-3xl border-t-4 ${item.color} bg-white p-6 shadow-sm ring-1 ring-[#d7e5f2]`}>
            <h3 className="text-xl font-black text-[#003b70]">{item.title}</h3>
            <p className="mt-3 leading-7 text-slate-600">{item.description}</p>
            <button disabled={!item.enabled} className="mt-7 w-full rounded-xl border border-[#d7e5f2] bg-slate-50 px-5 py-3 font-black text-[#003b70] disabled:cursor-not-allowed disabled:text-slate-400">
              {item.enabled ? "Abrir painel" : "Aguardando liberação"}
            </button>
          </article>
        ))}
      </div>
    </PlatformShell>
  );
}
