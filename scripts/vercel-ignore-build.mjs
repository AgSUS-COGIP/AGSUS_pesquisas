#!/usr/bin/env node
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { lerContratoCritico, variavel, verificarContrato } from "./lib/contrato-rpc.mjs";
import { lerVersoesMigrations, verificarMigrations } from "./lib/contrato-migrations.mjs";

/**
 * Portão de ordem de deploy: a aplicação só é promovida quando o banco de
 * produção está compatível com o checkout que a Vercel pretende publicar.
 *
 * Três garantias se complementam:
 *   1. commit com migration espera o workflow de banco do mesmo SHA;
 *   2. o contrato de RPC detecta funções críticas ausentes;
 *   3. o contrato de migrations compara TODO o histórico esperado do
 *      repositório com `supabase_migrations.schema_migrations`.
 *
 * A terceira garantia fecha o caso que as duas primeiras não cobrem: uma
 * migration estrutural de commit anterior pode ter falhado, enquanto um commit
 * posterior sem migration e sem RPC nova ainda pareceria compatível.
 *
 * No Ignored Build Step da Vercel a semântica é invertida:
 *   exit 0 -> build cancelado
 *   exit 1 -> build continua
 *
 * O portão falha fechado: sem credencial ou sem conseguir consultar GitHub ou
 * banco, o build de produção é barrado.
 */

const ESPERA_MAXIMA_MS = 10 * 60 * 1000;
const INTERVALO_MS = 15 * 1000;
const WORKFLOW = "deploy-db-production.yml";
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

const seguir = (motivo) => ({ codigo: 1, rotulo: "BUILD SEGUE", motivo });
const barrar = (motivo) => ({ codigo: 0, rotulo: "BUILD BARRADO", motivo });

const {
  VERCEL_ENV,
  VERCEL_GIT_COMMIT_SHA: sha,
  VERCEL_GIT_REPO_OWNER: owner,
  VERCEL_GIT_REPO_SLUG: repo,
  GITHUB_DEPLOY_GATE_TOKEN: token,
} = process.env;

const api = `https://api.github.com/repos/${owner}/${repo}`;

async function buscar(caminho) {
  const resposta = await fetch(`${api}${caminho}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "agsus-pesquisas-deploy-gate",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!resposta.ok) throw new Error(`GitHub respondeu ${resposta.status} em ${caminho}`);
  return resposta.json();
}

async function mexeEmMigrations() {
  const commit = await buscar(`/commits/${sha}`);
  return (commit.files ?? []).some((f) => String(f.filename).startsWith("supabase/migrations/"));
}

async function esperarWorkflow() {
  const inicio = Date.now();

  for (;;) {
    const dados = await buscar(`/actions/workflows/${WORKFLOW}/runs?head_sha=${sha}&per_page=1`);
    const execucao = dados.workflow_runs?.[0] ?? null;

    if (execucao?.status === "completed") {
      return execucao.conclusion === "success"
        ? null
        : `${WORKFLOW} terminou como "${execucao.conclusion}" — corrija e refaça o deploy`;
    }

    if (Date.now() - inicio > ESPERA_MAXIMA_MS) {
      return execucao
        ? `${WORKFLOW} continua "${execucao.status}" após 10 minutos`
        : `nenhuma execução de ${WORKFLOW} apareceu para este commit em 10 minutos`;
    }

    process.stdout.write(".");
    await new Promise((resolve) => setTimeout(resolve, INTERVALO_MS));
  }
}

async function decidir() {
  if (VERCEL_ENV !== "production") {
    return seguir(`ambiente "${VERCEL_ENV ?? "desconhecido"}" não promove produção`);
  }

  if (!sha || !owner || !repo) {
    return barrar("faltam VERCEL_GIT_COMMIT_SHA/REPO_OWNER/REPO_SLUG para identificar o commit");
  }

  if (!token) {
    return barrar("GITHUB_DEPLOY_GATE_TOKEN ausente — cadastre-o nas variáveis de ambiente do projeto na Vercel");
  }

  if (await mexeEmMigrations()) {
    console.log(`[gate] ${sha.slice(0, 7)} altera migrations; aguardando ${WORKFLOW}.`);
    const falha = await esperarWorkflow();
    if (falha) return barrar(falha);
  }

  const url = variavel("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
  const chave = variavel("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");

  const contrato = await verificarContrato({
    url,
    chave,
    nomes: lerContratoCritico(RAIZ),
  });

  if (contrato.situacao === "incompleto") {
    for (const nome of contrato.ausentes) console.log(`[gate]   RPC ausente: ${nome}`);
    return barrar(
      `o banco de produção não tem ${contrato.ausentes.length} de ${contrato.conferidas} função(ões) do contrato — aplique as migrations antes de publicar`,
    );
  }

  if (contrato.situacao === "indisponivel") {
    return barrar(`não foi possível verificar o contrato de RPC no banco (${contrato.motivo})`);
  }

  const migrations = await verificarMigrations({
    url,
    chave,
    versoes: lerVersoesMigrations(RAIZ),
  });

  if (migrations.situacao === "incompleto") {
    for (const versao of migrations.ausentes) console.log(`[gate]   migration ausente: ${versao}`);
    return barrar(
      `o banco de produção não registrou ${migrations.ausentes.length} de ${migrations.conferidas} migration(ões) esperada(s)`,
    );
  }

  if (migrations.situacao === "indisponivel") {
    return barrar(`não foi possível verificar o histórico de migrations no banco (${migrations.motivo})`);
  }

  return seguir(
    `banco alinhado: ${contrato.conferidas} RPC(s) críticas e ${migrations.conferidas} migration(ões) conferidas`,
  );
}

const decisao = await decidir().catch((erro) =>
  barrar(`falha ao avaliar o portão (${erro instanceof Error ? erro.message : erro})`),
);

console.log(`[gate] ${decisao.rotulo} — ${decisao.motivo}`);
process.exitCode = decisao.codigo;
