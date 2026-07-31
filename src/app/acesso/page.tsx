"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export default function AccessPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const checkSession = async () => {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase.auth.getUser();
      if (data.user) window.location.replace("/area");
    };
    void checkSession();
  }, []);

  async function signInWithGoogle() {
    setLoading(true);
    setMessage("");

    try {
      const supabase = createBrowserSupabaseClient();
      const redirectTo = `${window.location.origin}/auth/confirm?next=/area`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            hd: "agenciasus.org.br",
            prompt: "select_account",
          },
        },
      });
      if (error) throw error;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível iniciar o acesso com Google.");
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#eef4f8] px-5 py-10">
      <div className="absolute inset-x-0 top-0 h-2 bg-[linear-gradient(90deg,#003b70_0_20%,#0b8f58_20%_40%,#f2b705_40%_60%,#d92d3a_60%_80%,#00a8d6_80%_100%)]" />
      <div className="absolute left-[-12rem] top-[-10rem] h-[34rem] w-[34rem] rounded-full bg-blue-200/50 blur-3xl" />
      <div className="absolute bottom-[-14rem] right-[-10rem] h-[36rem] w-[36rem] rounded-full bg-emerald-200/40 blur-3xl" />
      <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(#003b70_1px,transparent_1px),linear-gradient(90deg,#003b70_1px,transparent_1px)] [background-size:42px_42px]" />

      <section className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-[0_30px_90px_rgba(15,45,75,.18)] lg:grid-cols-[0.9fr_1.1fr]">
        <div className="hidden bg-[#073d6d] p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-sm font-black text-[#003b70]">Ag</div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-300">AgSUS</p>
                <p className="font-extrabold">Pesquisas e Avaliações</p>
              </div>
            </div>
            <h1 className="mt-12 text-4xl font-black leading-tight tracking-tight">Acesse seus ciclos, pesquisas e avaliações em um só lugar.</h1>
            <p className="mt-5 text-base leading-7 text-blue-100">Ambiente institucional para acompanhar pendências, responder formulários e consultar resultados publicados.</p>
          </div>

          <div className="space-y-3 text-sm text-blue-100">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">Acesso exclusivo com conta Google corporativa.</div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">Permissões e conteúdos definidos pelo seu perfil.</div>
          </div>
        </div>

        <div className="flex items-center p-7 sm:p-12 lg:p-14">
          <div className="mx-auto w-full max-w-md">
            <div className="lg:hidden">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#edf5fc] text-sm font-black text-[#003b70]">Ag</div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0b8f58]">AgSUS</p>
                  <p className="font-extrabold text-[#003b70]">Pesquisas e Avaliações</p>
                </div>
              </div>
            </div>

            <p className="mt-10 text-xs font-black uppercase tracking-[0.2em] text-[#0b8f58] lg:mt-0">Acesso institucional</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-[#003b70] sm:text-4xl">Entrar na plataforma</h2>
            <p className="mt-4 leading-7 text-slate-600">Use sua conta Google corporativa da AgSUS para acessar o painel e os ciclos disponíveis.</p>

            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={loading}
              className="mt-8 flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-300 bg-white px-5 py-4 font-black text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-[#0d6efd] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 bg-white text-lg font-black text-[#4285f4]">G</span>
              {loading ? "Abrindo conta Google..." : "Entrar com Google institucional"}
            </button>

            {message && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{message}</div>}

            <div className="mt-7 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              <strong className="block text-slate-800">Conta permitida</strong>
              Apenas endereços <b>@agenciasus.org.br</b> podem acessar a plataforma.
            </div>

            <p className="mt-8 text-xs leading-5 text-slate-500">Ao entrar, sua conta será associada ao cadastro institucional e às permissões do seu perfil.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
