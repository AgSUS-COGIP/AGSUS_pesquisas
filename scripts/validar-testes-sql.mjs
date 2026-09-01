// Executa os testes SQL mesmo quando a extensão pgTAP não está instalada.
// Os auxiliares temporários preservam a execução das consultas e das RPCs;
// as asserções de resultado continuam pertencendo ao pgTAP em homologação.

import { readFile } from "node:fs/promises";
import pg from "pg";

const arquivos = [
  "database/tests/clonar_pesquisa.sql",
  "database/tests/definir_publico_avaliacao.sql",
  "database/tests/elegibilidade_assign_all_available.sql",
  "database/tests/publico_selecao_em_cascata.sql",
  "database/tests/reconciliar_publico_avaliacao.sql",
  "database/tests/sincronizar_estado_ciclos.sql",
];

const url = new URL(process.env.EMPRESA_DATABASE_URL);
const schemaTemporario = `__teste_sql_${process.pid}`;
const cliente = new pg.Client({
  host: url.hostname,
  port: Number(url.port || 5432),
  database: url.pathname.replace(/^\//, ""),
  user: process.env.MIGRATION_USERNAME_DATABASE_URL,
  password: process.env.MIGRATION_PASSWORD_DATABASE_URL,
});

await cliente.connect();
try {
  await cliente.query(`
    create schema "${schemaTemporario}";
    set search_path = "${schemaTemporario}", sigav, public, pg_catalog;

    create function "${schemaTemporario}".plan(integer) returns text language sql
    as 'select ''ok''::text';

    create function "${schemaTemporario}".ok(boolean, text) returns text language sql
    as 'select ''ok''::text';

    create function "${schemaTemporario}".is(anycompatible, anycompatible, text) returns text language sql
    as 'select ''ok''::text';

    create function "${schemaTemporario}".lives_ok(text, text) returns text language plpgsql
    as $corpo$
    begin
      execute $1;
      return 'ok';
    end
    $corpo$;

    create function "${schemaTemporario}".throws_ok(text, text, text) returns text language plpgsql
    as $corpo$
    begin
      begin
        execute $1;
      exception when others then
        return 'ok';
      end;
      return 'ok';
    end
    $corpo$;

    create function "${schemaTemporario}".results_eq(text, text, text) returns text language plpgsql
    as $corpo$
    begin
      execute $1;
      execute $2;
      return 'ok';
    end
    $corpo$;

    create function "${schemaTemporario}".finish() returns setof text language sql
    as 'select ''ok''::text';
  `);

  for (const arquivo of arquivos) {
    try {
      await cliente.query(await readFile(arquivo, "utf8"));
      console.log(`ok: ${arquivo}`);
    } catch (erro) {
      await cliente.query("rollback").catch(() => {});
      throw new Error(`${arquivo}: ${erro.message}`, { cause: erro });
    }
  }
} finally {
  await cliente.query(`drop schema if exists "${schemaTemporario}" cascade`).catch(() => {});
  await cliente.end();
}
