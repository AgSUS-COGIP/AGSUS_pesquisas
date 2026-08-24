#!/usr/bin/env node
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { lerContratoCritico, variavel, verificarContrato } from "./lib/contrato-rpc.mjs";

/**
 * Portão de ordem de deploy: a aplicação não é promovida antes do banco.
 *
 * ## O problema que isto fecha
 *
 * `deploy-db-production.yml` e a Vercel são disparados pelo **mesmo** `push`
 * para `main`, em sistemas diferentes, sem ponto de sincronização. Nada impedia
 * a aplicação de subir enquanto as migrations ainda estavam sendo aplicadas —
 * e é exatamente essa janela que produziu `PGRST202 — Could not find the
 * function … in the schema cache` em produção em 10/08/2026 e 20/08/2026.
 *
 * Um GitHub Action não consegue segurar uma publicação da Vercel: quem decide
 * se um build acontece é a Vercel. Este script é a decisão dela, delegada ao
 * repositório por `ignoreCommand` em `vercel.json`.
 *
 * ## Por que a pergunta mudou
 *
 * A primeira versão perguntava **"este commit altera `supabase/migrations/`?"**
 * e, em caso afirmativo, esperava o workflow. Isso deixa passar o caso que
 * importa: se a migration de um commit anterior nunca foi aplicada, todo commit
 * seguinte que não toque no banco passa livre — e a aplicação é promovida sobre
 * um esquema incompatível sem nada reclamar. Foi o que aconteceu depois do
 * merge da #59: as migrations não chegaram a produção, e o commit seguinte
 * publicaria normalmente.
 *
 * A pergunta certa não é sobre o commit, é sobre o **estado acumulado**:
 * *o banco de produção já suporta a versão que estou prestes a publicar?*
 * Quem responde é o próprio banco, pela mesma verificação do readiness —
 * `fc_srv_verificar_contrato_rpc` contra `RPCS_CRITICAS`.
 *
 * As duas checagens convivem, e cada uma cobre o furo da outra:
 *
 *   · o **contrato** pega migration não aplicada de qualquer commit, inclusive
 *     antigo, mas só enxerga o que se manifesta como função ausente;
 *   · a **espera pelo workflow** pega migration que muda tabela, coluna ou
 *     política sem criar função — invisível para o contrato — e evita publicar
 *     no meio de um `db push` em andamento.
 *
 * ## A semântica é invertida, e errar aqui inverte o portão
 *
 * No Ignored Build Step da Vercel:
 *
 *     exit 0  →  build **cancelado**
 *     exit 1  →  build **continua**
 *
 * É o contrário da convenção de processo Unix, e trocar os dois transformaria
 * este arquivo num portão que promove exatamente quando deveria barrar.
 *
 * ## Falha fechada
 *
 * Sem credencial para perguntar — ao GitHub ou ao banco — a resposta é barrar.
 * Um portão que se desliga sozinho quando falta configuração não é portão. O
 * preço é uma publicação perdida, recuperável com **Redeploy**; o preço do
 * contrário é a aplicação no ar sobre um banco que não a suporta.
 *
 * Variáveis usadas, todas já existentes no projeto:
 *
 *   GITHUB_DEPLOY_GATE_TOKEN                       leitura de actions e contents
 *   SUPABASE_URL | NEXT_PUBLIC_SUPABASE_URL        banco de produção
 *   SUPABASE_SECRET_KEY | SUPABASE_SERVICE_ROLE_KEY
 */

const ESPERA_MAXIMA_MS = 10 * 60 * 1000;
const INTERVALO_MS = 15 * 1000;
const WORKFLOW = "deploy-db-production.yml";
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

/*
  As decisões são **devolvidas**, não executadas com `process.exit()`.

  `process.exit()` derruba o processo com o socket do fetch ainda fechando — no
  Windows isso vira `Assertion failed` do libuv e o processo termina com **127**.
  A Vercel leria 127 como diferente de 0, ou seja, *seguir*: o portão promoveria
  a aplicação exatamente no caso em que não conseguiu consultar nada. O desfecho
  mais perigoso sairia do modo mais silencioso possível.
*/
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
      // Estado desconhecido não é estado bom. A execução pode nem ter sido
      // criada (workflow desabilitado, Actions fora do ar), e nesse caso
      // esperar mais não muda nada.
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
    // Preview de pull request não promove nada, e barrá-lo tiraria a revisão
    // visual que hoje existe.
    return seguir(`ambiente "${VERCEL_ENV ?? "desconhecido"}" não promove produção`);
  }

  if (!sha || !owner || !repo) {
    return barrar("faltam VERCEL_GIT_COMMIT_SHA/REPO_OWNER/REPO_SLUG para identificar o commit");
  }

  if (!token) {
    return barrar("GITHUB_DEPLOY_GATE_TOKEN ausente — cadastre-o nas variáveis de ambiente do projeto na Vercel");
  }

  // 1. Este commit está aplicando migrations agora? Se sim, espere terminar,
  //    para não publicar no meio de um `db push`.
  if (await mexeEmMigrations()) {
    console.log(`[gate] ${sha.slice(0, 7)} altera migrations; aguardando ${WORKFLOW}.`);
    const falha = await esperarWorkflow();
    if (falha) return barrar(falha);
  }

  // 2. Independentemente deste commit: o banco suporta a versão que vai subir?
  //    É esta pergunta que pega migration antiga que nunca foi aplicada.
  const resultado = await verificarContrato({
    url: variavel("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
    chave: variavel("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"),
    nomes: lerContratoCritico(RAIZ),
  });

  if (resultado.situacao === "incompleto") {
    for (const nome of resultado.ausentes) console.log(`[gate]   ausente: ${nome}`);
    return barrar(
      `o banco de produção não tem ${resultado.ausentes.length} de ${resultado.conferidas} função(ões) do contrato — aplique as migrations antes de publicar`,
    );
  }

  if (resultado.situacao === "indisponivel") {
    return barrar(`não foi possível verificar o contrato no banco (${resultado.motivo})`);
  }

  return seguir(`contrato íntegro: ${resultado.conferidas} função(ões) conferida(s) no banco de produção`);
}

const decisao = await decidir().catch((erro) =>
  // Sem informação, não promove. Mesma regra do token ausente.
  barrar(`falha ao avaliar o portão (${erro instanceof Error ? erro.message : erro})`),
);

console.log(`[gate] ${decisao.rotulo} — ${decisao.motivo}`);
process.exitCode = decisao.codigo;
