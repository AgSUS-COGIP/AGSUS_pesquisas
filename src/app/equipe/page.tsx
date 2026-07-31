"use client";

import { useEffect, useState } from "react";
import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { deriveModules, profileLabel, usePlatformContext } from "@/lib/platform-context";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type TeamMember = {
  id: string;
  fullName: string;
  employeeNumber: string;
  jobTitle: string | null;
  status: string;
};

export default function TeamPage() {
  const { context, loading, error } = usePlatformContext();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!context?.person) return;
    const loadTeam = async () => {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase.rpc("list_my_team");
      if (Array.isArray(data)) setMembers(data as TeamMember[]);
      setTeamLoading(false);
    };
    void loadTeam();
  }, [context?.person]);

  if (loading) return <PlatformSkeleton title="Carregando equipe" />;
  if (!context?.person) return <main className="p-10 text-red-700">{error || "Acesso não identificado."}</main>;
  const modules = deriveModules(context);

  return (
    <PlatformShell user={{ fullName: context.person.fullName, institutionalEmail: context.person.institutionalEmail, employeeNumber: context.person.employeeNumber, profileLabel: profileLabel(context), roles: context.roles, modules }} eyebrow="Gestão da liderança" title="Minha equipe">
      <section className="rounded-3xl border-t-4 border-emerald-500 bg-white p-6 shadow-sm ring-1 ring-[#d7e5f2]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0b8f58]">Vínculos de liderança</p>
            <h2 className="mt-1 text-2xl font-black text-[#003b70]">Pessoas vinculadas à sua equipe</h2>
            <p className="mt-2 text-slate-600">Acompanhe avaliações e solicite ajustes de vínculo com registro em auditoria.</p>
          </div>
          <button className="rounded-xl bg-[#003b70] px-5 py-3 font-black text-white">+ Solicitar integrante</button>
        </div>
      </section>

      <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#d7e5f2]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-black text-[#003b70]">Equipe atual</h3>
            <p className="mt-1 text-sm text-slate-500">{members.length} vínculo(s) localizado(s)</p>
          </div>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar nome ou matrícula" className="w-full max-w-sm rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500" />
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-[#d7e5f2]">
          {teamLoading ? (
            <div className="space-y-3 p-5">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}</div>
          ) : members.length ? (
            <div className="divide-y divide-slate-100">
              {members.filter((member) => `${member.fullName} ${member.employeeNumber}`.toLowerCase().includes(search.toLowerCase())).map((member) => (
                <div key={member.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div><strong className="text-[#003b70]">{member.fullName}</strong><p className="mt-1 text-sm text-slate-500">Matrícula {member.employeeNumber} · {member.jobTitle ?? "Cargo não informado"}</p></div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">{member.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-10 text-center"><strong className="text-[#003b70]">Nenhum vínculo carregado</strong><p className="mt-2 text-sm text-slate-500">A função de solicitação será disponibilizada após a configuração administrativa dos vínculos.</p></div>
          )}
        </div>
      </section>
    </PlatformShell>
  );
}
