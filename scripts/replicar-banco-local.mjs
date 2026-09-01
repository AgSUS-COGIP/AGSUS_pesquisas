// Replica os schemas da aplicação de db_dataware (banco da empresa, via VPN)
// para um Postgres local em Docker, para que o desenvolvimento não dependa de
// VPN ativa.
//
// Uso:
//   node --env-file=.env.local scripts/replicar-banco-local.mjs
//
// Requisitos: Docker rodando, container `agsus-local` (postgres:16.13) de pé e
// VPN conectada no host no momento da execução.
//
// Por que dump/restore dentro do container: o pg_dump da imagem é 16.13,
// exatamente a versão do servidor de origem, e assim a senha nunca aparece em
// linha de comando no host — é passada ao processo pelo ambiente.
//
// O que É copiado: só `sigav`. A aplicação passou a ter um schema único — as
// três unificações de 27/08 e a de 28/08 trouxeram para dentro dele os helpers
// de RLS (antes em `private`), o catálogo de conformidade (`db_governanca`), as
// views institucionais ("DB_PESQUISAS") e as contas de acesso (`auth.users` e
// `auth.identities`, hoje `tb_usuario_identidade` e `tb_identidade_oauth`).
// O que NÃO é copiado: sip (130 MB) e sigepsi (34 MB), aplicações de terceiros
// que dividem a mesma instância e não têm relação com este sistema — nenhuma
// função ou FK de sigav as referencia.

import { spawn } from "node:child_process";

const CONTAINER = "agsus-local";
const ORIGEM_HOST = "10.200.10.3";
const ORIGEM_PORTA = "5432";
const ORIGEM_DB = "db_dataware";
const DESTINO_DB = "db_dataware";
// Localmente a credencial única da empresa (usr_sip_app) é separada em duas:
// migration_user (dona, DDL) e app_user (runtime). O dump restaurado pertence
// à dona; o app_user é criado depois por separar-usuarios-app-e-migration.sql.
const DESTINO_OWNER = "migration_user";
const SCHEMAS = ["sigav"];
const CAMINHO_DUMP = "/tmp/dataware.dump";

function lerAmbiente() {
  const senha = process.env.PASSWORD_DATABASE_URL?.trim();
  const usuario = process.env.USERNAME_DATABASE_URL?.trim();
  if (!senha || !usuario) {
    console.error(
      "USERNAME_DATABASE_URL e PASSWORD_DATABASE_URL precisam estar no ambiente.\n" +
      "Rode com: node --env-file=.env.local scripts/replicar-banco-local.mjs",
    );
    process.exit(1);
  }
  return { usuario, senha };
}

/** Executa um comando e resolve com o código de saída, repassando a saída ao console. */
function executar(comando, argumentos, { env, stdin } = {}) {
  return new Promise((resolve, reject) => {
    const filho = spawn(comando, argumentos, {
      stdio: [stdin ? "pipe" : "ignore", "pipe", "pipe"],
      env: env ? { ...process.env, ...env } : process.env,
    });

    let saida = "";
    filho.stdout.on("data", (d) => { saida += d; process.stdout.write(d); });
    filho.stderr.on("data", (d) => { saida += d; process.stderr.write(d); });

    if (stdin) {
      filho.stdin.write(stdin);
      filho.stdin.end();
    }

    filho.on("error", reject);
    filho.on("close", (codigo) => resolve({ codigo, saida }));
  });
}

/** docker exec, com as variáveis de conexão passadas pelo ambiente do processo. */
function dockerExec(argumentos, { comSenha = false, stdin = null, usuario, senha } = {}) {
  const flags = ["exec"];
  if (stdin) flags.push("-i");
  if (comSenha) flags.push("-e", "PGPASSWORD", "-e", "PGUSER");
  flags.push(CONTAINER, ...argumentos);

  const env = comSenha ? { PGPASSWORD: senha, PGUSER: usuario } : undefined;
  return executar("docker", flags, { env, stdin });
}

async function psqlLocal(sql, { banco = "postgres" } = {}) {
  return dockerExec(["psql", "-U", "postgres", "-d", banco, "-v", "ON_ERROR_STOP=1", "-q"], { stdin: sql });
}

