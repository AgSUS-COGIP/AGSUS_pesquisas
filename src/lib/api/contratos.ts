/**
 * Contratos da API REST da plataforma.
 *
 * Os tipos aqui são o **superconjunto** que a RPC devolve, não o recorte que
 * uma tela usa: tela que lê menos campos ignora o resto, e o compilador avisa
 * quando o banco muda de formato.
 */

/** Avaliação no catálogo administrativo, no formato devolvido pelo banco. */
export type AvaliacaoGerenciada = {
  surveyId: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  archivedAt: string | null;
  versionNumber: number;
  versionStatus: string;
  applicationId: string | null;
  applicationCode: string | null;
  applicationName: string | null;
  applicationStatus: string | null;
  opensAt: string | null;
  closesAt: string | null;
  anonymous?: boolean;
  sections: number;
  questions: number;
  updatedAt: string;
};

/** Corpo aceito por `POST /api/avaliacoes`. */
export type CriarAvaliacaoEntrada = {
  code: string;
  name: string;
  description?: string | null;
  applicationName: string;
  opensAt?: string | null;
  closesAt?: string | null;
  anonymous?: boolean;
  allowDrafts?: boolean;
};

/** Corpo aceito por `POST /api/avaliacoes/[id]/copia`. */
export type DuplicarAvaliacaoEntrada = {
  name?: string | null;
  code?: string | null;
};

/**
 * Erro devolvido por qualquer rota da API.
 *
 * `mensagem` é texto de interface: chega pronto para o toast, em português,
 * dizendo o que aconteceu. `referencia` correlaciona com a observabilidade
 * quando o erro é de servidor.
 */
/**
 * Corpo de erro devolvido por qualquer rota.
 *
 * `codigo` existe para um caso só: distinguir, dentro dos 401, aqueles que uma
 * renovação de sessão pode resolver dos que ela não resolve. Sem ele o cliente
 * só enxerga "401" e trata token expirado e assinatura inválida do mesmo jeito
 * — renovando e repetindo numa situação em que repetir nunca vai funcionar.
 */
export type ErroApi = {
  mensagem: string;
  referencia?: string;
  codigo?: CodigoDeErroApi;
};

/**
 * Sessão vencida que a renovação **pode** resolver: existe um refresh token
 * válido do outro lado, e um token novo passa a ser aceito.
 *
 * Não cobre assinatura inválida nem relógio adiantado: nos dois casos o token
 * novo nasce com o mesmo defeito do anterior, e repetir só gasta uma ida ao
 * servidor antes de falhar igual.
 */
export const ERRO_SESSAO_RENOVAVEL = "SESSAO_RENOVAVEL" as const;

export type CodigoDeErroApi = typeof ERRO_SESSAO_RENOVAVEL;
