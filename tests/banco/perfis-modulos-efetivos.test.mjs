// Casos de borda de `FC_MODULOS_EFETIVOS` e `FC_TEM_MODULO` — a origem de toda
// autorização de interface da plataforma.
//
// POR QUE ESTE ARQUIVO EXISTE, SE `perfis.test.mjs` JÁ TESTA PERMISSÕES. Aquele
// arquivo cobre o caminho normal: ninguém configurado recebe o piso, quem tem
// permissão vê o módulo. O que não estava coberto é a diferença entre "não ter
// linha" e "ter linha negando", que no corpo da função é isto:
//
//   filter (where coalesce(pmp."ST_PERMITIDO", pm."CO_MODULO" in ('HOME','SURVEYS')))
//
// O piso institucional é o SEGUNDO argumento de um `coalesce`. Ou seja: ele é o
// padrão para ausência de linha, não uma garantia. Uma linha com
// `ST_PERMITIDO = false` em HOME retira HOME de uma pessoa ativa — e é assim
// que `FC_DEFINIR_PERMISSOES_PESSOA` grava, porque ela escreve as dez linhas
// sempre, seis delas negando. A leitura ingênua ("HOME e SURVEYS são o piso,
// logo ninguém fica sem eles") está errada, e o custo de descobrir isso em
// produção é alguém trancado fora da própria tela inicial.
//
// REGRA HERDADA DE `tests/apoio/banco.mjs`: nenhum teste grava. Tudo acontece
// dentro de transação que termina em rollback.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  obterPool,
  encerrarPool,
  comSessao,
  comoAnonimo,
  comoServico,
  pessoasComAcesso,
} from "../apoio/banco.mjs";
import { PLATFORM_MODULES } from "../../src/lib/platform-modules.ts";

after(encerrarPool);

// Fatia própria de pessoa: ver o comentário de `pessoasComAcesso` sobre o
// deadlock que dois arquivos compartilhando a mesma pessoa produzem.
let pessoa;
before(async () => {
  [pessoa] = await pessoasComAcesso(1, 0);
});

/** Sessão da pessoa de teste — o que `FC_TEM_MODULO` precisa para resolver. */
function comoPessoa(corpo) {
  return comSessao("authenticated", { sub: pessoa.auth_user_id, email: pessoa.email }, corpo);
}

async function semNenhumaLinha(cliente) {
  await cliente.query(`delete from sigav."RL_PESSOA_MODULO" where "SQ_PESSOA" = $1`, [
    pessoa.person_id,
  ]);
}

async function definir(cliente, decisoes) {
  await semNenhumaLinha(cliente);
  for (const [modulo, permitido] of Object.entries(decisoes)) {
    await cliente.query(
      `insert into sigav."RL_PESSOA_MODULO" ("SQ_PESSOA", "CO_MODULO", "ST_PERMITIDO")
       values ($1, $2, $3)`,
      [pessoa.person_id, modulo, permitido],
    );
  }
}

function modulosDe(cliente, pessoaId = pessoa.person_id) {
  return cliente
    .query(`select sigav."FC_MODULOS_EFETIVOS"($1) as modulos`, [pessoaId])
    .then(({ rows }) => rows[0].modulos);
}

test("sem nenhuma linha, o piso institucional responde", async () => {
  await comoPessoa(async (cliente) => {
    await semNenhumaLinha(cliente);
    assert.deepEqual(await modulosDe(cliente), ["HOME", "SURVEYS"]);
  });
});

test("linha negando HOME retira HOME, apesar de HOME ser o piso", async () => {
  // Este é o comportamento real, e é contraintuitivo. Se algum dia o piso
  // passar a ser inviolável, é aqui que a mudança aparece — e a decisão vai ter
  // de ser deliberada, porque este teste vai falhar.
  await comoPessoa(async (cliente) => {
    await definir(cliente, { HOME: false });
    assert.deepEqual(await modulosDe(cliente), ["SURVEYS"]);
  });
});

test("negar os dois módulos do piso deixa a pessoa sem nada", async () => {
  await comoPessoa(async (cliente) => {
    await definir(cliente, { HOME: false, SURVEYS: false });
    assert.deepEqual(await modulosDe(cliente), []);
  });
});

