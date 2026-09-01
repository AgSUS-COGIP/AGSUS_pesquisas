// Topologia do banco depois da unificação: `sigav` é o único schema.
//
// O corpo das verificações mora em `database/tests/invariantes_schema.sql`, e
// este arquivo apenas o executa. São dois consumidores com necessidades
// diferentes — o SQL puro roda com psql contra produção, onde não há Node; a
// suíte precisa do mesmo veredito dentro do runner — e manter as regras em dois
// lugares garantiria que um dia discordassem.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { obterPool, encerrarPool } from "../apoio/banco.mjs";

after(encerrarPool);

test("invariantes de schema passam contra o banco configurado", async () => {
  const sql = await readFile(
    new URL("../../database/tests/invariantes_schema.sql", import.meta.url),
    "utf8",
  );

  const cliente = await obterPool().connect();
  const avisos = [];
  cliente.on("notice", (n) => avisos.push(n.message));

  try {
    // O arquivo é um `do $$` que levanta exceção na primeira violação; chegar
    // ao fim sem erro é o próprio veredito.
    await cliente.query(sql);
  } finally {
    cliente.release();
  }

  assert.ok(
    avisos.some((a) => a.includes("todos os invariantes passaram")),
    `os invariantes não chegaram ao fim. Avisos: ${avisos.join(" | ")}`,
  );
});

test("todas as migrations versionadas constam no histórico do banco local", async () => {
  const arquivos = await readdir(
    new URL("../../database/migrations/", import.meta.url),
  );
  const versoesDoDisco = arquivos
    .filter((nome) => nome.endsWith(".sql"))
    .map((nome) => nome.split("_", 1)[0])
    .sort();

  const { rows } = await obterPool().query(
    `select "CO_VERSAO" from sigav."TB_MIGRACAO" order by "CO_VERSAO"`,
  );
  const versoesDoBanco = rows.map((linha) => linha.CO_VERSAO);

  assert.deepEqual(
    versoesDoBanco,
    versoesDoDisco,
    "o histórico do banco e o diretório de migrations não cobrem as mesmas versões",
  );
});

test("nenhum schema de aplicação além de sigav", async () => {
  const { rows } = await obterPool().query(`
    select nspname
    from pg_namespace
    where nspname not like 'pg\\_%'
      and nspname not in ('information_schema', 'sigav', 'public', 'sip', 'sigepsi')
    order by nspname
  `);
  assert.deepEqual(
    rows.map((r) => r.nspname),
    [],
    "sobrou schema da aplicação fora de sigav",
  );
});

test("as funções de claims da sessão existem com o nome novo", async () => {
  const { rows } = await obterPool().query(`
    select proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'sigav'
      and proname in ('FC_UID_SESSAO', 'FC_PAPEL_SESSAO', 'FC_CLAIMS_SESSAO')
    order by proname
  `);
  assert.deepEqual(
    rows.map((r) => r.proname),
    ["FC_CLAIMS_SESSAO", "FC_PAPEL_SESSAO", "FC_UID_SESSAO"],
  );
});

test("as tabelas de identidade estão em sigav e tb_pessoa continua ligada a elas", async () => {
  const { rows } = await obterPool().query(`
    select con.conname
    from pg_constraint con
    join pg_class src on src.oid = con.conrelid
    join pg_class tgt on tgt.oid = con.confrelid
    join pg_namespace n on n.oid = tgt.relnamespace
    where con.contype = 'f'
      and n.nspname = 'sigav'
      and tgt.relname = 'TB_USUARIO_IDENTIDADE'
      and src.relname = 'TB_PESSOA'
  `);
  assert.equal(rows.length, 1, "tb_pessoa perdeu a FK para tb_usuario_identidade");
});
