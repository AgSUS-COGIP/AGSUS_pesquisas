import { readdirSync } from "node:fs";
import { join } from "node:path";

const FUNCAO = "fc_srv_verificar_migrations";
const PADRAO_MIGRATION = /^(\d{14})_.+\.sql$/;

export function lerVersoesMigrations(raiz) {
  const pasta = join(raiz, "supabase", "migrations");
  const versoes = [];

  for (const entrada of readdirSync(pasta, { withFileTypes: true })) {
    if (!entrada.isFile() || !entrada.name.endsWith(".sql")) continue;
    const match = entrada.name.match(PADRAO_MIGRATION);
    if (!match) throw new Error(`Migration sem identificador de 14 dígitos: ${entrada.name}`);
    versoes.push(match[1]);
  }

  const unicas = [...new Set(versoes)].sort();
  if (unicas.length !== versoes.length) throw new Error("Há identificadores de migration duplicados no repositório.");
  if (!unicas.length) throw new Error("Nenhuma migration foi encontrada no repositório.");
  return unicas;
}

export async function verificarMigrations({ url, chave, versoes, fetchImpl = fetch }) {
  if (!url || !chave) {
    return { situacao: "indisponivel", motivo: "faltam a URL do Supabase e a chave de service role" };
  }
  if (!Array.isArray(versoes) || !versoes.length) {
    return { situacao: "indisponivel", motivo: "a lista de migrations esperadas está vazia" };
  }

  let resposta;
  try {
    resposta = await fetchImpl(`${url.replace(/\/+$/, "")}/rest/v1/rpc/${FUNCAO}`, {
      method: "POST",
      headers: {
        apikey: chave,
        Authorization: `Bearer ${chave}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_versoes: versoes }),
    });
  } catch (erro) {
    return { situacao: "indisponivel", motivo: `falha de rede ao consultar o histórico de migrations (${erro?.message ?? erro})` };
  }

  const texto = await resposta.text();
  if (!resposta.ok) {
    const pista = texto.includes(FUNCAO)
      ? `a migration que cria ${FUNCAO} não foi aplicada`
      : `HTTP ${resposta.status}`;
    return { situacao: "indisponivel", motivo: pista, detalhe: texto };
  }

  let resultado;
  try {
    resultado = JSON.parse(texto);
  } catch {
    return { situacao: "indisponivel", motivo: "o banco devolveu uma resposta de migrations que não é JSON" };
  }

  const ausentes = Array.isArray(resultado?.missing) ? resultado.missing.map(String) : [];
  const conferidas = Number(resultado?.checked);
  if (!Number.isFinite(conferidas) || conferidas !== versoes.length) {
    return {
      situacao: "indisponivel",
      motivo: `o banco conferiu ${Number.isFinite(conferidas) ? conferidas : "um número inválido"} de ${versoes.length} migrations esperadas`,
    };
  }

  return resultado?.compatible === true && ausentes.length === 0
    ? { situacao: "compativel", conferidas, ultimaAplicada: resultado?.latestApplied ?? null }
    : { situacao: "incompleto", conferidas, ausentes, ultimaAplicada: resultado?.latestApplied ?? null };
}
