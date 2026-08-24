#!/usr/bin/env node
/**
 * Portão de ordem de deploy: a aplicação não é promovida antes do banco.
 *
 * ## O problema que isto fecha
 *
 * `deploy-db-production.yml` e a Vercel são disparados pelo **mesmo** `push`
 * para `main`, em sistemas diferentes, sem ponto de sincronização. Nada impedia
 * a aplicação de subir enquanto as migrations ainda estavam sendo aplicadas —
 * e é exatamente essa janela que produziu `PGRST202 — Could not find the
 * function … in the schema cache` em produção em 10/08/2026 e de novo em
 * 20/08/2026.
 *
 * Um GitHub Action não consegue segurar uma publicação da Vercel: quem decide
 * se um build acontece é a Vercel. Este script é a decisão dela, delegada ao
 * repositório por `ignoreCommand` em `vercel.json`.
 *
 * Ele fica **no repositório**, e não em Settings → Git → Ignored Build Step,
 * porque `ignoreCommand` sobrescreve aquela configuração e é versionado junto
 * com o código: quem lê o repositório vê o portão, e mudá-lo passa por revisão
 * em vez de acontecer num painel sem histórico.
 *
 * ## A semântica é invertida, e errar aqui inverte o portão
 *
 * No Ignored Build Step da Vercel:
 *
 *     exit 0  →  build **cancelado**
 *     exit 1  →  build **continua**
 *
 * É o contrário da convenção de processo Unix, e trocar os dois transformaria
 * este arquivo num portão que promove exatamente quando deveria barrar. Por
 * isso os retornos aqui passam por `seguir()` e `barrar()`, nomeados pelo
 * efeito, e nunca por `process.exit` solto.
 *
 * ## Ordem das decisões
 *
 *   1. Não é produção  → segue. Preview de pull request não promove nada, e
 *      barrá-lo tiraria a revisão visual que hoje existe.
 *   2. O commit não mexe em `supabase/migrations/` → segue. O workflow de banco
 *      só roda quando há migration; esperar por uma execução que nunca vai
 *      existir travaria todo deploy de frontend.
 *   3. Mexe em migration → espera o workflow daquele **mesmo SHA** concluir com
 *      sucesso. Falhou, foi cancelado ou estourou o tempo → barra.
 *
 * ## Falha fechada, e só onde importa
 *
 * Sem `GITHUB_DEPLOY_GATE_TOKEN`, um commit que mexe em migration é **barrado**.
 * Deixar passar seria manter aberto o risco que o portão existe para fechar, e
 * um portão que se desliga sozinho quando a configuração falta não é portão.
 * Commit que não toca no banco continua publicando normalmente, então a falta
 * do segredo nunca paralisa a entrega inteira — só a classe de deploy perigosa.
 *
 * O token precisa de leitura de `actions` e `contents` neste repositório.
 * Build barrado não se perde: depois do workflow verde, **Redeploy** no commit
 * passa por aqui de novo e agora segue.
 */

const ESPERA_MAXIMA_MS = 10 * 60 * 1000;
const INTERVALO_MS = 15 * 1000;
const WORKFLOW = "deploy-db-production.yml";

/*
  As decisões são **devolvidas**, não executadas com `process.exit()`.

  `process.exit()` derruba o processo com o socket do fetch ainda fechando —
  no Windows isso vira `Assertion failed` do libuv e o processo termina com
  **127**. A Vercel leria 127 como "diferente de 0", ou seja, *seguir*: o portão
  promoveria a aplicação exatamente no caso em que não conseguiu consultar o
  GitHub. O desfecho mais perigoso sairia do modo mais silencioso possível.

  Devolvendo o código e deixando `process.exitCode` valer, o processo termina
  quando o laço de eventos esvazia — com o código certo, em qualquer sistema.
*/
const SEGUIR = { codigo: 1, rotulo: "BUILD SEGUE" };
const BARRAR = { codigo: 0, rotulo: "BUILD BARRADO" };

const seguir = (motivo) => ({ ...SEGUIR, motivo });
const barrar = (motivo) => ({ ...BARRAR, motivo });

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
  if (!resposta.ok) {
    throw new Error(`GitHub respondeu ${resposta.status} em ${caminho}`);
  }
  return resposta.json();
}

async function mexeEmMigrations() {
  const commit = await buscar(`/commits/${sha}`);
  return (commit.files ?? []).some((f) => String(f.filename).startsWith("supabase/migrations/"));
}

async function execucaoDoCommit() {
  const dados = await buscar(`/actions/workflows/${WORKFLOW}/runs?head_sha=${sha}&per_page=1`);
  return dados.workflow_runs?.[0] ?? null;
}

async function decidir() {
  if (VERCEL_ENV !== "production") {
    return seguir(`ambiente "${VERCEL_ENV ?? "desconhecido"}" não promove produção`);
  }

  if (!sha || !owner || !repo) {
    // Sem saber qual commit é, não há como consultar o workflow dele. Produção
    // sem essa informação é o caso em que barrar é a única resposta honesta.
    return barrar("faltam VERCEL_GIT_COMMIT_SHA/REPO_OWNER/REPO_SLUG para identificar o commit");
  }

  const inicio = Date.now();

  if (!token) {
    /*
      Sem token não dá para saber se o commit mexe em migration, e a resposta
      muda conforme isso. Barrar é a leitura segura: no pior caso perde-se uma
      publicação de frontend, recuperável com um Redeploy; a alternativa é
      promover a aplicação sobre um banco que ainda não recebeu as migrations,
      que é a falha que derrubou a plataforma duas vezes.
    */
    return barrar(`GITHUB_DEPLOY_GATE_TOKEN ausente — cadastre-o nas variáveis de ambiente do projeto na Vercel (leitura de actions e contents)`);
  }

  if (!(await mexeEmMigrations())) {
    return seguir("o commit não altera supabase/migrations/");
  }

  console.log(`[gate] ${sha.slice(0, 7)} altera migrations; aguardando ${WORKFLOW}.`);

  for (;;) {
    const execucao = await execucaoDoCommit();

    if (execucao?.status === "completed") {
      if (execucao.conclusion === "success") {
        return seguir(`${WORKFLOW} concluiu com sucesso neste commit`);
      }
      return barrar(`${WORKFLOW} terminou como "${execucao.conclusion}" — corrija e refaça o deploy`);
    }

    if (Date.now() - inicio > ESPERA_MAXIMA_MS) {
      // Estado desconhecido não é estado bom. A execução pode nem ter sido
      // criada (workflow desabilitado, push sem Actions) — e nesse caso esperar
      // mais não muda nada.
      return barrar(
        execucao
          ? `${WORKFLOW} continua "${execucao.status}" após 10 minutos`
          : `nenhuma execução de ${WORKFLOW} apareceu para este commit em 10 minutos`,
      );
    }

    process.stdout.write(".");
    await new Promise((resolve) => setTimeout(resolve, INTERVALO_MS));
  }
}

const decisao = await decidir().catch((erro) =>
  // Falha ao consultar o GitHub deixa o portão sem informação. Mesma regra do
  // token ausente: sem saber, não promove.
  barrar(`não foi possível consultar o GitHub (${erro instanceof Error ? erro.message : erro})`),
);

console.log(`[gate] ${decisao.rotulo} — ${decisao.motivo}`);
process.exitCode = decisao.codigo;
