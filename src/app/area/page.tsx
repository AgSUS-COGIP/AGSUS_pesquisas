"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type Context = {
  status: string;
  message?: string;
  person?: {
    employeeNumber: string;
    fullName: string;
    institutionalEmail: string | null;
    jobTitle: string | null;
    costCenter: string | null;
    workplace: string | null;
    metadata: Record<string, unknown>;
  };
  participant?: {
    status: string;
    accessProfile: string | null;
    completedAt: string | null;
  } | null;
  application?: {
    status: string;
    opensAt: string | null;
    closesAt: string | null;
  };
  isLeader?: boolean;
};

function initials(name?: string) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? ""}${parts.at(-1)?.[0] ?? ""}`.toUpperCase() || "--";
}

export default function ParticipantAreaPage() {
  const [context, setContext] = useState<Context | null>(null);
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [authenticatedEmail, setAuthenticatedEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [message, setMessage] = useState("");

  async function resolvePerson(number?: string) {
    setResolving(true);
    setMessage("");
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.rpc("resolve_authenticated_person", {
        target_employee_number: number?.trim() || null,
      });
      if (error) throw error;
      setContext(data as Context);
      if ((data as Context).status === "OK") {
        const refreshed = await supabase.rpc("get_my_cddi_context");
        if (!refreshed.error && refreshed.data) setContext(refreshed.data as Context);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível identificar seu cadastro.");
    } finally {
      setResolving(false);
    }
  }

  useEffect(() => {
    const load = async () => {
      const supabase = createBrowserSupabaseClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        window.location.replace("/acesso");
        return;
      }
      setAuthenticatedEmail(userData.user.email ?? "");

      const { data, error } = await supabase.rpc("get_my_cddi_context");
      if (!error && data && (data as Context).status === "OK") {
        setContext(data as Context);
      } else {
        await resolvePerson();
      }
      setLoading(false);
    };
    void load();
  }, []);

  async function submitEmployeeNumber(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await resolvePerson(employeeNumber);
  }

  async function signOut() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    window.location.replace("/acesso");
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center"><div className="text-center"><div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-t-[var(--primary)]"/><p className="mt-4 font-black text-[var(--primary-dark)]">Preparando seu ambiente...</p></div></main>;
  }

  if (!context || context.status !== "OK") {
    const needsNumber = context?.status === "NEEDS_EMPLOYEE_NUMBER";
    return (
      <main className="min-h-screen bg-[#edf3f8] px-5 py-12">
        <section className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-7 shadow-xl sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--success)]">Identificação do participante</p>
          <h1 className="mt-2 text-3xl font-black text-[var(--primary-dark)]">Confirme seu cadastro</h1>
          <div className="mt-6 rounded-2xl bg-slate-50 p-4"><span className="text-xs font-bold text-slate-500">E-mail autenticado</span><strong className="mt-1 block text-slate-800">{authenticatedEmail}</strong></div>
          <p className="mt-5 leading-7 text-slate-600">{context?.message ?? "Não encontramos uma identidade de acesso elegível para este e-mail."}</p>

          {needsNumber && (
            <form onSubmit={submitEmployeeNumber} className="mt-6 space-y-4">
              <div><label htmlFor="employeeNumber" className="text-sm font-black text-slate-700">Matrícula</label><input id="employeeNumber" value={employeeNumber} onChange={(event) => setEmployeeNumber(event.target.value.replace(/\D/g, ""))} required inputMode="numeric" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-4 outline-none focus:border-[var(--primary)] focus:ring-4 focus:ring-blue-100"/></div>
              <button disabled={resolving} className="w-full rounded-2xl bg-[var(--primary)] px-5 py-4 font-black text-white disabled:opacity-60">{resolving ? "Validando..." : "Confirmar matrícula"}</button>
            </form>
          )}

          {message && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{message}</div>}
          <button type="button" onClick={signOut} className="mt-6 rounded-xl border border-slate-300 px-4 py-3 font-bold text-slate-700">Sair e usar outra conta</button>
        </section>
      </main>
    );
  }

  const person = context.person!;
  const applicationClosed = context.application?.status === "CLOSED";

  return (
    <main className="min-h-screen bg-[#edf3f8]">
      <header className="border-b border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div><p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--success)]">AgSUS · CDDI 2026</p><h1 className="text-xl font-black text-[var(--primary-dark)]">Área do participante</h1></div>
          <button onClick={signOut} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-black text-slate-700">Sair</button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8">
        <section className="rounded-3xl bg-[#102c4c] p-6 text-white shadow-xl sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white text-2xl font-black text-[#102c4c]">{initials(person.fullName)}</div>
            <div className="flex-1"><p className="text-sm font-bold text-emerald-300">Bem-vindo(a)</p><h2 className="mt-1 text-3xl font-black">{person.fullName}</h2><p className="mt-2 text-blue-100">Matrícula {person.employeeNumber} · {person.jobTitle ?? "Cargo não informado"}</p></div>
            <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-black">{context.isLeader ? "Perfil de liderança" : "Participante"}</span>
          </div>
        </section>

        {applicationClosed && <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900"><strong>Período encerrado.</strong> O ciclo está disponível apenas para consulta até a reabertura administrativa.</div>}

        <section className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <Link href="/cddi" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
            <span className="inline-flex rounded-xl bg-blue-100 px-3 py-2 text-xs font-black text-blue-800">AUTOAVALIAÇÃO</span>
            <h3 className="mt-5 text-2xl font-black text-[var(--primary-dark)]">Minha autoavaliação</h3>
            <p className="mt-3 leading-7 text-slate-600">Responder ou consultar sua avaliação por competências.</p>
          </Link>

          {context.isLeader && <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><span className="inline-flex rounded-xl bg-emerald-100 px-3 py-2 text-xs font-black text-emerald-800">LIDERANÇA</span><h3 className="mt-5 text-2xl font-black text-[var(--primary-dark)]">Minha equipe</h3><p className="mt-3 leading-7 text-slate-600">Avaliações pendentes, em andamento e concluídas dos trabalhadores vinculados.</p><span className="mt-5 inline-flex rounded-xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-500">Próxima entrega</span></div>}

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><span className="inline-flex rounded-xl bg-amber-100 px-3 py-2 text-xs font-black text-amber-900">RESULTADOS</span><h3 className="mt-5 text-2xl font-black text-[var(--primary-dark)]">Meus resultados</h3><p className="mt-3 leading-7 text-slate-600">Acompanhamento dos resultados publicados e comprovantes do ciclo.</p><span className="mt-5 inline-flex rounded-xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-500">Disponível após publicação</span></div>
        </section>
      </div>
    </main>
  );
}
