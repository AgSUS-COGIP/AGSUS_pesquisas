// `FC_DEFINIR_PERMISSOES_PESSOA` — a única porta de escrita do perfil de acesso.
//
// Desde que as tabelas de perfil saíram do banco (20260828150000), quem decide
// o que uma pessoa pode ver na plataforma é esta função e mais nada. Ela é
// SECURITY DEFINER, então roda com os privilégios da dona do schema: as
// verificações que ela faz no próprio corpo SÃO a autorização, não uma segunda
// camada de conforto.
//
// `perfis.test.mjs` já cobre dois casos (o piso preservado e a auto-rebaixa).
// Este arquivo cobre os outros sete desfechos do corpo da função, que não
// tinham teste: quem pode chamar, o que acontece com código inválido, com alvo
// inválido, e o que fica gravado depois de uma chamada bem-sucedida.
//
// Cada teste roda em transação com rollback (ver `tests/apoio/banco.mjs`).

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  encerrarPool,
  comSessao,
  comoAnonimo,
  comoServico,
  pessoasComAcesso,
} from "../apoio/banco.mjs";

after(encerrarPool);

const PESSOA_INEXISTENTE = "00000000-0000-0000-0000-000000000000";

let ator;
let alvo;
before(async () => {
  [ator, alvo] = await pessoasComAcesso(2, 1);
});

function comoAtor(corpo) {
  return comSessao("authenticated", { sub: ator.auth_user_id, email: ator.email }, corpo);
}

/** Torna alguém administrador dentro da transação em curso. */
function conceder(cliente, pessoaId, modulo = "ADMIN_ACCESS") {
  return cliente.query(
    `insert into sigav."RL_PESSOA_MODULO" ("SQ_PESSOA", "CO_MODULO", "ST_PERMITIDO")
     values ($1, $2, true)
     on conflict ("SQ_PESSOA", "CO_MODULO") do update set "ST_PERMITIDO" = true`,
    [pessoaId, modulo],
  );
}

function definir(cliente, pessoaId, permissoes) {
  return cliente.query(
    `select sigav."FC_DEFINIR_PERMISSOES_PESSOA"($1, $2::text[]) as resultado`,
    [pessoaId, permissoes],
  );
}

// ---------------------------------------------------------------------------
// Quem pode chamar
// ---------------------------------------------------------------------------

test("sessão anônima não administra permissões", async () => {
  await assert.rejects(
    () => comoAnonimo((cliente) => definir(cliente, alvo.person_id, ["TEAM"])),
    /Acesso restrito à administração de permissões/,
  );
});

test("papel de serviço não administra permissões", async () => {
  // Cron e fila de e-mail rodam como serviço. Deixá-los conceder módulo daria a
  // qualquer rota interna o poder de se promover, sem passar por pessoa alguma.
  await assert.rejects(
    () => comoServico((cliente) => definir(cliente, alvo.person_id, ["TEAM"])),
    /Acesso restrito à administração de permissões/,
  );
});

test("pessoa autenticada sem ADMIN_ACCESS não administra permissões", async () => {
  // O caso que mais importa: estar logado não basta. É a diferença entre um
  // respondente comum e quem administra acessos.
  await assert.rejects(
    () =>
      comoAtor(async (cliente) => {
        await cliente.query(`delete from sigav."RL_PESSOA_MODULO" where "SQ_PESSOA" = $1`, [
          ator.person_id,
        ]);
        return definir(cliente, alvo.person_id, ["TEAM"]);
      }),
    /Acesso restrito à administração de permissões/,
  );
});

test("sessão sem cadastro institucional é recusada no primeiro portão", async () => {
  /*
    A função tem uma mensagem própria para este caso ("Sessão sem cadastro
    institucional vinculado"), mas ela é inalcançável: `FC_TEM_MODULO` resolve
    por `FC_PESSOA_SESSAO()`, que já devolve null sem cadastro, e a recusa
    acontece uma linha antes. O teste fixa o que a pessoa realmente recebe — se
    a ordem das verificações mudar, é aqui que aparece.
  */
  await assert.rejects(
    () =>
      comSessao("authenticated", { sub: PESSOA_INEXISTENTE }, (cliente) =>
        definir(cliente, alvo.person_id, ["TEAM"]),
      ),
    /Acesso restrito à administração de permissões/,
  );
});

// ---------------------------------------------------------------------------
// O que a função aceita como entrada
// ---------------------------------------------------------------------------

test("código de módulo inexistente é recusado, e a mensagem diz qual", async () => {
  // Recusar em silêncio (ignorando o código desconhecido) gravaria um perfil
  // diferente do que a tela pediu, sem ninguém notar.
  await assert.rejects(
    () =>
      comoAtor(async (cliente) => {
        await conceder(cliente, ator.person_id);
        return definir(cliente, alvo.person_id, ["TEAM", "VOAR"]);
      }),
    /Permissões desconhecidas: VOAR/,
  );
});

