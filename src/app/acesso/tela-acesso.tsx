"use client";

import { Hourglass, ShieldCheck, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { safeAuthNext } from "@/lib/auth-callback";
import { needsLightForeground } from "@/lib/color-contrast";
import { createBrowserSupabaseClient, isBrowserSupabaseConfigured } from "@/lib/supabase/client";
import { PlatformLogo } from "@/components/platform-logo";
import type { PlatformBranding } from "@/lib/platform-branding";
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

export default function AccessPage({ initialBranding }: { initialBranding: PlatformBranding }) {
  /*
   * A marca vem resolvida do servidor (`page.tsx`) e é usada como está, sem
   * esperar o provedor do cliente.
   *
   * O provedor só responde depois da primeira pintura: até lá valia o padrão, e
   * a tela abria com a arte institucional para trocar pela configurada em
   * seguida. O piscar era curto, mas dava a impressão de que a configuração não
   * tinha pegado — e esta é a primeira tela que qualquer pessoa vê.
   */
  const branding = initialBranding;
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

      As duas colunas começam em `md` (768px), não em `lg`. Entre 768 e 1023 a
      arte ficava escondida e o painel ocupava a largura inteira com uma coluna
      de 384px perdida no meio — muito vazio dos dois lados, que é o que dava
      aparência de tela inacabada em tablet e notebook estreito. Nessa faixa as
      metades são iguais; a partir de `lg` o formulário passa a ter largura fixa
      e a arte fica com o resto.

      Abaixo de `md` a arte some de propósito: em celular ela empurraria o botão
      de entrar para fora da primeira dobra, e entrar é a única coisa que a
      pessoa precisa fazer aqui.
    */
    <main className="grid min-h-screen bg-white md:grid-cols-2 lg:grid-cols-[minmax(0,460px)_1fr]">
      <section
        className="flex flex-col justify-center px-6 py-8 sm:px-10 lg:px-12 lg:py-10"
        style={panelColor ? { backgroundColor: panelColor } : undefined}
      >
        {/* Coluna centralizada: o logotipo já vinha centralizado e o texto
            alinhado à esquerda deixava o conjunto desequilibrado. */}
        <div className="mx-auto w-full max-w-sm text-center">
          {/*
            Tela pública: logotipo institucional embutido (data URI). Renderiza
            junto com a página, sem requisição de rede e sem "piscar" na abertura.

            Sobre painel escuro o logotipo é renderizado em branco sólido, por
            decisão do produto — acompanha o contraste como o texto e o botão.
            `brightness(0)` achata o desenho para preto e `invert(1)` o leva a
            branco: o resultado é a silhueta em branco puro, previsível em
            qualquer cor de painel, e não um clareamento que variaria conforme o
            fundo escolhido.

            Fica o registro de que isso altera as cores da marca. Se a
            identidade visual passar a exigir as cores originais, a alternativa
            é o quadrado branco atrás do logotipo — o mesmo recurso que a barra
            lateral escura usa.
          */}
          {/*
            O filtro vai em `style`, não em classe utilitária arbitrária: o
            Tailwind gerou `filter:brightness(0)invert()` para
            `[filter:brightness(0)_invert(1)]` — sem o espaço entre as funções e
            sem o argumento, o que é CSS inválido e simplesmente não aplicava.
          */}
          <div
            className="mx-auto w-fit"
            style={lightOnPanel ? { filter: "brightness(0) invert(1)" } : undefined}
          >
            <PlatformLogo
              src={LOGO_INSTITUCIONAL_DATA_URI}
              alt="AgSUS"
              organizationName="AgSUS"
              width={112}
              height={112}
              priority
              className="h-20 w-20 object-contain text-xl lg:h-28 lg:w-28 lg:text-2xl"
            />
          </div>

          {/*
            Texto institucional, não de boas-vindas: o título nomeia o sistema em
            vez de saudar, porque quem chega aqui está entrando para trabalhar e
            só precisa confirmar que é a plataforma certa.

            Uma linha basta. A instrução de entrar com conta corporativa já
            aparece **duas vezes** logo abaixo — no rótulo do botão e na nota de
            acesso seguro. Repeti-la aqui era texto que ninguém lê.

            Título e nome do sistema vêm da marca configurada, não de texto fixo:
            trocar o nome do produto em /admin/configuracoes precisa valer aqui.
          */}
          <p className={`mt-6 text-xs font-semibold uppercase tracking-[.22em] lg:mt-8 ${lightOnPanel ? "text-emerald-300" : "text-[#0b8f58]"}`}>Acesso institucional</p>
          <h1 className={`mt-2 text-2xl font-semibold tracking-tight lg:text-[1.75rem] ${lightOnPanel ? "text-white" : "text-[#003b70]"}`}>
            {branding.organizationName} {branding.productName}
          </h1>
          <p className={`mt-3 text-sm leading-6 lg:text-[15px] lg:leading-7 ${lightOnPanel ? "text-white/80" : "text-slate-600"}`}>
            Plataforma institucional de pesquisas e avaliações.
          </p>

          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={loading || blocked}
            aria-describedby="access-help"
            title={blocked ? "A configuração deste ambiente ainda não foi concluída" : "Abrir a seleção de conta do Google"}
            className={`mt-6 flex min-h-12 w-full items-center justify-center gap-3 rounded-xl px-5 text-sm lg:mt-8 lg:min-h-14 lg:text-base font-semibold shadow-lg transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-300/40 disabled:cursor-not-allowed disabled:opacity-60 ${lightOnPanel ? "bg-white text-[#003b70] hover:bg-slate-100" : "bg-[#003b70] text-white shadow-blue-950/20 hover:bg-[#075ea8]"}`}
          >
            {loading
              ? <Hourglass className="h-5 w-5 animate-pulse" aria-hidden="true" />
              : <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-lg font-bold text-[#4285f4]" aria-hidden="true">G</span>}
            {loading ? "Entrando no sistema..." : "Entrar com Google institucional"}
          </button>

          {loading && (
            <p role="status" className={`mt-3 text-center text-xs leading-5 ${lightOnPanel ? "text-white/70" : "text-slate-500"}`}>
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

          <p id="access-help" className={`mt-5 flex items-center justify-center gap-2 text-xs leading-5 lg:mt-7 ${lightOnPanel ? "text-white/70" : "text-slate-500"}`}>
            {/* O escudo fica solto sobre o painel, sem fundo próprio — diferente
                dos alertas e do círculo do "G", que carregam o contraste
                consigo. Por isso ele acompanha, e eles não precisam. */}
            <ShieldCheck className={`h-4 w-4 shrink-0 ${lightOnPanel ? "text-emerald-300" : "text-[#0b8f58]"}`} aria-hidden="true" />
            <span>Acesso seguro, exclusivo para contas <strong className="font-semibold">@agenciasus.org.br</strong>.</span>
          </p>

          <p className={`mt-8 border-t pt-4 text-xs lg:mt-10 lg:pt-5 ${lightOnPanel ? "border-white/20 text-white/70" : "border-slate-200 text-slate-500"}`}>
            Agência Brasileira de Apoio à Gestão do SUS
          </p>
        </div>
      </section>

      <aside className="relative hidden md:block" aria-hidden="true">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${branding.accessBackgroundUrl ?? BACKGROUND_IMAGE})` }}
        />
      </aside>
    </main>
  );
}
