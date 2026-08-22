import { chamar } from "./requisicao";
import type { RespostaEntrada, TipoSubmissaoCddi } from "./contratos-runtime";
import type { SurveyCatalogItem } from "@/lib/survey-catalog";

/**
 * Cliente da jornada de resposta — o que o participante consome.
 *
 * As funções aqui são chamadas de dentro de filas de gravação serializadas
 * (`ReliableSaveQueue` no CDDI, `useRef<Promise>` no runtime genérico), que
 * dependem de a falha **lançar** para encadear o retry e marcar o estado de
 * erro. Por isso nenhuma delas engole exceção: quem trata é a fila.
 */

/** Definição publicada do formulário, pelo código da aplicação. */
export async function obterFormulario(codigoAplicacao: string) {
  // A autoavaliação antiga chama esta função antes de abrir a submissão dentro
  // do mesmo `Promise.all`. Ceder uma microtask permite que a chamada de
  // submissão registre o bootstrap consolidado e evita um GET redundante.
  await Promise.resolve();
  const bootstrap = bootstrapCddiAutoDoCiclo(codigoAplicacao);
  if (bootstrap) return (await bootstrap).form;
  return chamar<unknown>(`/api/formularios/${encodeURIComponent(codigoAplicacao)}`);
}

/** Regras de lógica condicional do ciclo. */
export function obterRegrasDoCiclo(codigoCiclo: string) {
  return chamar<unknown>(`/api/ciclos/${encodeURIComponent(codigoCiclo)}/regras`);
}

/** Inicia ou retoma a submissão da pessoa autenticada. */
export function iniciarOuRetomarSubmissao(codigoAplicacao: string) {
  return chamar<unknown>("/api/submissoes", {
    method: "POST",
    body: JSON.stringify({ applicationCode: codigoAplicacao }),
  });
}

/**
 * Grava a resposta de uma pergunta.
 *
 * Idempotente: a RPC faz upsert por (submissão, pergunta), então retransmissão
 * de rede não duplica resposta.
 */
export function gravarResposta(submissaoId: string, resposta: RespostaEntrada) {
  return chamar<unknown>(`/api/submissoes/${submissaoId}/respostas`, {
    method: "PUT",
    body: JSON.stringify(resposta),
  });
}

/** Envia a submissão definitivamente. O banco cobra as obrigatórias visíveis. */
export function enviarSubmissao(submissaoId: string) {
  return chamar<{ submittedAt?: string }>(`/api/submissoes/${submissaoId}/envio`, {
    method: "POST",
  });
}

/** Jornada sem login, exclusiva para ciclos explicitamente anônimos. */
export function obterFormularioAnonimo(codigoAplicacao: string) {
  return chamar<unknown>(`/api/pesquisas-anonimas/${encodeURIComponent(codigoAplicacao)}`);
}

export function iniciarSubmissaoAnonima(codigoAplicacao: string) {
  return chamar<unknown>(`/api/pesquisas-anonimas/${encodeURIComponent(codigoAplicacao)}/submissoes`, { method: "POST" });
}

export function gravarRespostaAnonima(submissaoId: string, token: string, resposta: RespostaEntrada) {
  return chamar<unknown>(`/api/pesquisas-anonimas/submissoes/${submissaoId}/respostas`, {
    method: "PUT",
    headers: { "X-Anonymous-Session": token },
    body: JSON.stringify(resposta),
  });
}

export function enviarSubmissaoAnonima(submissaoId: string, token: string) {
  return chamar<{ submittedAt?: string }>(`/api/pesquisas-anonimas/submissoes/${submissaoId}/envio`, {
    method: "POST",
    headers: { "X-Anonymous-Session": token },
  });
}

/** Catálogo de avaliações da pessoa autenticada. */
export function listarMeuCatalogo() {
  return chamar<SurveyCatalogItem[]>("/api/meu/catalogo");
}

// --- CDDI -------------------------------------------------------------------
//
// O CDDI tem funções próprias porque a submissão carrega tipo (autoavaliação ou
// chefia) e, no segundo caso, a pessoa avaliada.

export type BootstrapCddiAuto = {
  applicationCode: string;
  form: unknown;
  submission: unknown;
  identity: unknown;
};

type BootstrapCacheEntry = {
  promise: Promise<BootstrapCddiAuto>;
  expiresAt: number;
};

// Cache curtíssimo, usado apenas para coalescer as quatro funções que a tela
// chama durante a mesma montagem. Não é cache de dados da avaliação: depois de
// 5 s da conclusão uma nova navegação volta ao servidor e reidrata respostas.
const CDDI_BOOTSTRAP_COALESCE_MS = 5_000;
const bootstrapCddiAutoPorCiclo = new Map<string, BootstrapCacheEntry>();
let bootstrapCddiAutoVigente: BootstrapCacheEntry | null = null;