test("módulo desligado no catálogo conta como desconhecido", async () => {
  // `ST_ATIVO = false` tira o módulo de circulação. Aceitá-lo aqui gravaria uma
  // permissão que `FC_MODULOS_EFETIVOS` nunca vai devolver.
  await assert.rejects(
    () =>
      comoAtor(async (cliente) => {
        await conceder(cliente, ator.person_id);
        await cliente.query(
          `update sigav."TB_MODULO_PLATAFORMA" set "ST_ATIVO" = false where "CO_MODULO" = 'TEAM'`,
        );
        return definir(cliente, alvo.person_id, ["TEAM"]);
      }),
    /Permissões desconhecidas: TEAM/,
  );
});

test("alvo inativo e alvo inexistente são recusados igualmente", async () => {
  await assert.rejects(
    () =>
      comoAtor(async (cliente) => {
        await conceder(cliente, ator.person_id);
        await cliente.query(
          `update sigav."TB_PESSOA" set "ST_ATIVO" = false where "SQ_PESSOA" = $1`,
          [alvo.person_id],
        );
        return definir(cliente, alvo.person_id, ["TEAM"]);
      }),
    /Pessoa ativa não encontrada/,
  );

  await assert.rejects(
    () =>
      comoAtor(async (cliente) => {
        await conceder(cliente, ator.person_id);
        return definir(cliente, PESSOA_INEXISTENTE, ["TEAM"]);
      }),
    /Pessoa ativa não encontrada/,
  );
});

test("lista vazia e lista nula reduzem ao piso, sem erro", async () => {
  // É a operação "retirar tudo desta pessoa". Ela não pode falhar: sem ela não
  // há como desprovisionar alguém pela tela.
  await comoAtor(async (cliente) => {
    await conceder(cliente, ator.person_id);

    const vazia = await definir(cliente, alvo.person_id, []);
    assert.deepEqual(vazia.rows[0].resultado.permissions, ["HOME", "SURVEYS"]);

    const { rows } = await cliente.query(
      `select sigav."FC_DEFINIR_PERMISSOES_PESSOA"($1, null) as resultado`,
      [alvo.person_id],
    );
    assert.deepEqual(rows[0].resultado.permissions, ["HOME", "SURVEYS"]);
  });
});