async function main() {
  const { usuario, senha } = lerAmbiente();

  console.log("== 1/4 Conferindo o container ==");
  const status = await executar("docker", ["inspect", CONTAINER, "--format", "{{.State.Status}}"]);
  if (status.codigo !== 0 || !status.saida.includes("running")) {
    console.error(`\nO container "${CONTAINER}" não está rodando. Suba-o antes de replicar.`);
    process.exit(1);
  }

  console.log("\n== 2/4 Preparando o banco de destino ==");
  // Recriar do zero é deliberado: restaurar sobre um schema já povoado deixaria
  // objetos órfãos de uma cópia anterior (função removida na origem continuaria
  // viva aqui) e produziria um ambiente que não corresponde à produção.
  await psqlLocal(`
    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = '${DESTINO_OWNER}') then
        create role ${DESTINO_OWNER} login password 'dev_local_only';
      end if;
    end;
    $$;
  `);
  // DROP/CREATE DATABASE não roda dentro de transação nem com o banco em uso.
  await dockerExec(["psql", "-U", "postgres", "-c",
    `select pg_terminate_backend(pid) from pg_stat_activity where datname = '${DESTINO_DB}' and pid <> pg_backend_pid()`]);
  await dockerExec(["psql", "-U", "postgres", "-c", `drop database if exists ${DESTINO_DB}`]);
  const criado = await dockerExec(["psql", "-U", "postgres", "-c",
    `create database ${DESTINO_DB} owner ${DESTINO_OWNER}`]);
  if (criado.codigo !== 0) {
    console.error("\nFalhou ao criar o banco de destino.");
    process.exit(1);
  }
  // Nenhuma extensão precisa ser recriada aqui. O único uso de pgcrypto era
  // `digest(token,'sha256')`, trocado pelo `sha256()` nativo de `pg_catalog` em
  // 20260828100000; `gen_random_uuid()` também é nativa desde o PostgreSQL 13.
  // Se a origem ainda for anterior a essa migration, a cópia chega com as três
  // funções de sessão anônima citando `extensions.digest` e se conserta sozinha
  // ao rodar `aplicar-migrations.mjs`, que é o passo seguinte deste fluxo.

  console.log("\n== 3/4 Copiando de db_dataware (VPN precisa estar ativa) ==");
  const argsSchemas = SCHEMAS.flatMap((s) => ["-n", s]);
  const dump = await dockerExec([
    "pg_dump",
    "-h", ORIGEM_HOST, "-p", ORIGEM_PORTA, "-d", ORIGEM_DB,
    ...argsSchemas,
    // Sem privilégios nem donos da origem: os roles de lá (e a ausência deles)
    // não fazem sentido aqui, e a autorização real vive dentro das funções.
    "--no-privileges", "--no-owner",
    "-Fc", "-f", CAMINHO_DUMP,
  ], { comSenha: true, usuario, senha });

  if (dump.codigo !== 0) {
    console.error("\nO dump falhou. Confira se a VPN está conectada.");
    process.exit(1);
  }
  const tamanho = await dockerExec(["bash", "-c", `du -h ${CAMINHO_DUMP} | cut -f1`]);
  console.log(`Dump gerado: ${tamanho.saida.trim()}`);

  console.log("\n== 4/4 Restaurando no banco local ==");
  const restore = await dockerExec([
    "pg_restore", "-U", "postgres", "-d", DESTINO_DB,
    "--no-privileges", "--no-owner",
    "--role", DESTINO_OWNER,
    CAMINHO_DUMP,
  ]);
  // pg_restore devolve código diferente de zero por avisos (ex.: comentário em
  // extensão que ele não pode recriar). O que decide é a conferência abaixo.
  if (restore.codigo !== 0) {
    console.log("(pg_restore terminou com avisos — a conferência abaixo é o que vale)");
  }

  console.log("\n== Conferência ==");
  await dockerExec(["psql", "-U", "postgres", "-d", DESTINO_DB, "-c", `
    select 'tabelas em sigav' as item, count(*)::text as valor
      from information_schema.tables where table_schema = 'sigav'
    union all select 'funcoes em sigav', count(*)::text
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'sigav'
    union all select 'linhas em sigav."TB_PESSOA"', count(*)::text from sigav."TB_PESSOA"
    union all select 'contas em tb_usuario_identidade', count(*)::text from sigav."TB_USUARIO_IDENTIDADE"
    union all select 'funcoes de claims da sessao', count(*)::text
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'sigav' and p.proname in ('FC_UID_SESSAO','FC_PAPEL_SESSAO','FC_CLAIMS_SESSAO')
    union all select 'schemas alem de sigav (deve ser 0)', count(*)::text
      from pg_namespace where nspname not like 'pg_%'
        and nspname not in ('information_schema', 'sigav')
    union all select 'dono das tabelas de sigav', string_agg(distinct tableowner, ', ')
      from pg_tables where schemaname = 'sigav';
  `]);

  console.log(`
Pronto. Falta UM passo: o dump da empresa não traz o app_user nem as policies
de RLS dele — recrie a arquitetura de três roles (idempotente):

  docker exec -i ${CONTAINER} psql -U postgres -d ${DESTINO_DB} -v ON_ERROR_STOP=1 \\
    < scripts/separar-usuarios-app-e-migration.sql

Depois, no .env.local (runtime e DDL separados):

  EMPRESA_DATABASE_URL=postgresql://localhost:55432/${DESTINO_DB}
  USERNAME_DATABASE_URL=app_user
  PASSWORD_DATABASE_URL=dev_local_only
  MIGRATION_USERNAME_DATABASE_URL=${DESTINO_OWNER}
  MIGRATION_PASSWORD_DATABASE_URL=dev_local_only

Guarde as linhas da empresa (as do 10.200.10.3) comentadas ao lado, para poder
voltar ao banco de produção quando precisar conferir algo lá.
`);
}

main().catch((erro) => {
  console.error("\nFalhou:", erro.message);
  process.exitCode = 1;
});
