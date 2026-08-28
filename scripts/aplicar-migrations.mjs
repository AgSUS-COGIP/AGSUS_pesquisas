// Aplica as migrations versionadas de `supabase/migrations/` no banco apontado
// pelas variáveis de conexão da aplicação (hoje a réplica local; amanhã o
// db_dataware da empresa).
//
// Uso:
//   node --env-file=.env.local scripts/aplicar-migrations.mjs            (lista pendentes)
//   node --env-file=.env.local scripts/aplicar-migrations.mjs --aplicar
//   node --env-file=.env.local scripts/aplicar-migrations.mjs --registrar-existentes
//   node --env-file=.env.local scripts/aplicar-migrations.mjs --registrar-existentes=20260826193000,20260827123000
//
// POR QUE ESTE SCRIPT EXISTE: `supabase db push` não vale mais. Ele fala com o
// histórico em `supabase_migrations.schema_migrations`, que é um schema do
// Supabase e não veio junto quando o esquema passou para o db_dataware — lá a
// aplicação tem um schema só, `sigav`, e mais nada (`public`, `private`,
// `db_governanca`, `"DB_PESQUISAS"`, `auth` e `extensions` existiram por um
// tempo, até serem unificados entre 26 e 28/08/2026). Sem histórico, o push
// tentaria reaplicar as 192 migrations sobre objetos que já existem. O
// histórico passa a morar em `sigav.tb_migracao`, dentro do próprio schema da
// aplicação, e portanto viaja junto em toda cópia do banco.
//
// TRAVA DE CONCORRÊNCIA: o db_dataware é uma instância compartilhada com outras
// aplicações e tem escritores paralelos. O lock consultivo garante que dois
// runners (duas máquinas, um deploy e alguém no terminal) não apliquem a mesma
// migration ao mesmo tempo — o segundo espera, vê o histórico já atualizado e
// não faz nada.

import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIRETORIO_MIGRATIONS = path.join(RAIZ, "supabase", "migrations");

// Chave fixa e arbitrária do lock consultivo. Só precisa ser estável e não
// colidir com outra aplicação da instância; o valor em si não tem significado.
const CHAVE_LOCK = 8273401;

const SCHEMA = "sigav";

/**
 * Cria a tabela de histórico.
 *
 * RLS fica habilitada sem policy alguma para preservar o invariante que a
 * migração para `sigav` verifica ("nenhuma tabela do schema sem RLS"). Na
 * prática ela não é a barreira aqui: quem conecta é `usr_sip_app`, dono da
 * tabela, e dono não é submetido a RLS sem `force`. A barreira real é esta
 * tabela não estar exposta em nenhuma RPC — nada no app a lê ou escreve.
 */
const DDL_HISTORICO = `
create table if not exists ${SCHEMA}.tb_migracao (
  co_versao     text        not null,
  no_migracao   text        not null,
  ds_hash       text        not null,
  no_origem     text        not null default 'arquivo',
  dt_aplicacao  timestamptz not null default now(),
  constraint pk_tb_migracao primary key (co_versao),
  constraint ck_tb_migracao_origem check (no_origem in ('arquivo', 'registro-historico'))
);

alter table ${SCHEMA}.tb_migracao enable row level security;
revoke all on ${SCHEMA}.tb_migracao from public;

comment on table ${SCHEMA}.tb_migracao is
  'Histórico de migrations aplicadas. Substitui supabase_migrations.schema_migrations, que não existe no db_dataware. Mantido por scripts/aplicar-migrations.mjs.';
`;

function lerConfiguracaoConexao() {
  const bruta = process.env.EMPRESA_DATABASE_URL?.trim();
  if (!bruta) {
    console.error(
      "EMPRESA_DATABASE_URL não está no ambiente.\n" +
      "Rode com: node --env-file=.env.local scripts/aplicar-migrations.mjs",
    );
    process.exit(1);
  }

  // Aceita `jdbc:postgresql://` do mesmo modo que src/lib/db/pool.ts.
  const normalizada = bruta.startsWith("jdbc:") ? bruta.slice(5) : bruta;
  const url = new URL(normalizada);

  const user = process.env.USERNAME_DATABASE_URL?.trim() || url.username;
  const password = process.env.PASSWORD_DATABASE_URL?.trim() || url.password;
  if (!user || !password) {
    console.error("USERNAME_DATABASE_URL e PASSWORD_DATABASE_URL precisam estar no ambiente.");
    process.exit(1);
  }

  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    database: url.pathname.replace(/^\//, ""),
    user,
    password,
  };
}

