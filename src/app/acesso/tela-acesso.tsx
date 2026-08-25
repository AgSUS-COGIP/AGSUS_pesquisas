"use client";

import { Hourglass, ShieldCheck, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { safeAuthNext } from "@/lib/auth-callback";
import { needsLightForeground } from "@/lib/color-contrast";
import { abrirJanelaDeLogin, LOGIN_POPUP_LANDING, LOGIN_POPUP_MESSAGE, suportaJanelaDeLogin } from "@/lib/login-popup";
import { accessErrorMessage, authDestinationWithEntering, loginPopupDecision } from "@/lib/login-transition";
import { createBrowserSupabaseClient, isBrowserSupabaseConfigured } from "@/lib/supabase/client";
import { ExternalImage } from "@/components/external-image";
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

/**
 * A palavra gravada dentro dos arquivos de assinatura do SIGAV.
 *
 * Não é o nome configurado da plataforma, e a diferença importa: `productName`
 * vem do banco e pode ser trocado em `/admin/configuracoes`, enquanto isto está
 * desenhado no SVG e só muda com arte nova. Serve de texto alternativo da
 * imagem, que precisa descrever o que ela mostra.
 *
 * **Se a marca for redesenhada com outra palavra, mude aqui junto** — divergir
 * faz a tela anunciar para leitor de tela um nome que ninguém vê.
 */
const NOME_DESENHADO_NA_ASSINATURA = "SIGAV";

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
  const router = useRouter();
  const supabaseConfigured = isBrowserSupabaseConfigured();
  const signInPendingRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  // Muda o que a tela diz enquanto espera: com janela separada ninguém é levado
  // a lugar nenhum, e prometer isso confundiria quem está vendo a janela abrir.
  const [usandoJanela, setUsandoJanela] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setMessage(accessErrorMessage(query.get("erro")));
  }, []);

  /** Volta o botão ao normal — usado quando a janela fecha sem concluir. */
  function resetSignIn(mensagem = "") {
    signInPendingRef.current = false;
    setLoading(false);
    setUsandoJanela(false);
    if (mensagem) setMessage(mensagem);
  }

  /**
   * Acompanha a janela de login até haver sessão, falhar ou ser fechada.
   *
   * **A tela não espera um recado — ela olha se já existe sessão.** A primeira
   * versão dependia de a janela avisar por `postMessage`, e isso tem meia dúzia
   * de formas de não acontecer: o vínculo entre as janelas pode ser cortado por
   * política do navegador, o `window.close()` pode ser recusado, a janela pode
   * ficar aberta na página final. Quando o recado não chegava, a tela de trás
   * ficava presa em "Entrando…" com a sessão já criada — que foi exatamente o
   * defeito observado.
   *
   * Perguntar "há sessão?" não tem esse problema: é o estado real, gravado em
   * cookie do mesmo domínio, visível para as duas janelas. O recado continua
   * sendo ouvido, mas só para encurtar a espera — nunca como única saída.
   */
  function acompanharJanela(janela: Window, destino: string) {
    const supabase = createBrowserSupabaseClient();
    let encerrado = false;
    let verificando = false;

    const encerrar = () => {
      encerrado = true;
      window.removeEventListener("message", aoReceber);
      window.clearInterval(vigia);
    };

    const concluir = () => {
      if (encerrado) return;
      encerrar();
      if (!janela.closed) janela.close();
      // O callback SSR já gravou os cookies e `getSession()` os confirmou nesta
      // origem. A navegação privada pode seguir pelo App Router sem recarregar a
      // aplicação inteira; não há prefetch anterior nem necessidade de refresh.
      router.replace(authDestinationWithEntering(destino));
    };

    const verificar = async () => {
      if (encerrado || verificando) return;
      verificando = true;

      try {
        // `getSession()` lê o cookie compartilhado com o callback, sem uma nova
        // ida ao Auth server. A navegação só ocorre depois desta confirmação.
        const { data } = await supabase.auth.getSession();
        let popupHref: string | null = null;

        if (!janela.closed) {
          try {
            popupHref = janela.location.href;
          } catch {
            // Enquanto está no Google, o endereço é de outra origem.
          }
        }

        const decision = loginPopupDecision({
          hasSession: Boolean(data.session),
          popupClosed: janela.closed,
          popupHref,
          currentOrigin: window.location.origin,
        });

        if (decision.state === "complete") concluir();
        else if (decision.state === "cancelled") { encerrar(); resetSignIn(); }
        else if (decision.state === "error") { encerrar(); janela.close(); resetSignIn(decision.message); }
      } catch {
        // Uma falha inesperada ao ler o cookie não pode deixar uma rejeição
        // solta nem o botão travado depois que a janela já foi fechada.
        if (janela.closed && !encerrado) {
          encerrar();
          resetSignIn("Não foi possível confirmar a sessão. Tente novamente.");
        }
      } finally {
        verificando = false;
      }
    };

    // Atalho, não dependência: quando o recado chega, a espera acaba antes.
    const aoReceber = (evento: MessageEvent) => {
      if (evento.origin !== window.location.origin) return;
      if ((evento.data as { type?: string } | null)?.type !== LOGIN_POPUP_MESSAGE) return;
      void verificar();
    };
    window.addEventListener("message", aoReceber);

    const vigia = window.setInterval(() => {
      void verificar();
    }, 600);
  }

  async function signInWithGoogle() {
    if (signInPendingRef.current || !supabaseConfigured) return;

    signInPendingRef.current = true;
    setLoading(true);
    setMessage("");

    const query = new URLSearchParams(window.location.search);
    const destino = safeAuthNext(query.get("next"));

    /*
      A janela é aberta **antes** de qualquer `await`: depois de uma espera o
      navegador já não associa a abertura ao clique e a bloqueia. Vazia agora,
      apontada para o Google assim que a URL chegar.

      Se voltar nula — bloqueador, política do navegador, tela pequena —, o
      fluxo segue pelo redirecionamento de página inteira, que é como sempre
      funcionou.
    */
    const janela = suportaJanelaDeLogin() ? abrirJanelaDeLogin() : null;

    try {
      const callbackUrl = new URL("/auth/confirm", window.location.origin);
      // Em janela separada o callback termina numa página que avisa e fecha;
      // sem ela, termina direto no destino, como antes.
      callbackUrl.searchParams.set("next", janela ? LOGIN_POPUP_LANDING : destino);

      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl.toString(),
          // Com janela, a navegação é nossa: o Supabase devolve a URL em vez de
          // levar a página inteira para o Google.
          skipBrowserRedirect: Boolean(janela),
          queryParams: {
            prompt: "select_account",
            hd: "agenciasus.org.br",
          },
        },
      });

      if (error) throw error;

      if (janela) {
        if (!data?.url) throw new Error("Não foi possível iniciar o acesso com Google.");
        janela.location.href = data.url;
        setUsandoJanela(true);
        acompanharJanela(janela, destino);
      }
    } catch (error) {
      janela?.close();
      resetSignIn(error instanceof Error ? error.message : "Não foi possível iniciar o acesso com Google.");
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
      Arte no fundo da janela inteira, cartão de acesso flutuando sobre ela.

      Por que deixou de ser duas colunas
      ----------------------------------
      A arte institucional é 1920×1080 — uma composição 16:9, com a fita, o
      título e a frase distribuídos na horizontal. Numa coluna alta e estreita,
      `bg-cover` recortava as laterais e cortava justamente o texto: "MÊS DE
      CONSCIENTIZAÇÃO…" saía pela borda. Isso **não** se resolve estreitando a
      coluna do formulário: a altura continua a mesma, então a proporção
      continua errada. Para a arte caber inteira numa coluna de 950px de altura
      seriam necessários 1689px de largura, sobrando 231px para o login — menos
      do que o botão precisa.

      Cobrindo a janela, a proporção do contêiner passa a ser a da própria
      janela (1920×950 ≈ 2:1), muito mais perto de 16:9 do que a coluna era, e o
      recorte cai para quase nada.

      O fundo é `fixed`, e isso resolve o zoom de vez
      ----------------------------------------------
      Antes a arte vivia numa coluna do grid, então participava do fluxo e se
      deslocava a cada nível de zoom — era a queixa original de que "a imagem se
      mexe". Ancorada na janela, ela cobre a viewport em qualquer zoom, e o zoom
      passa a alterar só o tamanho do cartão. **Não devolva a arte para dentro
      do fluxo.**

      Sem véu sobre a arte
      --------------------
      Houve aqui um `bg-slate-950/25` cobrindo a imagem, posto por precaução
      contra arte clara demais atrás do texto. Ele foi removido: **o cartão é
      opaco** — tem a cor de painel configurada, ou branco — e é ele que
      sustenta a legibilidade, não o escurecimento do fundo. O véu não protegia
      nada e apagava a campanha institucional, que é justamente o que a tela
      deveria destacar.

      Se algum dia o texto voltar a ficar sobre a arte, sem cartão atrás, aí o
      véu passa a ser necessário de novo — mas então ele protege alguma coisa.

      No celular a arte agora aparece, o que antes era impossível: ela não
      empurra mais nada, porque o cartão flutua por cima em vez de ficar
      empilhado abaixo dela.
    */
    <main className="relative grid min-h-screen place-items-center px-4 py-8 sm:px-6 sm:py-10 lg:place-items-start lg:px-12 xl:px-16">
      {/*
        Sem `z-index` negativo aqui, de propósito. `html` e `body` têm
        `background: var(--surface-page)` em globals.css, e camada com z-index
        negativo é pintada **antes** do fundo de um bloco em fluxo — a arte
        ficaria atrás do fundo do body, invisível, sem nenhum erro no console.
        A ordem de pintura basta: estes dois vêm antes no DOM e o cartão é
        posicionado (`relative`), então ele sobe sozinho.
      */}
      <div
        className="fixed inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${branding.accessBackgroundUrl ?? BACKGROUND_IMAGE})` }}
        aria-hidden="true"
      />
      {/*
        Escala do cartão por faixa de tela.

          celular        w-full, dentro do px-4 do container
          ≥ 640px        teto de 32rem (512px) — cartão centralizado, sem arte atrás
          ≥ 1024px       teto de 28rem, **limitado a 34vw**
          ≥ 1536px       teto de 32rem, limitado a 30vw

        A partir de `lg` o cartão passa a flutuar sobre a arte, e aí o teto
        absoluto deixa de bastar. **O texto da campanha começa a 38,5% da
        largura da imagem**, e como a arte preenche a janela inteira essa fração
        vale em qualquer tela. Um cartão de largura fixa ocupa uma fração cada
        vez maior conforme a tela encolhe: em 1920 ele termina em 33% e não
        encosta; em 1360, nos mesmos 512px, termina em 41% e cobre o começo de
        "MÊS DE CONSCIENTIZAÇÃO". O teto em `vw` faz ele encolher junto com a
        tela e parar antes do texto.

        Abaixo de ~1000px a sobreposição volta a ser inevitável: o cartão
        precisa de largura mínima para o botão caber, e o texto da arte continua
        onde está. Nessa faixa a arte é fundo, e o cartão tem precedência.

        A largura é `w-full` com teto, e não uma medida fixa: em tela estreita
        ele ocupa o que houver, e o teto só passa a valer quando sobra espaço.
        O respiro interno cresce junto — apertado no celular, folgado no
        desktop — porque manter `px-10` num aparelho de 360px comeria metade da
        largura útil.

        O `py` do container é menor que o antigo `py-10` em telas curtas: com
        `min-h-screen` e centralização, cartão mais alto que a janela empurra o
        topo para fora, e a margem vertical piora isso antes de ajudar.
      */}
      <section
        className="relative w-full max-w-lg rounded-2xl px-5 py-7 shadow-2xl shadow-slate-950/20 ring-1 ring-white/25 backdrop-blur-sm sm:rounded-3xl sm:px-8 sm:py-9 lg:max-w-[min(28rem,34vw)] lg:px-8 lg:py-9 lg:my-auto xl:px-10 2xl:max-w-[min(32rem,30vw)]"
        style={{ backgroundColor: panelColor ?? "#ffffff" }}
      >
        {/* Conteúdo centralizado: o logotipo já vinha centralizado e o texto
            alinhado à esquerda deixava o conjunto desequilibrado. */}
        <div className="text-center">
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
          {/*
            Assinatura conjunta: a cruz da AgSUS e a marca do SIGAV lado a lado,
            separadas por filete. É o arranjo que o SIGEPSI usa, e ele diz uma
            coisa que a cruz sozinha não dizia: **de quem é o sistema e qual
            sistema é**. Antes só a instituição aparecia, e o nome do produto
            ficava na linha de texto abaixo, com o mesmo peso de um subtítulo.

            O filete é `aria-hidden`: ele separa visualmente, e para quem usa
            leitor de tela as duas marcas já são anunciadas pelos respectivos
            textos alternativos.
          */}
          {/*
            O bloco das marcas é o que aperta primeiro em tela estreita: são
            dois logotipos e um filete numa linha só. Por isso ele encolhe em
            três degraus e pode **quebrar linha** — em aparelho de 320px as duas
            marcas empilham em vez de espremer, e o filete some junto, porque
            separador horizontal entre itens empilhados não separa nada.
          */}
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-4 sm:gap-x-4">
            <div
              className="flex flex-col items-center gap-1.5"
              style={lightOnPanel ? { filter: "brightness(0) invert(1)" } : undefined}
            >
              <PlatformLogo
                src={LOGO_INSTITUCIONAL_DATA_URI}
                alt="AgSUS"
                organizationName="AgSUS"
                width={112}
                height={112}
                priority
                className="h-10 w-10 object-contain text-sm sm:h-12 sm:w-12 sm:text-base lg:h-14 lg:w-14"
              />
              <span className={`text-base font-black leading-none tracking-tight sm:text-lg lg:text-xl ${lightOnPanel ? "text-white" : "text-[#003b70]"}`}>
                {branding.organizationName}
              </span>
            </div>

            <span
              className={`hidden h-12 w-px shrink-0 sm:block sm:h-14 lg:h-16 ${lightOnPanel ? "bg-white/35" : "bg-[#003b70]/20"}`}
              aria-hidden="true"
            />

            {/*
              A assinatura horizontal — símbolo mais palavra no mesmo arquivo —
              é a versão aprovada da marca. Por isso não há rótulo de texto ao
              lado dela: o nome já está dentro do SVG, e repeti-lo em HTML
              escreveria "SIGAV SIGAV".

              Ela também não recebe o filtro que achata a cruz em branco sobre
              painel escuro: tem degradê próprio, e achatá-la apagaria a
              transição azul→verde que a distingue. Por isso a troca é de
              **arquivo**, não de filtro — a versão negativa tem a mesma arte
              com a palavra em branco, do jeito que manual de identidade faz.

              Sem isso, o "SIGAV" em azul institucional sumiria sobre painel
              escuro enquanto o "AgSUS" ao lado apareceria em branco, deixando
              metade da assinatura invisível.

              **O texto alternativo descreve o desenho, não a configuração.**
              Ele já usou `branding.productName`, e o resultado foi a tela dizer
              duas coisas diferentes ao mesmo tempo: o SVG desenha "SIGAV" e o
              nome configurado no banco era "Avaliações", então quem enxergava
              lia SIGAV e quem usava leitor de tela ouvia Avaliações. Texto
              alternativo existe para dar, a quem não vê a imagem, o mesmo que
              ela mostra — e o que ela mostra está gravado no arquivo.

              É a mesma regra que o lado da AgSUS já seguia: a cruz tem
              `alt="AgSUS"` fixo, e é o texto ao lado dela que sai da marca
              configurada.

              A consequência é que a assinatura só vale enquanto o produto se
              chamar SIGAV. Renomear exige arte nova — trocar o nome em
              /admin/configuracoes não redesenha o SVG, e nenhum `alt` dinâmico
              resolveria isso; apenas esconderia a divergência de quem não vê a
              tela.
            */}
            <ExternalImage
              src={lightOnPanel ? "/sigav-assinatura-negativa.svg" : "/sigav-assinatura.svg"}
              alt={NOME_DESENHADO_NA_ASSINATURA}
              width={300}
              height={96}
              priority
              className="h-10 w-auto max-w-full object-contain sm:h-12 lg:h-14"
            />
          </div>

          {/*
            Texto institucional, não de boas-vindas: o título nomeia o sistema em
            vez de saudar, porque quem chega aqui está entrando para trabalhar e
            só precisa confirmar que é a plataforma certa.

            Uma linha basta. A instrução de entrar com conta corporativa já
            aparece **duas vezes** logo abaixo — no rótulo do botão e na nota de
            acesso seguro. Repeti-la aqui era texto que ninguém lê.

          {/*
            A expansão da sigla, e não uma descrição livre. Sigla sozinha só
            comunica para quem já a conhece — e este é o primeiro contato de
            quem chega. É o mesmo recurso que o SIGEPSI usa logo abaixo do
            logotipo, e é a única identificação do sistema no celular, onde a
            arte não é exibida.

            **Sem o prefixo da sigla.** A linha já chegou a ser
            "SIGAV — Sistema Integrado de…", à maneira do SIGEPSI. Só que a
            assinatura logo acima já mostra a palavra SIGAV desenhada, então o
            prefixo a repetia a três centímetros de distância. Pior: o nome vem
            do banco e a expansão vem do código, então enquanto os dois
            divergirem a linha lê "Avaliações — Sistema Integrado de Gestão de
            Avaliações". Sem o prefixo, ela diz uma coisa só e não depende de
            configuração nenhuma para fazer sentido.

            **Ainda não é configurável, e isso é uma dívida conhecida.** O nome
            do produto sai de `/admin/configuracoes`, mas a expansão vem de
            `DEFAULT_PLATFORM_BRANDING`: quem trocar a sigla no banco verá a
            sigla nova com a expansão antiga. Levar a expansão para o banco
            exige acrescentar parâmetro a `fc_atualizar_marca_plataforma`, o que
            cria uma sobrecarga nova e esbarra na regra de publicar o frontend
            antes de mexer na RPC (ver CLAUDE.md da raiz). Fica para a rodada de
            personalização, junto com os demais campos.
          */}
          <p className={`mt-4 text-[13px] font-bold leading-5 ${lightOnPanel ? "text-white/90" : "text-[#003b70]"}`}>
            {branding.productDescription}
          </p>

          {/*
            Saudação e instrução saem da marca configurada desde
            `20260817160000`. Antes estavam escritas aqui, e mudar a recepção de
            quem entra na plataforma exigia deploy. Campo vazio no banco cai no
            padrão: a tela de entrada nunca fica sem título.

            O texto é saudação, e não o nome do sistema repetido. O nome já
            aparece duas vezes acima — na assinatura e na expansão —, então
            usá-lo aqui pela terceira vez gastaria a linha de maior destaque do
            cartão para não dizer nada novo. É a mesma escolha do SIGEPSI, que reserva
            este lugar para receber a pessoa.
          */}
          <h1 className={`mt-5 text-xl font-black tracking-tight lg:text-2xl ${lightOnPanel ? "text-white" : "text-[#003b70]"}`}>
            {branding.accessGreeting}
          </h1>
          <p className={`mt-1.5 text-sm leading-6 ${lightOnPanel ? "text-white/80" : "text-slate-600"}`}>
            {branding.accessInstruction}
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
              {usandoJanela
                ? "Escolha sua conta na janela que abriu. Esta tela continua aqui."
                : "Você será levado à tela de seleção de conta do Google."}
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

          {/*
            Rodapé único: o escudo e a assinatura institucional numa linha só.

            Saiu daqui a frase "Acesso seguro, exclusivo para contas
            @agenciasus.org.br". Ela dizia pela terceira vez o que o rótulo do
            botão já diz — "Entrar com Google institucional" —, e a restrição de
            domínio é aplicada pelo `hd` do OAuth e pelo banco, não por aviso na
            tela. Quem tenta com conta de fora recebe o erro no lugar certo, que
            é depois de tentar.

            O `id` permanece: o botão o referencia por `aria-describedby`, então
            remover o elemento deixaria a referência apontando para o vazio —
            leitor de tela anuncia o botão sem a descrição, sem erro visível.
            O escudo é decorativo e segue `aria-hidden`; quem descreve o
            elemento é o texto.
          */}
          <p
            id="access-help"
            className={`mt-8 flex items-center justify-center gap-2 border-t pt-4 text-xs leading-5 lg:mt-10 lg:pt-5 ${lightOnPanel ? "border-white/20 text-white/70" : "border-slate-200 text-slate-500"}`}
          >
            <ShieldCheck className={`h-4 w-4 shrink-0 ${lightOnPanel ? "text-emerald-300" : "text-[#0b8f58]"}`} aria-hidden="true" />
            <span>Agência Brasileira de Apoio à Gestão do SUS</span>
          </p>
        </div>
      </section>
    </main>
  );
}
