"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const LOGO_AGSUS = "https://i.postimg.cc/7PztC6jq/79255fad-06f0-4963-81f5-1fa4a116475e.png";

const pesquisas = [
  {
    codigo: "CDDI 2026",
    titulo: "Ciclo de Devolutivas e Desenvolvimento Individual",
    descricao: "Autoavaliação, avaliação da liderança, devolutivas e ações de desenvolvimento.",
    status: "Disponível para consulta",
    ativa: true,
  },
  {
    codigo: "Novos ciclos",
    titulo: "Pesquisas e avaliações institucionais",
    descricao: "A plataforma receberá novos formulários, públicos e períodos sem reconstrução do sistema.",
    status: "Em preparação",
    ativa: false,
  },
];

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
    <main className="relative min-h-screen overflow-hidden bg-[#eef4f8] px-5 py-8 text-[#10243e] sm:px-8 lg:px-10">
      <div className="absolute inset-x-0 top-0 h-2 bg-[linear-gradient(90deg,#003b70_0_20%,#0b8f58_20%_40%,#f2b705_40%_60%,#d92d3a_60%_80%,#00a8d6_80%_100%)]" />
      <div className="absolute left-[-15rem] top-[-12rem] h-[36rem] w-[36rem] rounded-full bg-blue-200/45 blur-3xl" />
      <div className="absolute bottom-[-16rem] right-[-10rem] h-[38rem] w-[38rem] rounded-full bg-emerald-200/35 blur-3xl" />
      <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(#003b70_1px,transparent_1px),linear-gradient(90deg,#003b70_1px,transparent_1px)] [background-size:42px_42px]" />

      <div className="relative z-10 mx-auto max-w-7xl">
        <header className="flex items-center justify-between gap-5 rounded-3xl border border-white/80 bg-white/90 px-5 py-4 shadow-sm backdrop-blur sm:px-7">
          <div className="flex items-center gap-4">
            <img src={LOGO_AGSUS} alt="AgSUS" className="h-12 w-12 rounded-2xl object-contain sm:h-14 sm:w-14" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0b8f58]">AgSUS</p>
              <h1 className="text-lg font-black text-[#003b70] sm:text-xl">Plataforma de Pesquisas e Avaliações</h1>
            </div>
          </div>
          <span className="hidden rounded-full border border-[#d7e5f2] bg-slate-50 px-4 py-2 text-xs font-black text-slate-600 sm:inline-flex">Acesso institucional</span>
        </header>

        <section className="grid items-stretch gap-7 py-8 lg:grid-cols-[1.1fr_0.9fr] lg:py-12">
          <div className="rounded-[2rem] bg-[linear-gradient(135deg,#003b70,#075ea8)] p-7 text-white shadow-[0_30px_90px_rgba(15,45,75,.22)] sm:p-10 lg:p-12">
            <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-emerald-200">Ambiente corporativo</span>
            <h2 className="mt-7 max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-5xl">Suas pesquisas, avaliações e ciclos em um único ambiente.</h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-blue-100">Acompanhe atividades, responda formulários, consulte resultados e, quando aplicável, gerencie as avaliações da sua equipe.</p>

            <div className="mt-9 grid gap-4 sm:grid-cols-2">
              {pesquisas.map((pesquisa) => (
                <article key={pesquisa.codigo} className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-black uppercase tracking-wider">{pesquisa.codigo}</span>
                    <span className={`h-2.5 w-2.5 rounded-full ${pesquisa.ativa ? "bg-emerald-300" : "bg-amber-300"}`} />
                  </div>
                  <h3 className="mt-4 text-lg font-black">{pesquisa.titulo}</h3>
                  <p className="mt-2 text-sm leading-6 text-blue-100">{pesquisa.descricao}</p>
                  <p className="mt-4 text-xs font-black text-emerald-200">{pesquisa.status}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="flex items-center rounded-[2rem] border border-white/80 bg-white p-7 shadow-[0_30px_90px_rgba(15,45,75,.16)] sm:p-10 lg:p-12">
            <div className="mx-auto w-full max-w-md">
              <div className="flex items-center gap-4">
                <img src={LOGO_AGSUS} alt="AgSUS" className="h-16 w-16 rounded-2xl object-contain" />
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0b8f58]">Acesso institucional</p>
                  <p className="mt-1 text-sm font-bold text-slate-500">Conta Google corporativa</p>
                </div>
              </div>

              <h2 className="mt-8 text-3xl font-black tracking-tight text-[#003b70] sm:text-4xl">Entrar na plataforma</h2>
              <p className="mt-4 leading-7 text-slate-600">Use seu e-mail institucional da AgSUS. Após a autenticação, o sistema carregará somente os ciclos e funcionalidades autorizados para o seu perfil.</p>

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

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-blue-50 p-4 text-sm leading-6 text-slate-600">
                  <strong className="block text-[#003b70]">Domínio autorizado</strong>
                  @agenciasus.org.br
                </div>
                <div className="rounded-2xl bg-emerald-50 p-4 text-sm leading-6 text-slate-600">
                  <strong className="block text-emerald-900">Acesso por perfil</strong>
                  Participante ou liderança
                </div>
              </div>

              <p className="mt-7 text-xs leading-5 text-slate-500">O login Google confirma sua identidade. A autorização final depende do cadastro institucional vinculado ao ciclo.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