/** `20260826180000_migrar_schema_sigav.sql` → versão e nome. */
function partirNomeDoArquivo(arquivo) {
  const semExtensao = arquivo.replace(/\.sql$/i, "");
  const separador = semExtensao.indexOf("_");
  return separador === -1
    ? { versao: semExtensao, nome: semExtensao }
    : { versao: semExtensao.slice(0, separador), nome: semExtensao.slice(separador + 1) };
}

async function lerMigrationsDoDisco() {
  const arquivos = (await readdir(DIRETORIO_MIGRATIONS))
    .filter((nome) => nome.toLowerCase().endsWith(".sql"))
    .sort();

  return Promise.all(arquivos.map(async (arquivo) => {
    const sql = await readFile(path.join(DIRETORIO_MIGRATIONS, arquivo), "utf8");
    const { versao, nome } = partirNomeDoArquivo(arquivo);
    return {
      arquivo,
      versao,
      nome,
      sql,
      hash: createHash("sha256").update(sql).digest("hex"),
    };
  }));
}

/** Escapa um literal de texto para interpolação — os valores aqui vêm de nomes
 *  de arquivo e hashes hex, mas interpolar sem escapar é hábito ruim. */
function literal(valor) {
  return `'${String(valor).replace(/'/g, "''")}'`;
}

/**
 * Executa o SQL da migration e registra o histórico na mesma ida ao banco.
 *
 * O `insert` é concatenado ao corpo em vez de virar uma chamada parametrizada
 * separada, e isso é deliberado: um Query simples com várias instruções roda
 * numa transação implícita, então um arquivo sem `begin`/`commit` próprio ganha
 * atomicidade de graça — se qualquer statement falhar, nem o efeito nem o
 * registro sobrevivem. Arquivos que abrem a própria transação continuam
 * funcionando; nesses, o registro entra logo depois, em autocommit.
 */
function montarSqlDeAplicacao({ sql, versao, nome, hash }) {
  const registro = `
insert into ${SCHEMA}.tb_migracao (co_versao, no_migracao, ds_hash, no_origem)
values (${literal(versao)}, ${literal(nome)}, ${literal(hash)}, 'arquivo');
`;
  return `${sql}\n${registro}`;
}

