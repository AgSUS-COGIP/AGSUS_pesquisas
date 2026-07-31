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
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f3f7fb] px-6">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-t-[#0d6efd]" />
          <p className="mt-4 font-black text-[#003b70]">Preparando seu painel...</p>
        </div>
      </main>
    );
  }

  if (!context || context.status !== "OK") {
    const needsNumber = context?.status === "NEEDS_EMPLOYEE_NUMBER";
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f3f7fb] px-5 py-12">
        <section className="w-full max-w-xl rounded-3xl border border-[#d7e5f2] bg-white p-7 shadow-xl sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0b8f58]">Identificação institucional</p>
          <h1 className="mt-2 text-3xl font-black text-[#003b70]">Confirme seu cadastro</h1>
          <div className="mt-6 rounded-2xl bg-slate-50 p-4">
            <span className="text-xs font-bold text-slate-500">Conta Google autenticada</span>
            <strong className="mt-1 block text-slate-800">{authenticatedEmail}</strong>
          </div>
          <p className="mt-5 leading-7 text-slate-600">{context?.message ?? "Não encontramos um cadastro elegível para esta conta."}</p>

          {needsNumber && (
            <form onSubmit={submitEmployeeNumber} className="mt-6 space-y-4">
              <div>
                <label htmlFor="employeeNumber" className="text-sm font-black text-slate-700">Matrícula</label>
                <input
                  id="employeeNumber"
                  value={employeeNumber}
                  onChange={(event) => setEmployeeNumber(event.target.value.replace(/\D/g, ""))}
                  required
                  inputMode="numeric"
                  className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-4 outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-blue-100"
                />
              </div>
              <button disabled={resolving} className="w-full rounded-2xl bg-[#003b70] px-5 py-4 font-black text-white disabled:opacity-60">
                {resolving ? "Validando..." : "Confirmar matrícula"}
              </button>
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
  const profileLabel = context.isLeader ? "Liderança" : "Participante";

  return (
    <main className="min-h-screen bg-[#f3f7fb] text-[#10243e]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-[#003b70] px-4 py-5 text-white lg:flex">
        <div className="flex items-center gap-3 px-2">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-sm font-black text-[#003b70]">Ag</div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">AgSUS</p>
            <p className="font-extrabold">Pesquisas</p>
          </div>
        </div>

        <nav className="mt-8 space-y-2 text-sm">
          <a href="#visao-geral" className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 font-black text-[#003b70]">Visão geral</a>
          <a href="#atividades" className="flex items-center gap-3 rounded-xl px-4 py-3 font-bold text-blue-100 hover:bg-white/10">Pesquisas e avaliações</a>
          {context.isLeader && <a href="#equipe" className="flex items-center gap-3 rounded-xl px-4 py-3 font-bold text-blue-100 hover:bg-white/10">Minha equipe</a>}
          <a href="#resultados" className="flex items-center gap-3 rounded-xl px-4 py-3 font-bold text-blue-100 hover:bg-white/10">Resultados</a>
        </nav>

        <div className="mt-auto rounded-2xl border border-white/15 bg-white/10 p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-white font-black text-[#003b70]">{initials(person.fullName)}</div>
            <div className="min-w-0">
              <strong className="block truncate text-sm">{person.fullName}</strong>
              <span className="text-xs text-blue-200">{profileLabel}</span>
            </div>
          </div>
          <button onClick={signOut} className="mt-4 w-full rounded-xl border border-white/20 px-3 py-2 text-sm font-bold text-white hover:bg-white/10">Sair</button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-[#d7e5f2] bg-white/95 px-5 py-4 shadow-sm backdrop-blur lg:px-8">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0b8f58]">Painel institucional</p>
              <h1 className="text-xl font-black text-[#003b70]">Pesquisas e Avaliações</h1>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden rounded-full bg-blue-50 px-4 py-2 text-xs font-black text-[#003b70] sm:inline-flex">{profileLabel}</span>
              <button onClick={signOut} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-black text-slate-700 lg:hidden">Sair</button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-5 py-7 lg:px-8">
          <section id="visao-geral" className="overflow-hidden rounded-3xl bg-[linear-gradient(120deg,#003b70,#075ea8)] p-6 text-white shadow-xl sm:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-bold text-emerald-300">Bem-vindo(a),</p>
                <h2 className="mt-1 text-3xl font-black">{person.fullName}</h2>
                <p className="mt-2 text-blue-100">Matrícula {person.employeeNumber} · {person.jobTitle ?? "Cargo não informado"}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4">
                  <strong className="block text-2xl">1</strong>
                  <span className="text-xs text-blue-100">ciclo disponível</span>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4">
                  <strong className="block text-2xl">{context.isLeader ? "2" : "1"}</strong>
                  <span className="text-xs text-blue-100">perfis de atuação</span>
                </div>
              </div>
            </div>
          </section>

          {applicationClosed && (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
              <strong>Período encerrado.</strong> O ciclo está disponível para consulta até a reabertura administrativa.
            </div>
          )}

          <section id="atividades" className="mt-7">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0b8f58]">Suas atividades</p>
                <h2 className="mt-1 text-2xl font-black text-[#003b70]">Pesquisas e avaliações</h2>
              </div>
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              <article className="rounded-3xl border border-[#d7e5f2] bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-800">CDDI 2026</span>
                  <span className="text-xs font-bold text-slate-500">Autoavaliação</span>
                </div>
                <h3 className="mt-5 text-xl font-black text-[#003b70]">Minha autoavaliação</h3>
                <p className="mt-3 leading-7 text-slate-600">Avalie competências, comportamentos e nível de desenvolvimento.</p>
                <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-0 rounded-full bg-[#0d6efd]" /></div>
                <div className="mt-3 flex items-center justify-between text-xs font-bold text-slate-500"><span>Não iniciada</span><span>0%</span></div>
                <Link href="/cddi" className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[#003b70] px-5 py-3 font-black text-white hover:bg-[#075ea8]">Acessar formulário</Link>
              </article>

              {context.isLeader && (
                <article id="equipe" className="rounded-3xl border border-[#d7e5f2] bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">Liderança</span>
                    <span className="text-xs font-bold text-slate-500">Equipe</span>
                  </div>
                  <h3 className="mt-5 text-xl font-black text-[#003b70]">Avaliações da equipe</h3>
                  <p className="mt-3 leading-7 text-slate-600">Acompanhe pendências e avaliações das pessoas vinculadas à sua liderança.</p>
                  <button className="mt-6 w-full rounded-xl border border-[#d7e5f2] bg-slate-50 px-5 py-3 font-black text-slate-500">Painel da equipe</button>
                </article>
              )}

              <article id="resultados" className="rounded-3xl border border-[#d7e5f2] bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900">Resultados</span>
                  <span className="text-xs font-bold text-slate-500">Publicação</span>
                </div>
                <h3 className="mt-5 text-xl font-black text-[#003b70]">Meus resultados</h3>
                <p className="mt-3 leading-7 text-slate-600">Consulte devolutivas e resultados publicados dos ciclos concluídos.</p>
                <button className="mt-6 w-full rounded-xl border border-[#d7e5f2] bg-slate-50 px-5 py-3 font-black text-slate-500">Ainda não disponível</button>
              </article>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