test("negar um módulo que não é do piso não muda o piso", async () => {
  await comoPessoa(async (cliente) => {
    await definir(cliente, { ADMIN_ACCESS: false, DASHBOARDS: false });
    assert.deepEqual(await modulosDe(cliente), ["HOME", "SURVEYS"]);
  });
});

test("permitir todo o catálogo devolve todo o catálogo", async () => {
  await comoPessoa(async (cliente) => {
    await cliente.query(
      `insert into sigav."RL_PESSOA_MODULO" ("SQ_PESSOA", "CO_MODULO", "ST_PERMITIDO")
       select $1, pm."CO_MODULO", true
         from sigav."TB_MODULO_PLATAFORMA" pm
        where pm."ST_ATIVO"
       on conflict ("SQ_PESSOA", "CO_MODULO")
         do update set "ST_PERMITIDO" = true`,
      [pessoa.person_id],
    );
    const { rows } = await cliente.query(
      `select "CO_MODULO" from sigav."TB_MODULO_PLATAFORMA"
        where "ST_ATIVO" order by "NU_ORDEM", "CO_MODULO"`,
    );
    assert.deepEqual(
      await modulosDe(cliente),
      rows.map((linha) => linha.CO_MODULO),
    );
  });
});

test("a ordem devolvida é a do menu, não a alfabética", async () => {
  // `array_agg(... order by pm."NU_ORDEM", pm."CO_MODULO")`. A interface usa
  // essa ordem direto na barra lateral: ordenar de novo no frontend criaria uma
  // segunda fonte de verdade sobre o menu.
  await comoPessoa(async (cliente) => {
    await definir(cliente, { ADMIN_IMPORT: true, DASHBOARDS: true });
    assert.deepEqual(await modulosDe(cliente), [
      "HOME",
      "SURVEYS",
      "DASHBOARDS",
      "ADMIN_IMPORT",
    ]);
  });
});

test("desligar um módulo do catálogo tira ele de todo mundo, sem apagar permissão", async () => {
  // É o que a descrição de `TB_MODULO_PLATAFORMA` promete. O segundo trecho
  // importa tanto quanto o primeiro: religar `ST_ATIVO` tem de devolver o
  // acesso a quem já o tinha, sem ninguém reconceder nada.
  await comoPessoa(async (cliente) => {
    await definir(cliente, { DASHBOARDS: true });
    assert.ok((await modulosDe(cliente)).includes("DASHBOARDS"));

    await cliente.query(
      `update sigav."TB_MODULO_PLATAFORMA" set "ST_ATIVO" = false where "CO_MODULO" = 'DASHBOARDS'`,
    );
    assert.deepEqual(await modulosDe(cliente), ["HOME", "SURVEYS"]);

    const { rows } = await cliente.query(
      `select "ST_PERMITIDO" from sigav."RL_PESSOA_MODULO"
        where "SQ_PESSOA" = $1 and "CO_MODULO" = 'DASHBOARDS'`,
      [pessoa.person_id],
    );
    assert.equal(rows[0]?.ST_PERMITIDO, true, "a permissão concedida foi apagada junto");

    await cliente.query(
      `update sigav."TB_MODULO_PLATAFORMA" set "ST_ATIVO" = true where "CO_MODULO" = 'DASHBOARDS'`,
    );
    assert.ok((await modulosDe(cliente)).includes("DASHBOARDS"), "religar não devolveu o acesso");
  });
});

test("pessoa inativa não recebe nem o piso", async () => {
  // Desligar `ST_ATIVO` na pessoa é o desligamento institucional. Se o piso
  // sobrevivesse a ele, quem saiu da instituição continuaria com HOME e
  // SURVEYS.
  await comoPessoa(async (cliente) => {
    await semNenhumaLinha(cliente);
    await cliente.query(`update sigav."TB_PESSOA" set "ST_ATIVO" = false where "SQ_PESSOA" = $1`, [
      pessoa.person_id,
    ]);
    assert.deepEqual(await modulosDe(cliente), []);
  });
});

