// Apoio dos testes de banco: conexão e execução com identidade de sessão.
//
// REGRA DESTE ARQUIVO: nenhum teste grava. Toda execução acontece dentro de uma
// transação que termina em `rollback`, sempre — inclusive quando o teste falha.
// O motivo é concreto: o banco réplica local guarda hoje a única cópia dos
// cadastros que foram apagados de produção, e uma suíte que sujasse esses dados
// não teria como desfazer o estrago.
//
// A identidade é injetada do mesmo jeito que `src/lib/db/rpc-adapter.ts` faz em
// produção — `request.jwt.claims` por `set_config`, escopo de transação. Testar
// por outro caminho validaria um contrato que a aplicação não usa.

import pg from "pg";

function lerConfiguracaoConexao() {
  const bruta = process.env.EMPRESA_DATABASE_URL?.trim();
  if (!bruta) {
    throw new Error(
      "EMPRESA_DATABASE_URL não está no ambiente. Rode os testes com:\n" +
      "  npm test",
    );
  }
  const url = new URL(bruta.startsWith("jdbc:") ? bruta.slice(5) : bruta);
  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    database: url.pathname.replace(/^\//, ""),
    user: process.env.USERNAME_DATABASE_URL?.trim() || url.username,
    password: process.env.PASSWORD_DATABASE_URL?.trim() || url.password,
    // Um teste travado é um teste que não avisa. Preferimos a falha explícita.
    connectionTimeoutMillis: 10_000,
    statement_timeout: 30_000,
  };
}

let pool;

export function obterPool() {
  pool ??= new pg.Pool({ ...lerConfiguracaoConexao(), max: 4 });
  return pool;
}

export async function encerrarPool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

/**
 * Executa `corpo` com as claims de uma sessão, e desfaz tudo ao final.
 *
 * `papel` é o que `sigav."FC_PAPEL_SESSAO"()` devolve e o que separa uma chamada
 * anônima de uma de serviço. `claims` extras (ex.: `sub`, `email`) entram no
 * mesmo objeto, como o adaptador monta.
 */
export async function comSessao(papel, claims, corpo) {
  const cliente = await obterPool().connect();
  try {
    await cliente.query("begin");

    const completas = { ...claims, role: papel };
    await cliente.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify(completas),
    ]);
    await cliente.query("select set_config('request.jwt.claim.role', $1, true)", [papel]);
    if (typeof completas.sub === "string") {
      await cliente.query("select set_config('request.jwt.claim.sub', $1, true)", [completas.sub]);
    }

    return await corpo(cliente);
  } finally {
    // `rollback` no finally, não no fim do try: um teste que falha no meio
    // ainda precisa devolver o banco ao estado anterior.
    await cliente.query("rollback").catch(() => {});
    cliente.release();
  }
}

/** Atalho para leitura sem identidade — o que a plataforma chama de anônimo. */
export function comoAnonimo(corpo) {
  return comSessao("anon", {}, corpo);
}

/** Atalho para o papel de serviço (cron, importação, fila de e-mail). */
export function comoServico(corpo) {
  return comSessao("service_role", {}, corpo);
}

/**
 * Uma pessoa real do banco que tenha conta de acesso vinculada.
 *
 * Os testes de jornada precisam de uma identidade que exista de verdade: um
 * `sub` inventado passaria por `fc_uid_sessao()` mas não casaria com
 * `TB_PESSOA.SQ_USUARIO_IDENTIDADE`, e as funções devolveriam "sem cadastro" em vez de
 * exercitarem o caminho que interessa.
 */
export async function pessoaComAcesso() {
  const { rows } = await obterPool().query(`
    select u."SQ_USUARIO" as auth_user_id,
           u."DS_EMAIL" as email,
           p."SQ_PESSOA" as person_id,
           p."NO_PESSOA" as full_name
    from sigav."TB_USUARIO_IDENTIDADE" u
    join sigav."TB_PESSOA" p
      on p."SQ_USUARIO_IDENTIDADE" = u."SQ_USUARIO"
    where p."ST_ATIVO"
    order by u."DT_INCLUSAO" nulls last
    limit 1
  `);
  if (!rows.length) {
    throw new Error("nenhuma pessoa com conta de acesso vinculada no banco de teste");
  }
  return rows[0];
}
