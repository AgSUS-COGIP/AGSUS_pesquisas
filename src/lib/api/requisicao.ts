import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { ErroApi } from "./contratos";

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

  constructor(status: number, mensagem: string, referencia?: string) {
    super(mensagem);
    this.name = "ErroDeApi";
    this.status = status;
    this.referencia = referencia;
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

  if (resposta.status === 401 && corpoPodeSerReenviado(init?.body)) {
    if (await renovarSessaoUmaVez()) {
      resposta = await executar(caminho, init);
    }
    if (resposta.status === 401) await reiniciarSessaoLocal();
  }

  return interpretar<T>(resposta);
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
    );
  }

  return corpo as T;
}
