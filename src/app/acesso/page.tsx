"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const LOGO_AGSUS = "https://i.postimg.cc/7PztC6jq/79255fad-06f0-4963-81f5-1fa4a116475e.png";
const BACKGROUNDS = Array.from({ length: 6 }, (_, index) => `/api/background/${index}`);

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/area";
}

function accessErrorMessage(code: string | null) {
  if (code === "dominio-nao-autorizado") return "O acesso é exclusivo para contas @agenciasus.org.br.";
  if (code === "oauth-invalido") return "A autenticação não foi concluída. Selecione novamente sua conta institucional.";
  return "";
}

function shuffledBackgrounds() {
  return [...BACKGROUNDS].sort(() => Math.random() - 0.5);
}

function preloadFirstAvailable(urls: string[]) {
  return new Promise<string | null>((resolve) => {
    const tryNext = (index: number) => {
      if (index >= urls.length) return resolve(null);
      const image = new Image();
      const timeout = window.setTimeout(() => {
        image.src = "";
        tryNext(index + 1);
      }, 9000);
      image.onload = () => {
        window.clearTimeout(timeout);
        resolve(urls[index]);
      };
      image.onerror = () => {
        window.clearTimeout(timeout);
        tryNext(index + 1);
      };
      image.src = urls[index];
    };
    tryNext(0);
  });
}

export default function AccessPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [background, setBackground] = useState<string | null>(null);
  const [backgroundVisible, setBackgroundVisible] = useState(false);

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams(window.location.search);
    setMessage(accessErrorMessage(query.get("erro")));

    void preloadFirstAvailable(shuffledBackgrounds()).then((loadedBackground) => {
      if (!active || !loadedBackground) return;
      setBackground(loadedBackground);
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => active && setBackgroundVisible(true)));
    });

    void (async () => {
      try {
        const supabase = createBrowserSupabaseClient();
        const { data } = await supabase.auth.getUser();
        if (data.user) window.location.replace(safeNext(query.get("next")));
      } catch {
        if (active) setMessage("Não foi possível verificar a sessão atual.");
      }
    })();

    return () => {
      active = false;
    };
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
        options: {
          redirectTo: callbackUrl.toString(),
          queryParams: {
            prompt: "select_account",
            hd: "agenciasus.org.br",
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#123f50] px-5 py-10 text-[#10243e]">
      <div className="absolute inset-0 overflow-hidden bg-[linear-gradient(145deg,#123d56_0%,#1e7b77_48%,#9bbb8b_100%)]">
        <div className="absolute -right-20 -top-28 h-[28rem] w-[28rem] rounded-full bg-amber-100/30 blur-3xl" />
        <div className="absolute left-[8%] top-[12%] h-48 w-48 rounded-full bg-cyan-100/15 blur-3xl" />
        <div className="absolute inset-x-[-8%] bottom-[-17%] h-[58%] bg-[#477966]/75 [clip-path:polygon(0_73%,10%_50%,20%_61%,31%_28%,43%_53%,56%_22%,69%_55%,82%_34%,100%_67%,100%_100%,0_100%)]" />
        <div className="absolute inset-x-[-8%] bottom-[-27%] h-[62%] bg-[#183f42]/95 [clip-path:polygon(0_62%,13%_39%,26%_58%,40%_25%,55%_52%,70%_30%,84%_58%,100%_37%,100%_100%,0_100%)]" />
      </div>

      {background && (
        <div
          className={`absolute inset-0 bg-cover bg-center transition-opacity duration-700 ${backgroundVisible ? "opacity-100" : "opacity-0"}`}
          style={{ backgroundImage: `url(${background})` }}
        />
      )}

      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(0,32,64,.70),rgba(0,59,112,.35),rgba(3,25,45,.68))]" />
      <div className="absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(90deg,#003b70_0_20%,#0b8f58_20%_40%,#f2b705_40%_60%,#d92d3a_60%_80%,#00a8d6_80%_100%)]" />

      <section className="relative z-10 w-full max-w-[500px] overflow-hidden rounded-[2rem] border border-white/70 bg-white/95 shadow-[0_30px_100px_rgba(0,0,0,0.34)] backdrop-blur-xl">
        <div className="h-1.5 bg-[linear-gradient(90deg,#003b70,#0b8f58,#f2b705,#d92d3a,#00a8d6)]" />
        <div className="px-7 py-9 sm:px-12 sm:py-11">
          <div className="text-center">
            <img src={LOGO_AGSUS} alt="AgSUS" className="mx-auto h-20 w-20 object-contain" />
            <p className="mt-6 text-xs font-black uppercase tracking-[0.22em] text-[#0b8f58]">Acesso institucional</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-[#003b70] sm:text-[2.15rem]">Plataforma de Pesquisas e Avaliações</h1>
            <p className="mx-auto mt-4 max-w-sm text-[15px] leading-7 text-slate-600">Entre com sua conta Google corporativa. As pesquisas exibidas dependem das autorizações do seu perfil.</p>
          </div>

          <button type="button" onClick={signInWithGoogle} disabled={loading} className="mt-8 flex w-full items-center justify-center gap-3 rounded-2xl bg-[#003b70] px-5 py-4 font-black text-white shadow-lg shadow-blue-950/20 transition hover:-translate-y-0.5 hover:bg-[#075ea8] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-lg font-black text-[#4285f4]">G</span>
            {loading ? "Abrindo conta Google..." : "Entrar com Google institucional"}
          </button>

          {message && <div role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold leading-6 text-red-800">{message}</div>}
          <p className="mt-7 text-center text-xs leading-5 text-slate-500">Acesso permitido somente para contas <strong>@agenciasus.org.br</strong>.</p>
        </div>
        <footer className="border-t border-slate-100 bg-slate-50/90 px-6 py-4 text-center text-xs font-bold text-slate-500">Agência Brasileira de Apoio à Gestão do SUS</footer>
      </section>

      <span className="absolute bottom-4 right-5 z-10 rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-[10px] font-semibold tracking-wide text-white/80 backdrop-blur-md">Imagem de fundo ilustrativa</span>
    </main>
  );
}
