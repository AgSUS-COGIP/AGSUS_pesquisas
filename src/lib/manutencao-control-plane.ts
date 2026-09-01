import { createClient } from "@vercel/edge-config";
import {
  MANUTENCAO_INATIVA,
  normalizarEstadoDeManutencao,
  type EstadoDeManutencao,
} from "./manutencao";

/**
 * Onde o estado de manutenção mora — fora do PostgreSQL, de propósito.
 *
 * ## Por que não no banco
 *
 * Se a manutenção morasse em `tb_config_plataforma`, a aplicação precisaria
 * consultar o banco para saber se deve mostrar a tela de indisponibilidade
 * causada pelo banco estar fora. A informação some exatamente quando ela é
 * necessária. O estado crítico precisa viver fora do mesmo ponto de falha.
 *
 * ## Ler e escrever são caminhos diferentes
 *
 * A `EDGE_CONFIG` é uma connection string de **leitura**, otimizada para ser
 * lida em toda requisição sem custo de rede relevante. Ela não escreve.
 *
 * A escrita vai pela API oficial da Vercel, autenticada com `VERCEL_API_TOKEN`.
 * Esse token é de servidor e não pode existir no navegador — por isso ele
 * nunca aparece em variável `NEXT_PUBLIC_*`, nunca volta numa resposta e nunca
 * entra em log, nem truncado.
 *
 * ## Um store, duas chaves de ambiente
 *
 * O plano Hobby permite um único Global Config. Para preservar a independência
 * operacional entre Production e Preview, os ambientes usam chaves diferentes
 * dentro do mesmo store: `maintenance-production` e `maintenance-preview`.
 *
 * Qualquer ambiente que não seja explicitamente `production` cai na chave de
 * Preview. Isso é deliberado: desenvolvimento local nunca deve conseguir tocar
 * o estado de produção por acidente.
 */

export type AmbienteDoControlPlane = "production" | "preview";

export function ambienteDoControlPlane(vercelEnv: string | undefined = process.env.VERCEL_ENV): AmbienteDoControlPlane {
  return vercelEnv === "production" ? "production" : "preview";
}

export function chaveDoControlPlane(vercelEnv: string | undefined = process.env.VERCEL_ENV) {
  return `maintenance-${ambienteDoControlPlane(vercelEnv)}`;
}

export type LeituraDoControlPlane =
  | { ok: true; estado: EstadoDeManutencao }
  | { ok: false; motivo: "nao-configurado" | "falha-de-leitura" };

/** O control plane está provisionado neste ambiente? */
export function controlPlaneConfigurado() {
  return Boolean(process.env.EDGE_CONFIG?.trim());
}

/** A escrita está provisionada? Leitura e escrita podem estar em estados diferentes. */
export function escritaConfigurada() {
  return Boolean(process.env.EDGE_CONFIG_ID?.trim() && process.env.VERCEL_API_TOKEN?.trim());
}

/*
  `disableDevelopmentCache` só afeta `next dev`: sem ele o SDK serve um valor
  velho e é preciso recarregar duas vezes para ver a mudança — o que, ao testar
  manutenção, parece defeito da funcionalidade. Em Preview e Production o SDK
  já usa otimizações próprias, e `cache` é `no-store` por padrão.
*/
const cliente = controlPlaneConfigurado()
  ? createClient(process.env.EDGE_CONFIG, { disableDevelopmentCache: true })
  : null;

/**
 * Estado atual, ou o motivo de não ter conseguido ler.
 *
 * Nunca lança: quem chama precisa decidir o que fazer com a falha, e uma
 * exceção aqui derrubaria a requisição inteira por causa de uma bandeira.
 */
export async function lerManutencao(): Promise<LeituraDoControlPlane> {
  if (!cliente) return { ok: false, motivo: "nao-configurado" };

  try {
    const bruto = await cliente.get(chaveDoControlPlane());
    // Chave ausente é um store recém-criado, e não uma falha: significa que
    // nunca houve manutenção naquele ambiente.
    if (bruto === undefined) return { ok: true, estado: MANUTENCAO_INATIVA };
    return { ok: true, estado: normalizarEstadoDeManutencao(bruto) };
  } catch (erro) {
    // Sem detalhe do erro: a mensagem do SDK pode carregar a connection string.
    console.warn("maintenance_control_plane_error", {
      operacao: "leitura",
      tipo: erro instanceof Error ? erro.name : "desconhecido",
    });
    return { ok: false, motivo: "falha-de-leitura" };
  }
}

/**
 * O estado que a decisão operacional deve usar.
 *
 * `null` propaga "não foi possível ler" para `resolverEstadoOperacional`, que
 * trata isso como "não bloqueia" quando a plataforma está saudável. Ambiente
 * sem control plane provisionado cai no mesmo caminho: a funcionalidade fica
 * inerte em vez de fechar a plataforma.
 */
export async function estadoParaDecisao(): Promise<EstadoDeManutencao | null> {
  const leitura = await lerManutencao();
  return leitura.ok ? leitura.estado : null;
}

export type ResultadoDaEscrita = { ok: true } | { ok: false; motivo: string };

/**
 * Grava o estado na chave correspondente ao ambiente atual.
 *
 * `upsert` porque a chave pode não existir ainda — um store recém-criado está
 * vazio, e exigir criação antes da primeira atualização faria a primeira
 * ativação falhar sem motivo que interesse a quem opera.
 */
export async function gravarManutencao(estado: EstadoDeManutencao): Promise<ResultadoDaEscrita> {
  const idDoStore = process.env.EDGE_CONFIG_ID?.trim();
  const token = process.env.VERCEL_API_TOKEN?.trim();
  const time = process.env.VERCEL_TEAM_ID?.trim();

  if (!idDoStore || !token) {
    return { ok: false, motivo: "O control plane de escrita não está configurado neste ambiente." };
  }

  // A Vercel renomeou Edge Config para Global Config. Os IDs `ecfg_*` e a
  // variável legada `EDGE_CONFIG` seguem compatíveis, mas a API de escrita
  // documentada atualmente vive sob `/v1/global-config`.
  const endereco = new URL(`https://api.vercel.com/v1/global-config/${idDoStore}/items`);
  if (time) endereco.searchParams.set("teamId", time);

  try {
    const resposta = await fetch(endereco, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [{ operation: "upsert", key: chaveDoControlPlane(), value: estado }],
      }),
      cache: "no-store",
    });

    if (!resposta.ok) {
      // O corpo da Vercel não volta para quem chamou: ele pode citar
      // identificadores da conta. Fica no log do servidor.
      console.warn("maintenance_control_plane_error", {
        operacao: "escrita",
        status: resposta.status,
      });
      return { ok: false, motivo: "Não foi possível gravar o estado de manutenção." };
    }

    return { ok: true };
  } catch (erro) {
    console.warn("maintenance_control_plane_error", {
      operacao: "escrita",
      tipo: erro instanceof Error ? erro.name : "desconhecido",
    });
    return { ok: false, motivo: "Não foi possível falar com o control plane." };
  }
}
