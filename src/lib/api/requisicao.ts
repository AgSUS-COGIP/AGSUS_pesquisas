import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { ERRO_SESSAO_RENOVAVEL, type CodigoDeErroApi, type ErroApi } from "./contratos";

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

  get sessaoRenovavel() {
    return this.status === 401 && this.codigo === ERRO_SESSAO_RENOVAVEL;
  }

  get exigeAutenticacao() {
    return this.status === 401;
  }

  get exigePermissao() {
    return this.status === 403;
  }

  get indisponivelNoAmbiente() {
    return this.status === 501;
  }
}

export function corpoPodeSerReenviado(corpo: BodyInit | null | undefined) {
  return corpo == null || typeof corpo === "string";
}

let renovacaoEmVoo: Promise<boolean> | null = null;
let reinicioEmVoo: Promise<void> | null = null;

async function renovarSessaoUmaVez(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  renovacaoEmVoo ??= (async () => {
    try {
      const { data, error } = await createBrowserSupabaseClient().auth.refreshSession();
      return Boolean(data.session) && !error;
    } catch {
      return false;
    } finally {
      queueMicrotask(() => { renovacaoEmVoo = null; });
    }
  })();

  return renovacaoEmVoo;
}

async function reiniciarSessaoLocal() {
  if (typeof window === "undefined") return;

  reinicioEmVoo ??= (async () => {
    try {
      await createBrowserSupabaseClient().auth.signOut({ scope: "local" });
    } catch {
      // Melhor esforço: uma falha ao limpar a sessão local não pode mascarar o
      // 401 original nem encerrar sessões em outros dispositivos.
    } finally {
      // Chamadas paralelas compartilham a mesma limpeza; uma ocorrência futura
      // pode tentar novamente, sem ficar bloqueada pela vida inteira do módulo.
      queueMicrotask(() => { reinicioEmVoo = null; });
    }
  })();

  return reinicioEmVoo;
}

export async function chamar<T>(caminho: string, init?: RequestInit): Promise<T> {
  let resposta = await executar(caminho, init);

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

async function marcadaComoRenovavel(resposta: Response) {
  try {
    const corpo = (await resposta.clone().json()) as ErroApi | null;
    return corpo?.codigo === ERRO_SESSAO_RENOVAVEL;
  } catch {
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
    throw new ErroDeApi(0, "Não foi possível falar com o servidor. Verifique sua conexão.");
  }
}

async function interpretar<T>(resposta: Response): Promise<T> {
  if (resposta.status === 204) return undefined as T;

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
