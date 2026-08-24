import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { ERRO_SESSAO_RENOVAVEL, type CodigoDeErroApi, type ErroApi } from "./contratos";

/**
 * Transporte compartilhado dos clientes da API REST.
 *
 * Os clientes (`cliente.ts`, `cliente-pessoas.ts`, …) são divididos por
 * domínio, mas todos falam com a API pelo mesmo `chamar()`: montar a URL, ler o
 * corpo, distinguir erro de dado e traduzir status em mensagem acontece aqui, e
 * não repetido em cada tela. É o que mantém o formato do que trafega declarado
 * num lugar só, em vez de recortado por tela.
 */

/**
 * Erro de chamada à API, com o status HTTP preservado.
 *
 * É pelo status que a tela decide o tratamento: 403 mostra a guarda de acesso,
 * 404 mostra estado vazio, 401 manda entrar de novo — distinção que uma
 * mensagem de erro solta não permite fazer.
 */
export class ErroDeApi extends Error {
  readonly status: number;
  readonly referencia?: string;
  readonly codigo?: CodigoDeErroApi;

  constructor(status: number, mensagem: string, referencia?: string, codigo?: CodigoDeErroApi) {
    super(mensagem);
    this.name = "ErroDeApi";
    this.status = status;
    this.referencia = referencia;
    this.codigo = codigo;
  }

  /**
   * Sessão que uma renovação pode recuperar.
   *
   * É mais estreito do que `exigeAutenticacao`, e a diferença é o ponto: nem
   * todo 401 melhora com um token novo. Assinatura inválida e relógio adiantado
   * continuam falhando depois de renovar, então repetir ali só adiciona uma ida
   * ao servidor antes do mesmo erro.
   */
  get sessaoRenovavel() {
    return this.status === 401 && this.codigo === ERRO_SESSAO_RENOVAVEL;
  }

  /** Sessão expirada — a tela deve mandar a pessoa entrar de novo. */
  get exigeAutenticacao() {
    return this.status === 401;
  }

  /** Autorização negada — a tela deve apresentar a guarda, não um toast. */
  get exigePermissao() {
    return this.status === 403;
  }

  /** Recurso ausente neste ambiente: migration não aplicada. */
  get indisponivelNoAmbiente() {
    return this.status === 501;
  }
}

/**
 * Uma requisição só pode ser repetida se o corpo puder ser enviado de novo.
 *
 * `RequestInit.body` aceita `ReadableStream` e `FormData`, e stream já
 * consumido não se reenvia: repetir produziria requisição sem corpo, que o
 * servidor rejeitaria com uma mensagem que não tem nada a ver com a causa. Os
 * clientes deste projeto mandam JSON serializado (string) ou nada, então o
 * caminho de repetição cobre o uso real — e recusa em silêncio o resto.
 */
export function corpoPodeSerReenviado(corpo: BodyInit | null | undefined) {
  return corpo == null || typeof corpo === "string";
}

/*
  Renovação de sessão: uma vez, compartilhada, sem laço.

  Uma resposta 401 nem sempre significa "a pessoa precisa entrar de novo".
  `PGRST301`–`PGRST303` são falha de **token** — inclusive `JWT issued at
  future`, que aparece quando o relógio de quem assina está adiantado em relação
  a quem valida. O token é legítimo e passa a valer segundos depois; mandar a
  pessoa para /acesso nesse caso a devolve à mesma tela, com a mesma sessão, e o
  problema se repete.

  A resposta é renovar uma vez e repetir uma vez. Três limites deliberados:

    · uma tela dispara várias chamadas em paralelo, e todas falhariam juntas.
      A renovação é uma promise compartilhada por módulo — N respostas 401
      produzem **uma** renovação, não N;
    · a repetição não se repete. Se a segunda tentativa também devolver 401, o
      erro sobe e `usePlatformContext` faz o que já fazia;
    · a segunda falha zera a sessão **local** uma única vez por carregamento.
      Sem isso, /acesso veria a sessão morta ainda gravada, devolveria a pessoa
      para a aplicação e o par de telas ficaria trocando redirecionamento entre
      si. `scope: "local"` não encerra a sessão nos outros dispositivos.

  Nada aqui registra token, sessão ou cabeçalho: o diagnóstico útil é que a
  renovação falhou, e o resto seria credencial em log.
*/
let renovacaoEmVoo: Promise<boolean> | null = null;
let sessaoJaReiniciada = false;

