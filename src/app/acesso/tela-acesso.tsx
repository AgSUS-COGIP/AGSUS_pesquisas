"use client";

import { Hourglass, ShieldCheck, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { safeAuthNext } from "@/lib/auth-callback";
import { needsLightForeground } from "@/lib/color-contrast";
import { createBrowserSupabaseClient, isBrowserSupabaseConfigured } from "@/lib/supabase/client";
import { PlatformLogo } from "@/components/platform-logo";
import { usePlatformBranding } from "@/components/platform-branding-provider";
import { LOGO_INSTITUCIONAL_DATA_URI } from "./logo-institucional";
/*
 * Arte padrão da tela de acesso, servida localmente de `public/`.
 *
 * Continua sendo o ponto de partida — e o que aparece enquanto a marca carrega,
 * para a tela não abrir com um retângulo vazio. A administração pode substituí-la
 * em `/admin/configuracoes` para acompanhar campanha institucional; sem
 * substituição configurada, vale esta.
 *
 * O que **não** volta: o sorteio de fotos externas que existia antes
 * (`/api/background/*`). A arte é institucional e local, nunca de terceiro.
 */
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

  /*
   * O painel do formulário pode receber cor da administração. O contraste
   * **não** vem junto: é derivado da luminância da cor escolhida.
   *
   * Sem isso, um painel escuro apagaria o texto e o botão, que são azul-escuro
   * — e quem configurou não veria o problema, só quem não conseguisse entrar.
   */
  const panelColor = branding.accessPanelColor;
  const lightOnPanel = needsLightForeground(panelColor);


  return (
    /*
      Duas colunas: formulário à esquerda, arte à direita — o formato usado nos
      demais sistemas da AgSUS.
      
      A arte fica **oculta abaixo de `lg`** em vez de virar faixa no topo: em
      celular ela empurraria o botão de entrar para fora da primeira dobra, e a
      única coisa que a pessoa precisa fazer nesta tela é entrar.
    */
    <main className="grid min-h-screen bg-white lg:grid-cols-[minmax(0,460px)_1fr]">
      <section
        className="flex flex-col justify-center px-6 py-10 sm:px-12"
        style={panelColor ? { backgroundColor: panelColor } : undefined}
      >
        <div className="mx-auto w-full max-w-sm">
          {/* Tela pública: logotipo institucional embutido (data URI). Renderiza junto
              com a página, sem requisição de rede e sem "piscar" na abertura. */}
          <PlatformLogo
            src={LOGO_INSTITUCIONAL_DATA_URI}
            alt="AgSUS"
            organizationName="AgSUS"
            width={64}
            height={64}
            priority
            className="h-16 w-16 object-contain text-lg"
          />

          <p className={`mt-8 text-xs font-semibold uppercase tracking-[.22em] ${lightOnPanel ? "text-emerald-300" : "text-[#0b8f58]"}`}>Acesso institucional</p>
          <h1 className={`mt-2 text-[1.75rem] font-semibold tracking-tight ${lightOnPanel ? "text-white" : "text-[#003b70]"}`}>
            Seja bem-vindo(a) à AgSUS
          </h1>
          <p className={`mt-3 text-[15px] leading-7 ${lightOnPanel ? "text-white/80" : "text-slate-600"}`}>
            {branding.productName} — entre com sua conta Google corporativa. O que você verá
            depois depende das autorizações do seu perfil.
          </p>

          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={loading || blocked}
            aria-describedby="access-help"
            title={blocked ? "A configuração deste ambiente ainda não foi concluída" : "Abrir a seleção de conta do Google"}
            className={`mt-8 flex min-h-14 w-full items-center justify-center gap-3 rounded-xl px-5 text-base font-semibold shadow-lg transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-300/40 disabled:cursor-not-allowed disabled:opacity-60 ${lightOnPanel ? "bg-white text-[#003b70] hover:bg-slate-100" : "bg-[#003b70] text-white shadow-blue-950/20 hover:bg-[#075ea8]"}`}
          >
            {loading
              ? <Hourglass className="h-5 w-5 animate-pulse" aria-hidden="true" />
              : <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-lg font-bold text-[#4285f4]" aria-hidden="true">G</span>}
            {loading ? "Entrando no sistema..." : "Entrar com Google institucional"}
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

          <p id="access-help" className={`mt-7 flex items-center gap-2 text-xs leading-5 ${lightOnPanel ? "text-white/70" : "text-slate-500"}`}>
            <ShieldCheck className="h-4 w-4 shrink-0 text-[#0b8f58]" aria-hidden="true" />
            <span>Acesso seguro, exclusivo para contas <strong className="font-semibold">@agenciasus.org.br</strong>.</span>
          </p>

          <p className={`mt-10 border-t pt-5 text-xs ${lightOnPanel ? "border-white/20 text-white/70" : "border-slate-200 text-slate-500"}`}>
            Agência Brasileira de Apoio à Gestão do SUS
          </p>
        </div>
      </section>

      <aside className="relative hidden lg:block" aria-hidden="true">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${branding.accessBackgroundUrl ?? BACKGROUND_IMAGE})` }}
        />
        <span className="absolute bottom-4 right-5 rounded-full border border-white/15 bg-black/25 px-3 py-1.5 text-[10px] font-medium tracking-wide text-white/80 backdrop-blur-md">
          Imagem de fundo ilustrativa
        </span>
      </aside>
    </main>
  );
}