test("pessoa inexistente e argumento nulo devolvem lista vazia, não erro", async () => {
  // A função é chamada com o retorno de `FC_PESSOA_SESSAO()`, que é null quando
  // a sessão não tem cadastro vinculado. Erro aqui viraria 500 na tela em vez
  // de "sem permissão".
  await comoPessoa(async (cliente) => {
    assert.deepEqual(await modulosDe(cliente, "00000000-0000-0000-0000-000000000000"), []);
    const { rows } = await cliente.query(`select sigav."FC_MODULOS_EFETIVOS"(null) as modulos`);
    assert.deepEqual(rows[0].modulos, []);
  });
});

test("FC_TEM_MODULO concorda com FC_MODULOS_EFETIVOS em todo o catálogo", async () => {
  // Duas funções, uma verdade. `FC_TEM_MODULO` é o que as RPCs usam como portão
  // e `FC_MODULOS_EFETIVOS` é o que a interface desenha: divergir faria a tela
  // mostrar um menu que a RPC recusa.
  await comoPessoa(async (cliente) => {
    await definir(cliente, { DASHBOARDS: true, ADMIN_TEAMS: true, TEAM: false });
    const efetivos = await modulosDe(cliente);

    const { rows } = await cliente.query(`
      select pm."CO_MODULO", sigav."FC_TEM_MODULO"(pm."CO_MODULO") as permitido
        from sigav."TB_MODULO_PLATAFORMA" pm
       where pm."ST_ATIVO"
       order by pm."NU_ORDEM", pm."CO_MODULO"
    `);
    for (const linha of rows) {
      assert.equal(
        linha.permitido,
        efetivos.includes(linha.CO_MODULO),
        `${linha.CO_MODULO}: portão e lista discordam`,
      );
    }
  });
});

test("FC_TEM_MODULO normaliza caixa e espaço, e recusa o que não existe", async () => {
  await comoPessoa(async (cliente) => {
    await definir(cliente, { ADMIN_ACCESS: true });
    const { rows } = await cliente.query(`
      select sigav."FC_TEM_MODULO"('ADMIN_ACCESS')     as exato,
             sigav."FC_TEM_MODULO"('admin_access')     as minuscula,
             sigav."FC_TEM_MODULO"('  admin_access  ') as com_espaco,
             sigav."FC_TEM_MODULO"('ADMIN_TUDO')       as inventado,
             sigav."FC_TEM_MODULO"('')                 as vazio,
             sigav."FC_TEM_MODULO"(null)               as nulo
    `);
    assert.deepEqual(rows[0], {
      exato: true,
      minuscula: true,
      com_espaco: true,
      inventado: false,
      vazio: false,
      nulo: false,
    });
  });
});

test("sem sessão de pessoa, nenhum módulo é concedido", async () => {
  // `anon` e `service_role` não têm cadastro: `FC_PESSOA_SESSAO()` devolve null
  // e o portão precisa fechar em silêncio, sem estourar.
  for (const executar of [comoAnonimo, comoServico]) {
    const { rows } = await executar((cliente) =>
      cliente.query(`
        select sigav."FC_TEM_MODULO"('HOME')         as home,
               sigav."FC_TEM_MODULO"('ADMIN_ACCESS') as admin,
               sigav."FC_E_ADMINISTRADOR"()          as e_admin
      `),
    );
    assert.deepEqual(rows[0], { home: false, admin: false, e_admin: false });
  }
});

test("o catálogo do banco e o do frontend têm os mesmos códigos, na mesma ordem", async () => {
  // `PLATFORM_MODULES` desenha o menu e `NU_ORDEM` ordena o que o banco
  // devolve. Divergir na ORDEM embaralha a barra lateral; divergir no CONJUNTO
  // faz a guarda descartar um módulo que o banco concedeu — a pessoa recebe
  // permissão e continua sem ver a tela.
  const { rows } = await obterPool().query(
    `select "CO_MODULO" from sigav."TB_MODULO_PLATAFORMA"
      where "ST_ATIVO" order by "NU_ORDEM", "CO_MODULO"`,
  );
  assert.deepEqual(rows.map((linha) => linha.CO_MODULO), [...PLATFORM_MODULES]);
});