async function renovarSessaoUmaVez(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  renovacaoEmVoo ??= (async () => {
    try {
      const { data, error } = await createBrowserSupabaseClient().auth.refreshSession();
      return Boolean(data.session) && !error;
    } catch {
      return false;
    } finally {
      // Liberado no próximo tique para que as chamadas que falharam juntas
      // compartilhem esta renovação, e uma falha futura possa tentar de novo.
      queueMicrotask(() => { renovacaoEmVoo = null; });
    }
  })();

  return renovacaoEmVoo;
}

async function reiniciarSessaoLocal() {
  if (typeof window === "undefined" || sessaoJaReiniciada) return;
  sessaoJaReiniciada = true;
  try {
    await createBrowserSupabaseClient().auth.signOut({ scope: "local" });
  } catch {
    // Encerrar a sessão local é o melhor esforço para evitar o vaivém com
    // /acesso. Falhar aqui não pode transformar um 401 em erro diferente.
  }
}

/**
 * Executa a chamada e converte falha em `ErroDeApi`.
 *
 * `credentials: "same-origin"` é explícito porque a sessão vive em cookie e a
 * rota depende dele para autenticar como o usuário — é esse cookie que mantém
 * a RLS aplicável do outro lado.
 */
export async function chamar<T>(caminho: string, init?: RequestInit): Promise<T> {
  let resposta = await executar(caminho, init);

  /*
    A repetição é restrita ao 401 que o servidor marcou como renovável.

    Antes bastava ser 401. Só que 401 cobre coisas que renovar não conserta —
    assinatura inválida, token malformado, relógio adiantado — e nesses casos a
    renovação e a repetição eram trabalho garantidamente perdido, além de zerar
    a sessão local de quem talvez não precisasse perdê-la.

    O servidor é quem sabe distinguir: `PGRST301` (expirado) e o 401 do
    middleware viram `SESSAO_RENOVAVEL`; o resto, não. Ler o corpo antes de
    decidir custa uma leitura a mais, e é o que evita a repetição inútil.
  */
  if (resposta.status === 401 && corpoPodeSerReenviado(init?.body)) {
    const renovavel = await marcadaComoRenovavel(resposta);
    if (renovavel) {
      if (await renovarSessaoUmaVez()) {
        resposta = await executar(caminho, init);
      }
      if (resposta.status === 401) await reiniciarSessaoLocal();
    }
  }

  return interpretar<T>(resposta);
}

/**
 * Lê o corpo do 401 sem consumi-lo para quem vem depois.
 *
 * `Response` entrega o corpo uma única vez, e `interpretar()` ainda vai
 * precisar dele para montar a mensagem do erro. `clone()` é o que permite
 * inspecionar agora e continuar tendo o original intacto — sem isso, decidir
 * aqui deixaria a tela sem texto de erro.
 */
async function marcadaComoRenovavel(resposta: Response) {
  try {
    const corpo = (await resposta.clone().json()) as ErroApi | null;
    return corpo?.codigo === ERRO_SESSAO_RENOVAVEL;
  } catch {
    // Corpo ausente ou não-JSON: sem marca, sem repetição.
    return false;
  }
}

async function executar(caminho: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(caminho, {
      ...init,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    // Falha de rede não tem status HTTP. `0` distingue "não chegou ao
    // servidor" de qualquer resposta que o servidor tenha dado.
    throw new ErroDeApi(0, "Não foi possível falar com o servidor. Verifique sua conexão.");
  }
}

async function interpretar<T>(resposta: Response): Promise<T> {
  if (resposta.status === 204) return undefined as T;

  // Corpo pode não ser JSON quando algo falha antes da rota — um erro de
  // plataforma da Vercel, por exemplo. Tratar isso como JSON malformado
  // esconderia o status real, que é a informação útil.
  const texto = await resposta.text();
  let corpo: unknown = null;
  if (texto.trim()) {
    try {
      corpo = JSON.parse(texto);
    } catch {
      if (resposta.ok) {
        throw new ErroDeApi(resposta.status, "O servidor devolveu uma resposta inesperada.");
      }
    }
  }

  if (!resposta.ok) {
    const erro = corpo as ErroApi | null;
    throw new ErroDeApi(
      resposta.status,
      erro?.mensagem?.trim() || "Não foi possível concluir a operação.",
      erro?.referencia,
      erro?.codigo,
    );
  }

  return corpo as T;
}
