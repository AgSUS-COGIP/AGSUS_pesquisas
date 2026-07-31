"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const LOGO_AGSUS = "https://i.postimg.cc/7PztC6jq/79255fad-06f0-4963-81f5-1fa4a116475e.png";
const OFFICIAL_SITE_URL = "https://agsus-pesquisas-nu.vercel.app";

const BACKGROUNDS = [
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=2200&q=88",
  "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=2200&q=88",
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=2200&q=88",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=2200&q=88",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=2200&q=88",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=2200&q=88",
];

function normalizeSiteUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  return trimmed.startsWith("http://") || trimmed.startsWith("https://")
    ? trimmed
    : `https://${trimmed}`;
}

function getCallbackBaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return normalizeSiteUrl(configuredUrl || OFFICIAL_SITE_URL);
}

function shuffledBackgrounds() {
  return [...BACKGROUNDS].sort(() => Math.random() - 0.5);
}

function preloadFirstAvailable(urls: string[]) {
  return new Promise<string | null>((resolve) => {
    const tryNext = (index: number) => {
      if (index >= urls.length) {
        resolve(null);
        return;
      }

      const image = new Image();
      const timeout = window.setTimeout(() => {
        image.src = "";
        tryNext(index + 1);
      }, 7000);

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

  useEffect(() => {
    let active = true;

    void preloadFirstAvailable(shuffledBackgrounds()).then((loadedBackground) => {
      if (active && loadedBackground) setBackground(loadedBackground);
    });

    const checkSession = async () => {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase.auth.getUser();
      if (data.user) window.location.replace("/area");
    };

    void checkSession();

    return () => {
      active = false;
    };
  }, []);

  async function signInWithGoogle() {
    setLoading(true);
    setMessage("");

    try {
      const supabase = createBrowserSupabaseClient();
      const redirectTo = `${getCallbackBaseUrl()}/auth/confirm?next=/area`;
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[linear-gradient(135deg,#082b4b,#0a527d,#0d6f76)] px-5 py-10 text-[#10243e]">
      {background && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-0 transition-opacity duration-700 animate-[fadeIn_.7s_ease-out_forwards]"
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
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-2xl bg-[#003b70] px-5 py-4 font-black text-white shadow-lg shadow-blue-950/20 transition hover:-translate-y-0.5 hover:bg-[#075ea8] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-lg font-black text-[#4285f4]">G</span>
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

        <footer className="border-t border-slate-100 bg-slate-50/90 px-6 py-4 text-center text-xs font-bold text-slate-500">
          Agência Brasileira de Apoio à Gestão do SUS
        </footer>
      </section>

      <span className="absolute bottom-4 right-5 z-10 rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-[10px] font-semibold tracking-wide text-white/80 backdrop-blur-md">
        Imagem de fundo ilustrativa
      </span>
    </main>
  );
}
