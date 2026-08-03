"use client";

import { ArrowRight, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const LOGO_AGSUS = "https://i.postimg.cc/7PztC6jq/79255fad-06f0-4963-81f5-1fa4a116475e.png";

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/area";
}

function accessErrorMessage(code: string | null) {
  if (code === "dominio-nao-autorizado") return "O acesso é exclusivo para contas @agenciasus.org.br.";
  if (code === "oauth-invalido") return "A autenticação não foi concluída. Selecione novamente sua conta institucional.";
  return "";
}

export default function AccessPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setMessage(accessErrorMessage(query.get("erro")));
    void (async () => {
      try {
        const supabase = createBrowserSupabaseClient();
        const { data } = await supabase.auth.getUser();
        if (data.user) window.location.replace(safeNext(query.get("next")));
      } catch {
        setMessage("Não foi possível verificar a sessão atual.");
      }
    })();
  }, []);

  async function signInWithGoogle() {
    setLoading(true);
    setMessage("");
    try {
      const query = new URLSearchParams(window.location.search);
      const callbackUrl = new URL("/auth/confirm", window.location.origin);
      callbackUrl.searchParams.set("next", safeNext(query.get("next")));
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callbackUrl.toString(), queryParams: { prompt: "select_account", hd: "agenciasus.org.br" } },
      });
      if (error) throw error;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível iniciar o acesso com Google.");
      setLoading(false);
    }
  }

  return <main className="grid min-h-screen bg-slate-50 lg:grid-cols-[1.08fr_.92fr]">
    <section className="relative hidden overflow-hidden bg-[#063b67] p-12 text-white lg:flex lg:flex-col lg:justify-between">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(44,185,156,.28),transparent_35%),radial-gradient(circle_at_80%_80%,rgba(43,134,210,.28),transparent_40%)]" />
      <div className="relative"><img src={LOGO_AGSUS} alt="AgSUS" className="h-14 w-14 rounded-xl bg-white p-1.5" /><p className="mt-5 text-sm font-semibold tracking-wide text-blue-100">AgSUS · Pesquisas e Avaliações</p></div>
      <div className="relative max-w-xl"><p className="text-sm font-semibold uppercase tracking-[.18em] text-emerald-300">Decisões orientadas por evidências</p><h1 className="mt-4 text-5xl font-semibold leading-tight tracking-tight">Uma plataforma institucional para ouvir, analisar e evoluir.</h1><p className="mt-6 max-w-lg text-lg leading-8 text-blue-100">Pesquisas, avaliações e resultados em um ambiente seguro, organizado e integrado à identidade institucional.</p></div>
      <div className="relative flex items-center gap-2 text-sm text-blue-100"><ShieldCheck className="h-5 w-5 text-emerald-300" />Acesso protegido por autenticação institucional</div>
    </section>

    <section className="flex items-center justify-center p-6 sm:p-10">
      <div className="w-full max-w-md">
        <div className="lg:hidden"><img src={LOGO_AGSUS} alt="AgSUS" className="h-14 w-14" /></div>
        <p className="mt-8 text-sm font-semibold text-emerald-700 lg:mt-0">Acesso institucional</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Entrar na plataforma</h2>
        <p className="mt-3 text-base leading-7 text-slate-600">Use sua conta corporativa Google para acessar as pesquisas e módulos autorizados.</p>

        <button type="button" onClick={signInWithGoogle} disabled={loading} className="mt-8 flex w-full items-center justify-center gap-3 rounded-xl bg-[#0b4f82] px-5 py-3.5 font-semibold text-white shadow-sm transition hover:bg-[#083f69] disabled:cursor-not-allowed disabled:opacity-60"><span className="grid h-7 w-7 place-items-center rounded-full bg-white font-bold text-[#4285f4]">G</span>{loading ? "Abrindo conta Google..." : "Continuar com Google"}<ArrowRight className="h-4 w-4" /></button>

        {message && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium leading-6 text-red-800">{message}</div>}

        <div className="mt-8 border-t border-slate-200 pt-6"><p className="text-sm text-slate-500">Acesso permitido somente para:</p><p className="mt-2 font-semibold text-slate-900">@agenciasus.org.br</p></div>
        <p className="mt-10 text-xs leading-5 text-slate-400">Agência Brasileira de Apoio à Gestão do SUS</p>
      </div>
    </section>
  </main>;
}