function bootstrapCddiAutoDoCiclo(codigoCiclo: string) {
  const entry = bootstrapCddiAutoPorCiclo.get(codigoCiclo);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    bootstrapCddiAutoPorCiclo.delete(codigoCiclo);
    return null;
  }
  return entry.promise;
}

/**
 * Resolve ciclo, formulário, submissão e identidade da autoavaliação em uma
 * única chamada HTTP. As RPCs independentes são paralelizadas pela rota.
 */
export function obterBootstrapCddiAuto(codigoCiclo?: string | null) {
  const code = codigoCiclo?.trim() || "";
  const existing = code ? bootstrapCddiAutoDoCiclo(code) : (
    bootstrapCddiAutoVigente && bootstrapCddiAutoVigente.expiresAt > Date.now()
      ? bootstrapCddiAutoVigente.promise
      : null
  );
  if (existing) return existing;

  const promise = chamar<BootstrapCddiAuto>("/api/cddi/bootstrap", {
    method: "POST",
    body: JSON.stringify({ applicationCode: code || null }),
  });
  const entry: BootstrapCacheEntry = {
    promise,
    // Enquanto a requisição estiver pendente, ela nunca expira. O TTL curto só
    // começa após a resposta, evitando abrir um segundo bootstrap se o primeiro
    // levar mais de cinco segundos sob carga ou rede lenta.
    expiresAt: Number.POSITIVE_INFINITY,
  };

  if (code) bootstrapCddiAutoPorCiclo.set(code, entry);
  else bootstrapCddiAutoVigente = entry;

  void promise.then((data) => {
    entry.expiresAt = Date.now() + CDDI_BOOTSTRAP_COALESCE_MS;
    bootstrapCddiAutoPorCiclo.set(data.applicationCode, entry);
  }).catch(() => {
    if (code && bootstrapCddiAutoPorCiclo.get(code) === entry) {
      bootstrapCddiAutoPorCiclo.delete(code);
    }
    if (!code && bootstrapCddiAutoVigente === entry) bootstrapCddiAutoVigente = null;
  });

  return promise;
}

/** Ciclo vigente do CDDI para a pessoa autenticada. */
export async function obterCicloCddiVigente() {
  const bootstrap = await obterBootstrapCddiAuto();
  return { code: bootstrap.applicationCode };
}

/** Identificação institucional no ciclo, incluindo a chefia vinculada. */
export function obterIdentidadeCddi(codigoCiclo: string) {
  const bootstrap = bootstrapCddiAutoDoCiclo(codigoCiclo);
  if (bootstrap) return bootstrap.then((data) => data.identity);
  return chamar<unknown>(`/api/cddi/identidade?ciclo=${encodeURIComponent(codigoCiclo)}`);
}

/** Inicia ou retoma uma submissão do CDDI. */
export function iniciarOuRetomarSubmissaoCddi(entrada: {
  applicationCode: string;
  submissionType: TipoSubmissaoCddi;
  subjectPersonId?: string | null;
}) {
  if (entrada.submissionType === "AUTO" && !entrada.subjectPersonId) {
    return obterBootstrapCddiAuto(entrada.applicationCode).then((data) => data.submission);
  }

  return chamar<unknown>("/api/cddi/submissoes", {
    method: "POST",
    body: JSON.stringify({
      applicationCode: entrada.applicationCode,
      submissionType: entrada.submissionType,
      subjectPersonId: entrada.subjectPersonId ?? null,
    }),
  });
}

/** Grava a resposta de uma pergunta do CDDI (alternativa única ou texto). */
export function gravarRespostaCddi(
  submissaoId: string,
  entrada: { questionId: string; optionId?: string | null; text?: string | null },
) {
  return chamar<{ savedAt?: string }>(`/api/cddi/submissoes/${submissaoId}/respostas`, {
    method: "PUT",
    body: JSON.stringify(entrada),
  });
}

/** Envia uma submissão do CDDI definitivamente. */
export function enviarSubmissaoCddi(submissaoId: string) {
  return chamar<{ submittedAt?: string; result?: number }>(
    `/api/cddi/submissoes/${submissaoId}/envio`,
    { method: "POST" },
  );
}

// As duas funções abaixo consomem rotas de `/api/equipe`, mas moram aqui porque
// quem as chama é a jornada de avaliação de chefia: ela precisa do ciclo de
// liderança para resolver o código da aplicação, e da equipe para confirmar que
// a pessoa avaliada está mesmo vinculada.

/** Ciclos em que a pessoa autenticada lidera equipe, do mais recente ao mais antigo. */
export function listarCiclosDeLideranca() {
  return chamar<Array<{ code?: string }>>("/api/equipe/ciclos");
}

/** Equipe da pessoa autenticada no ciclo informado. */
export function obterMinhaEquipe(codigoCiclo?: string | null) {
  const consulta = codigoCiclo ? `?ciclo=${encodeURIComponent(codigoCiclo)}` : "";
  return chamar<unknown>(`/api/equipe${consulta}`);
}