test("caixa, espaço em volta e repetição são normalizados", async () => {
  // A tela manda o que o catálogo mostra, mas a RPC também é chamada por script
  // de operação. `upper(btrim(...))` + `distinct` é o que torna as duas
  // origens equivalentes.
  await comoAtor(async (cliente) => {
    await conceder(cliente, ator.person_id);
    const { rows } = await definir(cliente, alvo.person_id, [
      "  team ",
      "dashboards",
      "TEAM",
      "",
    ]);
    assert.deepEqual(rows[0].resultado.permissions, [
      "HOME",
      "SURVEYS",
      "DASHBOARDS",
      "TEAM",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Proteção da própria administração
// ---------------------------------------------------------------------------

test("ninguém retira a própria administração de acessos", async () => {
  await assert.rejects(
    () =>
      comoAtor(async (cliente) => {
        await conceder(cliente, ator.person_id);
        return definir(cliente, ator.person_id, ["TEAM"]);
      }),
    /própria permissão de administrar acessos/i,
  );
});

test("editar a si mesmo é permitido enquanto ADMIN_ACCESS continuar na lista", async () => {
  // A proteção é contra perder o acesso, não contra se editar. Confundir as
  // duas coisas impediria quem administra de ajustar os próprios módulos.
  await comoAtor(async (cliente) => {
    await conceder(cliente, ator.person_id);
    const { rows } = await definir(cliente, ator.person_id, ["ADMIN_ACCESS", "DASHBOARDS"]);
    assert.deepEqual(rows[0].resultado.permissions, [
      "HOME",
      "SURVEYS",
      "DASHBOARDS",
      "ADMIN_ACCESS",
    ]);
  });
});

test("depois de qualquer chamada bem-sucedida ainda existe administrador ativo", async () => {
  /*
    O invariante que a plataforma precisa manter, e a razão pela qual ele se
    sustenta: quem chama a função é obrigatoriamente um administrador ativo (é o
    primeiro portão) e não consegue retirar a própria permissão (é o portão da
    auto-rebaixa). Logo, o ator sobrevive a toda chamada — inclusive quando
    retira ADMIN_ACCESS de outra pessoa.

    Vale registrar que este é o motivo pelo qual a checagem de "último
    administrador" no corpo da função nunca dispara: ela conta administradores
    DIFERENTES do alvo, e o ator sempre é um deles.
  */
  await comoAtor(async (cliente) => {
    await conceder(cliente, ator.person_id);
    await conceder(cliente, alvo.person_id);

    await definir(cliente, alvo.person_id, ["TEAM"]);

    const { rows } = await cliente.query(`
      select count(*)::integer as administradores
        from sigav."TB_PESSOA" p
       where p."ST_ATIVO"
         and 'ADMIN_ACCESS' = any(sigav."FC_MODULOS_EFETIVOS"(p."SQ_PESSOA"))
    `);
    assert.ok(
      rows[0].administradores >= 1,
      "a plataforma ficou sem ninguém para administrar acessos",
    );
  });
});

// ---------------------------------------------------------------------------
// O que fica gravado
// ---------------------------------------------------------------------------

test("a gravação é completa: uma linha por módulo do catálogo, negando o resto", async () => {
  /*
    A função apaga e reinsere TODAS as linhas, marcando `ST_PERMITIDO = false`
    no que não foi concedido. Isso não é detalhe de implementação: é o que faz o
    piso institucional deixar de valer para quem já passou pela tela uma vez
    (ver `perfis-modulos-efetivos.test.mjs`). Quem mexer nesta função precisa
    saber que a negação é explícita.
  */
  await comoAtor(async (cliente) => {
    await conceder(cliente, ator.person_id);
    await definir(cliente, alvo.person_id, ["DASHBOARDS"]);

    const { rows } = await cliente.query(
      `select "CO_MODULO", "ST_PERMITIDO", "AU_USUARIO_CONCESSAO" = $2 as concedido_pelo_ator
         from sigav."RL_PESSOA_MODULO"
        where "SQ_PESSOA" = $1
        order by "CO_MODULO"`,
      [alvo.person_id, ator.person_id],
    );

    const { rows: catalogo } = await cliente.query(
      `select count(*)::integer as total from sigav."TB_MODULO_PLATAFORMA" where "ST_ATIVO"`,
    );
    assert.equal(rows.length, catalogo[0].total, "não há uma linha por módulo do catálogo");

    const permitidos = rows.filter((linha) => linha.ST_PERMITIDO).map((linha) => linha.CO_MODULO);
    assert.deepEqual(permitidos.sort(), ["DASHBOARDS", "HOME", "SURVEYS"]);
    assert.ok(
      rows.every((linha) => linha.concedido_pelo_ator),
      "a autoria da concessão não aponta para quem chamou",
    );
  });
});

test("a mudança de perfil deixa rastro de auditoria com antes e depois", async () => {
  // Sem o "antes", o registro não permite reconstruir quem tinha o quê — e é
  // justamente isso que se pergunta depois de um acesso indevido.
  //
  // A ordenação é por `SQ_EVENTO`, não por `DT_INCLUSAO`: `now()` é fixo dentro
  // de uma transação, então as duas chamadas abaixo gravam o mesmo instante e
  // ordenar por data escolheria uma linha ao acaso.
  await comoAtor(async (cliente) => {
    await conceder(cliente, ator.person_id);
    await definir(cliente, alvo.person_id, []);
    await definir(cliente, alvo.person_id, ["ADMIN_IMPORT"]);

    const { rows } = await cliente.query(
      `select "DS_DADO_ANTERIOR" -> 'permissions'  as antes,
              "DS_DADO_POSTERIOR" -> 'permissions' as depois,
              "DS_DADO_POSTERIOR" ->> 'personId'   as pessoa,
              "SQ_PESSOA_ATOR" = $2                as ator_correto,
              "DS_METADADO" ->> 'technicalRole'    as papel
         from sigav."TL_EVENTO_AUDITORIA"
        where "TP_EVENTO" = 'PERSON_PERMISSIONS_SET'
          and "CO_ENTIDADE" = $1
        order by "SQ_EVENTO" desc
        limit 2`,
      [alvo.person_id, ator.person_id],
    );

    // A segunda chamada: partiu do piso e acrescentou ADMIN_IMPORT.
    assert.deepEqual(rows[0].antes, ["HOME", "SURVEYS"]);
    assert.deepEqual(rows[0].depois, ["HOME", "SURVEYS", "ADMIN_IMPORT"]);
    assert.equal(rows[0].pessoa, alvo.person_id);
    assert.equal(rows[0].ator_correto, true);
    assert.equal(rows[0].papel, "authenticated");

    // A primeira chamada continua registrada: o histórico acumula, não sobrescreve.
    assert.deepEqual(rows[1].depois, ["HOME", "SURVEYS"]);
  });
});

test("o resultado devolvido é o que a tela precisa para redesenhar o menu", async () => {
  await comoAtor(async (cliente) => {
    await conceder(cliente, ator.person_id);
    const { rows } = await definir(cliente, alvo.person_id, ["TEAM"]);
    const resultado = rows[0].resultado;

    assert.equal(resultado.status, "OK");
    assert.equal(resultado.personId, alvo.person_id);
    assert.equal(resultado.technicalRole, "authenticated");
    // O que a função devolve tem de bater com o que a leitura vai responder na
    // próxima requisição, senão a tela mostra um menu que o recarregamento
    // desfaz.
    const { rows: efetivos } = await cliente.query(
      `select sigav."FC_MODULOS_EFETIVOS"($1) as modulos`,
      [alvo.person_id],
    );
    assert.deepEqual(resultado.permissions, efetivos[0].modulos);
  });
});
