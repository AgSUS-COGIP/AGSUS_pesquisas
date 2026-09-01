// Regressão do modelo de autorização por permissão contra o banco local.
// Toda alteração ocorre dentro de `comSessao` e termina em rollback.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  obterPool,
  encerrarPool,
  comSessao,
  comoAnonimo,
  comoServico,
  pessoaComAcesso,
} from "../apoio/banco.mjs";

after(encerrarPool);

const PERMISSOES = [
  "HOME",
  "SURVEYS",
  "DASHBOARDS",
  "TEAM",
  "ONLINE_PRESENCE",
  "ADMIN_SURVEYS",
  "ADMIN_PARTICIPANTS",
  "ADMIN_TEAMS",
  "ADMIN_ACCESS",
  "ADMIN_IMPORT",
];

let pessoa;
before(async () => {
  pessoa = await pessoaComAcesso();
});

function comoPessoa(corpo) {
  return comSessao(
    "authenticated",
    { sub: pessoa.auth_user_id, email: pessoa.email },
    corpo,
  );
}

async function definirPermissoesNaTransacao(cliente, permissoes) {
  await cliente.query(
    `delete from sigav."RL_PESSOA_MODULO" where "SQ_PESSOA" = $1`,
    [pessoa.person_id],
  );
  await cliente.query(
    `insert into sigav."RL_PESSOA_MODULO" ("SQ_PESSOA", "CO_MODULO", "ST_PERMITIDO")
     select $1, pm."CO_MODULO", pm."CO_MODULO" = any($2::text[])
       from sigav."TB_MODULO_PLATAFORMA" pm
      where pm."ST_ATIVO"`,
    [pessoa.person_id, permissoes],
  );
}

test("o catálogo contém as permissões funcionais, sem perfis técnicos adicionais", async () => {
  const { rows } = await obterPool().query(
    `select "CO_MODULO" from sigav."TB_MODULO_PLATAFORMA"
      where "ST_ATIVO" order by "NU_ORDEM", "CO_MODULO"`,
  );
  assert.deepEqual(rows.map((linha) => linha.CO_MODULO), PERMISSOES);
});

// Sucede "nenhuma atribuição funcional permanece vigente": desde
// 20260828150000 não há mais o que estar vigente, porque as tabelas de perfil
// saíram do banco. O que resta verificar é que ninguém as recriou — perfil de
// acesso tem uma morada só, `person_module_permissions`, e o histórico ficou em
// `audit_events`.
test("o banco não guarda mais tabela nem função de perfil", async () => {
  const { rows } = await obterPool().query(`
    select
      (select count(*)::integer
         from information_schema.tables
        where table_schema = 'sigav'
          and table_name in ('system_roles', 'person_role_assignments',
                             'role_module_permissions')) as tabelas,
      (select count(*)::integer
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'sigav'
          and p.proname in ('fc_definir_perfil_pessoa', 'list_access_workspace')) as funcoes
  `);
  assert.equal(rows[0].tabelas, 0, "tabela de perfil legada voltou ao schema");
  assert.equal(rows[0].funcoes, 0, "função de perfil legada voltou ao schema");
});

test("o histórico das atribuições sobreviveu em audit_events", async () => {
  const { rows } = await obterPool().query(`
    select count(*)::integer as arquivadas,
           count(*) filter (where "DS_DADO_ANTERIOR" ? 'roleCode'
                              and "DS_DADO_ANTERIOR" ? 'personId')::integer as completas
      from sigav."TL_EVENTO_AUDITORIA"
     where "TP_EVENTO" = 'ROLE_LEGACY_ARCHIVED'
  `);
  assert.ok(rows[0].arquivadas > 0, "nenhuma atribuição arquivada");
  assert.equal(
    rows[0].completas,
    rows[0].arquivadas,
    "evento arquivado sem roleCode/personId não permite reconstruir o histórico",
  );
});

test("pessoa autenticada sem configuração recebe somente o piso obrigatório", async () => {
  await comoPessoa(async (cliente) => {
    await definirPermissoesNaTransacao(cliente, []);
    await cliente.query(
      `delete from sigav."RL_PESSOA_MODULO" where "SQ_PESSOA" = $1`,
      [pessoa.person_id],
    );

    const { rows } = await cliente.query(
      `select sigav."FC_OBTER_CONTEXTO_PLATAFORMA"() as contexto`,
    );
    assert.equal(rows[0].contexto.technicalRole, "authenticated");
    assert.deepEqual(rows[0].contexto.roles, ["AUTHENTICATED"]);
    assert.deepEqual(rows[0].contexto.modules, ["HOME", "SURVEYS"]);
  });
});

