"use client";

import Link from "next/link";
import { AdminPeopleTeamsManagement } from "@/components/admin-people-teams-management";
import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { deriveModules, profileLabel, usePlatformContext } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";

export default function AdminTeamsPage() {
  const { context, loading, error } = usePlatformContext();

  if (loading) return <PlatformSkeleton title="Carregando gestão institucional" />;
  if (!context?.person) return <main className="p-10 text-red-700">{error || "Acesso não identificado."}</main>;

  const modules = deriveModules(context);
  if (!modules.includes(PLATFORM_MODULE.ADMIN_TEAMS) || !context.roles?.includes("ADMINISTRATOR")) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6"><section className="max-w-lg rounded-3xl bg-white p-8 shadow-xl"><h1 className="text-3xl font-black text-[#003b70]">Acesso restrito</h1><p className="mt-3 text-slate-600">A edição de dados funcionais e vínculos institucionais é exclusiva do Administrador da Plataforma.</p><Link href="/area" className="mt-6 inline-flex rounded-xl bg-[#003b70] px-5 py-3 font-black text-white">Voltar ao painel</Link></section></main>;
  }

  const user = {
    fullName: context.person.fullName,
    institutionalEmail: context.person.institutionalEmail,
    employeeNumber: context.person.employeeNumber,
    profileLabel: profileLabel(context),
    avatarUrl: context.person.avatarUrl,
    roles: context.roles,
    modules,
  };

  return <PlatformShell user={user} eyebrow="Estrutura organizacional" title="Pessoas, equipes e lideranças" actions={<Link href="/admin/importacao" className="hidden rounded-xl bg-[#003b70] px-4 py-2.5 text-sm font-black text-white transition hover:bg-[#075ea8] md:inline-flex">Revisar importações</Link>}>
    <section className="mb-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
      <p className="text-xs font-black uppercase tracking-[.16em] text-[#0b8f58]">Administração da plataforma</p>
      <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><h2 className="text-3xl font-black text-[#003b70]">Mantenha a estrutura institucional correta</h2><p className="mt-3 max-w-3xl leading-7 text-slate-600">Consulte pessoas, corrija dados funcionais e defina vínculos de liderança por ciclo. Matrículas não podem ser alteradas e todas as mudanças exigem justificativa e ficam registradas para auditoria.</p></div>
        <Link href="/admin" className="inline-flex shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-[#003b70] transition hover:bg-white">Voltar à central</Link>
      </div>
    </section>
    <AdminPeopleTeamsManagement />
  </PlatformShell>;
}
