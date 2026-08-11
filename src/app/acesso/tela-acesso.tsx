"use client";

import { Hourglass, ShieldCheck, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { safeAuthNext } from "@/lib/auth-callback";
import { createBrowserSupabaseClient, isBrowserSupabaseConfigured } from "@/lib/supabase/client";
import { PlatformLogo } from "@/components/platform-logo";
import { usePlatformBranding } from "@/components/platform-branding-provider";
import { LOGO_INSTITUCIONAL_DATA_URI } from "./logo-institucional";
// Imagem de fundo institucional fixa, servida localmente de `public/`. Substituiu
// o sorteio de fotos externas (Unsplash via `/api/background/*`): a tela sempre
// "nasce" com a mesma arte, sem troca e sem dependência de serviço externo.
const BACKGROUND_IMAGE = "/acesso-fundo.png";

function accessErrorMessage(code: string | null) {
  if (code === "dominio-nao-autorizado") return "O acesso é exclusivo para contas @agenciasus.org.br. Selecione sua conta institucional.";
  if (code === "oauth-invalido") return "A autenticação não foi concluída. Selecione novamente sua conta institucional.";
  return "";
}

export default function AccessPage() {
  const { branding } = usePlatformBranding();
  const supabaseConfigured = isBrowserSupabaseConfigured();
  const signInPendingRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams(window.location.search);
    setMessage(accessErrorMessage(query.get("erro")));

    void (async () => {
      if (!supabaseConfigured) return;
      try {
        const supabase = createBrowserSupabaseClient();
        const { data } = await supabase.auth.getUser();
        if (data.user) window.location.replace(safeAuthNext(query.get("next")));
      } catch {
        if (active) setMessage("Não foi possível verificar a sessão atual.");
      }
    })();

    return () => {
      active = false;
    };
  }, [supabaseConfigured]);

  async function signInWithGoogle() {
    if (signInPendingRef.current || !supabaseConfigured) return;

    signInPendingRef.current = true;
    setLoading(true);
    setMessage("");

    try {
      const query = new URLSearchParams(window.location.search);
      const callbackUrl = new URL("/auth/confirm", window.location.origin);
      callbackUrl.searchParams.set("next", safeAuthNext(query.get("next")));

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
      signInPendingRef.current = false;
      setMessage(error instanceof Error ? error.message : "Não foi possível iniciar o acesso com Google.");
      setLoading(false);
    }
  }

  const blocked = !supabaseConfigured;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0d2a45] px-5 py-10">
      {/* Arte institucional fixa. A camada de gradiente acima dela existe para
          garantir contraste do cartão em qualquer ponto da imagem. */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${BACKGROUND_IMAGE})` }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-[linear-gradient(135deg,rgba(0,32,64,.72),rgba(0,59,112,.38),rgba(3,25,45,.70))]"
        aria-hidden="true"
      />

      <section className="relative z-10 w-full max-w-[500px] overflow-hidden rounded-[1.75rem] border border-white/60 bg-white/95 shadow-[0_30px_100px_rgba(0,0,0,.34)] backdrop-blur-xl">
        <div className="h-1.5 bg-[linear-gradient(90deg,#003b70,#0b8f58,#f2b705,#d92d3a,#00a8d6)]" aria-hidden="true" />
        <div className="px-7 py-9 sm:px-12 sm:py-11">
          <div className="text-center">
            {/* Tela pública: logotipo institucional embutido (data URI). Renderiza junto
                com a página, sem requisição de rede e sem "piscar" na abertura. */}
            <PlatformLogo src={LOGO_INSTITUCIONAL_DATA_URI} alt="AgSUS" organizationName="AgSUS" width={80} height={80} priority className="mx-auto h-20 w-20 object-contain text-xl" />
            <p className="mt-6 text-xs font-semibold uppercase tracking-[.22em] text-[#0b8f58]">Acesso institucional</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#003b70] sm:text-[2.15rem]">{branding.productName}</h1>
            <p className="mx-auto mt-4 max-w-sm text-[15px] leading-7 text-slate-600">
              Entre com sua conta Google corporativa. O que você verá depois depende das autorizações do seu perfil.
            </p>
          </div>

          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={loading || blocked}
            aria-describedby="access-help"
            title={blocked ? "A configuração deste ambiente ainda não foi concluída" : "Abrir a seleção de conta do Google"}
            className="mt-8 flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-[#003b70] px-5 text-base font-semibold text-white shadow-lg shadow-blue-950/20 transition hover:bg-[#075ea8] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-300/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? <Hourglass className="h-5 w-5 animate-pulse" aria-hidden="true" />
              : <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-lg font-bold text-[#4285f4]" aria-hidden="true">G</span>}
            {loading ? "Abrindo a conta Google..." : "Entrar com Google institucional"}
          </button>

          {loading && (
            <p role="status" className="mt-3 text-center text-xs leading-5 text-slate-500">
              Você será levado à tela de seleção de conta do Google.
            </p>
          )}

          {blocked ? (
            <div role="alert" className="mt-5 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-left text-sm leading-6 text-amber-900">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <strong className="block font-semibold">Acesso temporariamente indisponível</strong>
                <span>A configuração deste ambiente ainda precisa ser concluída pela equipe técnica. Tente novamente mais tarde.</span>
              </div>
            </div>
          ) : message ? (
            <div role="alert" className="mt-5 flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-left text-sm leading-6 text-red-900">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <span>{message}</span>
            </div>
          ) : null}

          <p id="access-help" className="mt-7 flex items-center justify-center gap-2 text-center text-xs leading-5 text-slate-500">
            <ShieldCheck className="h-4 w-4 shrink-0 text-[#0b8f58]" aria-hidden="true" />
            <span>Acesso seguro, exclusivo para contas <strong className="font-semibold">@agenciasus.org.br</strong>.</span>
          </p>
        </div>
        <footer className="border-t border-slate-200 bg-slate-50/90 px-6 py-4 text-center text-xs font-medium text-slate-500">
          Agência Brasileira de Apoio à Gestão do SUS
        </footer>
      </section>

      <span className="absolute bottom-4 right-5 z-10 rounded-full border border-white/15 bg-black/25 px-3 py-1.5 text-[10px] font-medium tracking-wide text-white/80 backdrop-blur-md">
        Imagem de fundo ilustrativa
      </span>
    </main>
  );
}