test("contexto e helper usam diretamente as permissões da pessoa", async () => {
  await comoPessoa(async (cliente) => {
    const esperadas = ["HOME", "SURVEYS", "DASHBOARDS", "TEAM", "ONLINE_PRESENCE"];
    await definirPermissoesNaTransacao(cliente, esperadas);

    const { rows: contextoRows } = await cliente.query(
      `select sigav."FC_OBTER_CONTEXTO_PLATAFORMA"() as contexto`,
    );
    assert.deepEqual(contextoRows[0].contexto.modules, esperadas);

    const { rows: portoes } = await cliente.query(`
      select pm."CO_MODULO", sigav."FC_TEM_MODULO"(pm."CO_MODULO") as permitido
        from sigav."TB_MODULO_PLATAFORMA" pm
       where pm."ST_ATIVO"
       order by pm."NU_ORDEM", pm."CO_MODULO"
    `);
    assert.deepEqual(
      portoes.filter((linha) => linha.permitido).map((linha) => linha.CO_MODULO),
      esperadas,
    );
  });
});

test("helpers legados traduzem nomes de perfil para capacidades", async () => {
  await comoPessoa(async (cliente) => {
    await definirPermissoesNaTransacao(cliente, ["HOME", "SURVEYS", "TEAM", "DASHBOARDS"]);
    const { rows } = await cliente.query(`
      select sigav."FC_TEM_PAPEL_ATIVO"('MANAGER') as gestor,
             sigav."FC_TEM_PAPEL_ATIVO"('LEADER') as avaliador,
             sigav."FC_TEM_PAPEL_ATIVO"('ADMINISTRATOR') as administrador
    `);
    assert.deepEqual(rows[0], { gestor: true, avaliador: true, administrador: false });
  });
});

test("ADMIN_TEAMS autoriza jornadas funcionais sem conceder ADMIN_ACCESS", async () => {
  await comoPessoa(async (cliente) => {
    await definirPermissoesNaTransacao(cliente, ["HOME", "SURVEYS", "ADMIN_TEAMS"]);
    const { rows } = await cliente.query(`
      select sigav."FC_TEM_MODULO"('ADMIN_TEAMS') as equipes,
             sigav."FC_E_ADMINISTRADOR"() as acessos,
             sigav."FC_LISTAR_CICLOS_LIDERANCA_ADM"() as ciclos
    `);
    assert.equal(rows[0].equipes, true);
    assert.equal(rows[0].acessos, false);
    assert.ok(Array.isArray(rows[0].ciclos));
  });
});

test("a área administrativa devolve role técnica, catálogo e permissões por pessoa", async () => {
  await comoPessoa(async (cliente) => {
    await definirPermissoesNaTransacao(cliente, ["HOME", "SURVEYS", "ADMIN_ACCESS"]);
    const { rows } = await cliente.query(
      `select sigav."FC_LISTAR_ACESSOS_PAGINADOS"('', 10, 0) as acessos`,
    );
    const acessos = rows[0].acessos;
    assert.equal(acessos.technicalRole, "authenticated");
    assert.ok(acessos.permissions.some((item) => item.code === "ADMIN_ACCESS"));
    assert.ok(acessos.people.every((item) => Array.isArray(item.permissions)));
  });
});

test("a RPC substitui permissões e mantém HOME e SURVEYS", async () => {
  await comoPessoa(async (cliente) => {
    await definirPermissoesNaTransacao(cliente, ["HOME", "SURVEYS", "ADMIN_ACCESS"]);
    const { rows } = await cliente.query(
      `select sigav."FC_DEFINIR_PERMISSOES_PESSOA"($1, $2::text[]) as resultado`,
      [pessoa.person_id, ["admin_access", "team"]],
    );
    assert.deepEqual(
      rows[0].resultado.permissions,
      ["HOME", "SURVEYS", "TEAM", "ADMIN_ACCESS"],
    );
  });
});

test("a RPC preserva o piso e impede retirar a própria administração", async () => {
  await assert.rejects(
    () => comoPessoa(async (cliente) => {
      await definirPermissoesNaTransacao(cliente, ["HOME", "SURVEYS", "ADMIN_ACCESS"]);
      await cliente.query(
        `select sigav."FC_DEFINIR_PERMISSOES_PESSOA"($1, $2::text[])`,
        [pessoa.person_id, ["TEAM"]],
      );
    }),
    /própria permissão de administrar acessos/i,
  );
});

test("uma credencial física sustenta a role das pessoas e os canais internos", async () => {
  const identidades = await Promise.all([
    comoAnonimo(async (cliente) => (await cliente.query(
      `select current_user as usuario, sigav."FC_PAPEL_SESSAO"() as papel`,
    )).rows[0]),
    comoPessoa(async (cliente) => (await cliente.query(
      `select current_user as usuario, sigav."FC_PAPEL_SESSAO"() as papel`,
    )).rows[0]),
    comoServico(async (cliente) => (await cliente.query(
      `select current_user as usuario, sigav."FC_PAPEL_SESSAO"() as papel`,
    )).rows[0]),
  ]);

  assert.equal(new Set(identidades.map((item) => item.usuario)).size, 1);
  assert.deepEqual(
    identidades.map((item) => item.papel).sort(),
    ["anon", "authenticated", "service_role"],
  );

  const { rows } = await obterPool().query(
    "select rolsuper from pg_roles where rolname = current_user",
  );
  assert.equal(rows[0].rolsuper, false, "a credencial da aplicação não pode ser superusuária");
});
