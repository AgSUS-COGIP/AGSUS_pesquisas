"use client";

import Link from "next/link";
import { AdminPeopleTeamsManagement } from "@/components/admin-people-teams-management";
import { PlatformShell } from "@/components/platform-shell";
import { PlatformGuardState } from "@/components/platform-guard-state";
import { usePlatformGuard } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";

export default function AdminTeamsPage() {
  const guard = usePlatformGuard(PLATFORM_MODULE.ADMIN_TEAMS);

  if (guard.state !== "granted") {
    return <PlatformGuardState
      guard={guard}
      title="gestão institucional"
      unidentifiedTitle="Não foi possível abrir equipes"
      restrictedTitle="Gestão institucional restrita"
      restrictedDescription="A edição de dados funcionais e vínculos é exclusiva do Superadmin."
    />;
  }

  return <PlatformShell user={guard.user} eyebrow="Estrutura organizacional" title="Pessoas, equipes e lideranças">
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