async function main() {
  const listaArgumentos = process.argv.slice(2);
  const argumentos = new Set(listaArgumentos);
  const aplicar = argumentos.has("--aplicar");
  const ignorarHash = argumentos.has("--ignorar-hash");

  // `--registrar-existentes` sozinho marca todas as pendentes; com uma lista de
  // versões, marca só aquelas. A forma com lista existe para o caso que aparece
  // a cada merge: a branch recebe migrations de `main` cujo efeito o banco já
  // tem (porque a réplica veio de produção, onde elas rodaram), misturadas com
  // outras que de fato faltam. Registrar o bloco inteiro esconderia as que
  // faltam; executá-lo inteiro falharia nas que já rodaram.
  const argumentoRegistro = listaArgumentos.find((a) => a.startsWith("--registrar-existentes"));
  const registrarExistentes = argumentoRegistro !== undefined;
  const versoesParaRegistrar = argumentoRegistro?.includes("=")
    ? argumentoRegistro.split("=")[1].split(",").map((v) => v.trim()).filter(Boolean)
    : null;

  if (aplicar && registrarExistentes) {
    console.error("Use --aplicar ou --registrar-existentes, não os dois.");
    process.exit(1);
  }

  const configuracao = lerConfiguracaoConexao();
  const cliente = new pg.Client(configuracao);
  // `raise notice` é como uma migration comunica decisão condicional (ex.:
  // "schema public mantido — instância compartilhada"); sem este handler o
  // aviso morre dentro do driver.
  cliente.on("notice", (aviso) => console.log(`    aviso: ${aviso.message}`));
  await cliente.connect();

  console.log(`Banco: ${configuracao.user}@${configuracao.host}:${configuracao.port}/${configuracao.database}\n`);

  try {
    await cliente.query("select pg_advisory_lock($1)", [CHAVE_LOCK]);
    await cliente.query(DDL_HISTORICO);

    const doDisco = await lerMigrationsDoDisco();
    const { rows: aplicadas } = await cliente.query(
      `select co_versao, no_migracao, ds_hash from ${SCHEMA}.tb_migracao`,
    );
    const porVersao = new Map(aplicadas.map((linha) => [linha.co_versao, linha]));

    // Divergência de hash é sinal de que um arquivo já aplicado foi editado.
    // Corrigir migration aplicada editando o arquivo é justamente o que o
    // README do diretório proíbe — a correção pertence a uma migration nova.
    const alteradas = doDisco.filter((m) => {
      const registro = porVersao.get(m.versao);
      return registro && registro.ds_hash !== m.hash;
    });

    if (alteradas.length && !ignorarHash) {
      console.error("Migrations já aplicadas cujo arquivo mudou desde a aplicação:\n");
      for (const m of alteradas) console.error(`  ${m.arquivo}`);
      console.error(
        "\nCorreção de migration aplicada entra numa migration nova, não na edição do arquivo.\n" +
        "Se a diferença for cosmética (comentário, espaço), rode de novo com --ignorar-hash.",
      );
      process.exit(1);
    }

    const pendentes = doDisco.filter((m) => !porVersao.has(m.versao));

    if (registrarExistentes) {
      if (!pendentes.length) {
        console.log("Nada a registrar: o histórico já cobre todas as migrations do diretório.");
        return;
      }

      const alvo = versoesParaRegistrar
        ? pendentes.filter((m) => versoesParaRegistrar.includes(m.versao))
        : pendentes;

      if (versoesParaRegistrar) {
        const naoEncontradas = versoesParaRegistrar.filter(
          (v) => !pendentes.some((m) => m.versao === v),
        );
        if (naoEncontradas.length) {
          console.error(
            `Estas versões não estão pendentes (já registradas ou inexistentes): ${naoEncontradas.join(", ")}`,
          );
          process.exit(1);
        }
      }

      console.log(`Registrando ${alvo.length} migration(s) como aplicadas, SEM executar o SQL.\n`);
      for (const m of alvo) {
        await cliente.query(
          `insert into ${SCHEMA}.tb_migracao (co_versao, no_migracao, ds_hash, no_origem)
           values ($1, $2, $3, 'registro-historico')`,
          [m.versao, m.nome, m.hash],
        );
        console.log(`  registrada  ${m.arquivo}`);
      }
      const restantes = pendentes.length - alvo.length;
      console.log(
        "\nO histórico agora reflete o esquema que já está no banco." +
        (restantes
          ? ` Ainda há ${restantes} pendente(s) para aplicar com --aplicar.`
          : " Daqui em diante, migration nova entra com --aplicar."),
      );
      return;
    }

    if (!pendentes.length) {
      console.log(`Nenhuma migration pendente. ${aplicadas.length} já aplicada(s).`);
      return;
    }

    if (!aplicar) {
      console.log(`${pendentes.length} migration(s) pendente(s):\n`);
      for (const m of pendentes) console.log(`  ${m.arquivo}`);
      console.log(
        "\nNada foi executado. Para aplicar:  --aplicar\n" +
        "Se estes objetos JÁ existem no banco (esquema herdado), use:  --registrar-existentes",
      );
      return;
    }

    console.log(`Aplicando ${pendentes.length} migration(s):\n`);
    for (const m of pendentes) {
      process.stdout.write(`  ${m.arquivo} ... `);
      try {
        await cliente.query(montarSqlDeAplicacao(m));
        console.log("ok");
      } catch (erro) {
        console.log("FALHOU");
        console.error(`\n${erro.message}`);
        if (erro.detail) console.error(erro.detail);
        if (erro.hint) console.error(`Dica: ${erro.hint}`);
        console.error(
          `\nParei em ${m.arquivo}. As anteriores continuam aplicadas e registradas; ` +
          "esta não deixou efeito (a transação implícita reverteu).",
        );
        process.exitCode = 1;
        return;
      }
    }
    console.log("\nTodas aplicadas.");
  } finally {
    // O unlock é por garantia de clareza: encerrar a sessão já libera o lock.
    await cliente.query("select pg_advisory_unlock($1)", [CHAVE_LOCK]).catch(() => {});
    await cliente.end();
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
