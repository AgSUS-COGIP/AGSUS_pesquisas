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
 * Executa a chamada e converte falha em `ErroDeApi`.
 *
 * `credentials: "same-origin"` é explícito porque a sessão vive em cookie e a
 * rota depende dele para autenticar como o usuário — é esse cookie que mantém
 * a RLS aplicável do outro lado.
 */
export async function chamar<T>(caminho: string, init?: RequestInit): Promise<T> {
  let resposta: Response;

  try {
    resposta = await fetch(caminho, {
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
