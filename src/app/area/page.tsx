"use client";

import Link from "next/link";
import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { deriveModules, profileLabel, usePlatformContext } from "@/lib/platform-context";

export default function ParticipantAreaPage() {
  const { context, loading, error } = usePlatformContext();

  if (loading) return <PlatformSkeleton title="Preparando painel institucional" />;

  if (!context?.person || context.status !== "OK") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f2f6fa] px-6">
        <section className="w-full max-w-xl rounded-3xl border border-red-200 bg-white p-8 shadow-xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-red-700">Acesso institucional</p>
          <h1 className="mt-2 text-3xl font-black text-[#003b70]">Não foi possível abrir seu painel</h1>
          <p className="mt-4 leading-7 text-slate-600">{error || context?.message || "Cadastro institucional não localizado."}</p>
          <Link href="/acesso" className="mt-6 inline-flex rounded-xl bg-[#003b70] px-5 py-3 font-black text-white">Voltar ao acesso</Link>
        </section>
      </main>
    );
  }

  const person = context.person;
  const modules = deriveModules(context);
  const isLeader = modules.includes("TEAM");
  const closed = context.application?.status === "CLOSED";

  return (
    <PlatformShell
      user={{
        fullName: person.fullName,
        institutionalEmail: person.institutionalEmail,
        employeeNumber: person.employeeNumber,
        profileLabel: profileLabel(context),
        roles: context.roles,
        modules,
      }}
      eyebrow="Painel institucional"
      title="Pesquisas e Avaliações"
    >
      <section className="overflow-hidden rounded-3xl bg-[linear-gradient(120deg,#003b70,#075ea8)] p-7 text-white shadow-xl">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-bold text-emerald-300">Bem-vindo(a),</p>
            <h2 className="mt-1 text-3xl font-black">{person.fullName}</h2>
            <p className="mt-2 text-blue-100">Matrícula {person.employeeNumber} · {person.jobTitle ?? "Cargo não informado"}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-2xl border border-white/15 bg-white/10 px-6 py-4">
              <strong className="block text-2xl">1</strong>
              <span className="text-xs text-blue-100">pesquisa vinculada</span>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-6 py-4">
              <strong className="block text-2xl">{modules.filter((item) => !item.startsWith("ADMIN_")).length}</strong>
              <span className="text-xs text-blue-100">módulos liberados</span>
            </div>
          </div>
        </div>
      </section>

      {closed && (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          <strong>Período encerrado.</strong> O CDDI 2026 permanece disponível para consulta conforme as permissões do seu perfil.
        </div>
      )}

      <section className="mt-7">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0b8f58]">Acesso rápido</p>
            <h2 className="mt-1 text-2xl font-black text-[#003b70]">Seus módulos</h2>
          </div>
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <article className="rounded-3xl border-t-4 border-blue-500 bg-white p-6 shadow-sm ring-1 ring-[#d7e5f2]">
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-800">Pesquisas</span>
            <h3 className="mt-5 text-xl font-black text-[#003b70]">Formulários disponíveis</h3>
            <p className="mt-3 leading-7 text-slate-600">Acesse pesquisas abertas, continue rascunhos ou consulte ciclos encerrados.</p>
            <Link href="/pesquisas" className="mt-6 inline-flex w-full justify-center rounded-xl bg-[#003b70] px-5 py-3 font-black text-white">Ver pesquisas</Link>
          </article>

          <article className="rounded-3xl border-t-4 border-emerald-500 bg-white p-6 shadow-sm ring-1 ring-[#d7e5f2]">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">Painéis</span>
            <h3 className="mt-5 text-xl font-black text-[#003b70]">Acompanhamento e resultados</h3>
            <p className="mt-3 leading-7 text-slate-600">Consulte somente os painéis liberados para seu perfil institucional.</p>
            <Link href="/paineis" className="mt-6 inline-flex w-full justify-center rounded-xl border border-[#d7e5f2] bg-slate-50 px-5 py-3 font-black text-[#003b70]">Abrir painéis</Link>
          </article>

          {isLeader && (
            <article className="rounded-3xl border-t-4 border-amber-500 bg-white p-6 shadow-sm ring-1 ring-[#d7e5f2]">
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900">Liderança</span>
              <h3 className="mt-5 text-xl font-black text-[#003b70]">Minha equipe</h3>
              <p className="mt-3 leading-7 text-slate-600">Acompanhe vínculos, pendências e avaliações sob sua responsabilidade.</p>
              <Link href="/equipe" className="mt-6 inline-flex w-full justify-center rounded-xl border border-[#d7e5f2] bg-slate-50 px-5 py-3 font-black text-[#003b70]">Gerenciar equipe</Link>
            </article>
          )}
        </div>
      </section>
    </PlatformShell>
  );
}
