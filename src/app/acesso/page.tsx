"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const LOGO_AGSUS = "https://i.postimg.cc/7PztC6jq/79255fad-06f0-4963-81f5-1fa4a116475e.png";

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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f2f6f9] px-5 py-10 text-[#10243e]">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(90deg,#003b70_0_20%,#0b8f58_20%_40%,#f2b705_40%_60%,#d92d3a_60%_80%,#00a8d6_80%_100%)]" />
      <div className="absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-100/60 blur-3xl" />

      <section className="relative z-10 w-full max-w-[520px] overflow-hidden rounded-[2rem] border border-white bg-white shadow-[0_24px_80px_rgba(0,59,112,0.14)]">
        <div className="h-1.5 bg-[linear-gradient(90deg,#003b70,#0b8f58,#f2b705,#d92d3a,#00a8d6)]" />

        <div className="px-7 py-9 sm:px-12 sm:py-12">
          <div className="text-center">
            <img
              src={LOGO_AGSUS}
              alt="AgSUS"
              className="mx-auto h-20 w-20 object-contain"
            />

            <p className="mt-6 text-xs font-black uppercase tracking-[0.22em] text-[#0b8f58]">
              Acesso institucional
            </p>

            <h1 className="mt-3 text-3xl font-black tracking-tight text-[#003b70] sm:text-[2.15rem]">
              Plataforma de Pesquisas e Avaliações
            </h1>

            <p className="mx-auto mt-4 max-w-sm text-[15px] leading-7 text-slate-600">
              Entre com sua conta Google corporativa para acessar os formulários disponíveis para o seu perfil.
            </p>
          </div>

          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={loading}
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-2xl bg-[#003b70] px-5 py-4 font-black text-white shadow-lg shadow-blue-950/10 transition hover:-translate-y-0.5 hover:bg-[#075ea8] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-lg font-black text-[#4285f4]">
              G
            </span>
            {loading ? "Abrindo conta Google..." : "Entrar com Google institucional"}
          </button>

          {message && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold leading-6 text-red-800">
              {message}
            </div>
          )}

          <p className="mt-7 text-center text-xs leading-5 text-slate-500">
            Acesso permitido somente para contas <strong>@agenciasus.org.br</strong> vinculadas ao cadastro institucional.
          </p>
        </div>

        <footer className="border-t border-slate-100 bg-slate-50 px-6 py-4 text-center text-xs font-bold text-slate-500">
          Agência Brasileira de Apoio à Gestão do SUS
        </footer>
      </section>
    </main>
  );
}
