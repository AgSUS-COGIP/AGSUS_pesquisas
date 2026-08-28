// Jornadas reais contra o banco, com identidade de sessão de verdade.
//
// Esta é a suíte que teria pego o defeito de 28/08/2026, quando quatro funções
// passaram a falhar com `schema "private" does not exist` e a validação por
// reconstrução do schema não percebeu. A diferença é o que se testa: não a
// forma do catálogo, mas o resultado de chamar a função como a aplicação chama.
//
// Cobre os três papéis, porque cada um exercita um caminho distinto de
// autorização: anônimo (rota pública antes do login), autenticado (o grosso das
// telas) e serviço (cron e importação).

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

let pessoa;
before(async () => {
  pessoa = await pessoaComAcesso();
});

/** Executa como a pessoa real encontrada no banco. */
function comoPessoa(corpo) {
  return comSessao("authenticated", { sub: pessoa.auth_user_id, email: pessoa.email }, corpo);
}

test("as claims da sessão chegam ao banco e resolvem a pessoa", async () => {
  const resultado = await comoPessoa(async (cliente) => {
    const { rows } = await cliente.query(`
      select sigav.fc_uid_sessao()::text as uid,
             sigav.fc_papel_sessao()      as papel,
             sigav.fc_claims_sessao() ->> 'email' as email,
             sigav.current_person_id()::text as pessoa
    `);
    return rows[0];
  });

  assert.equal(resultado.uid, pessoa.auth_user_id, "fc_uid_sessao não devolveu o sub das claims");
  assert.equal(resultado.papel, "authenticated");
  assert.equal(resultado.email, pessoa.email);
  assert.equal(
    resultado.pessoa,
    pessoa.person_id,
    "current_person_id não casou a conta com o cadastro em people",
  );
});

test("o contexto da plataforma responde e traz módulos", async () => {
  // É o contrato de autorização de toda tela autenticada, e foi exatamente esta
  // função que quebrou em silêncio na unificação de schemas.
  const contexto = await comoPessoa(async (cliente) => {
    const { rows } = await cliente.query("select sigav.fc_obter_contexto_plataforma() as ctx");
    return rows[0].ctx;
  });

  assert.equal(contexto.status, "OK", `contexto devolveu status ${contexto.status}`);
  assert.ok(Array.isArray(contexto.modules), "contexto sem lista de módulos");
  assert.ok(contexto.modules.length > 0, "pessoa ativa ficou sem módulo algum");
  assert.ok(Array.isArray(contexto.roles) && contexto.roles.length === 1,
    "o modelo é de perfil exclusivo: esperava exatamente um perfil vigente");
});

test("os portões de autorização respondem sem erro", async () => {
  // Não afirmamos o valor — depende do perfil de quem o banco devolveu —, e sim
  // que respondem booleano em vez de estourar. Um qualificador quebrado dentro
  // deles apareceria aqui.
  const portoes = await comoPessoa(async (cliente) => {
    const { rows } = await cliente.query(`
      select sigav.can_manage_surveys()            as gerencia,
             sigav.is_platform_administrator()     as superadmin,
             sigav.has_platform_module('HOME')     as tem_home,
             sigav.can_audit_platform()            as audita
    `);
    return rows[0];
  });

  for (const [nome, valor] of Object.entries(portoes)) {
    assert.equal(typeof valor, "boolean", `${nome} não devolveu booleano`);
  }
});

test("o catálogo de pesquisas da pessoa responde", async () => {
  const linhas = await comoPessoa(async (cliente) => {
    const { rows } = await cliente.query("select * from sigav.list_my_survey_catalog()");
    return rows;
  });
  assert.ok(Array.isArray(linhas), "catálogo não devolveu conjunto");
});

test("a marca pública é legível sem sessão", async () => {
  // Roda antes do login, na tela de acesso. Se depender de identidade, a tela
  // de acesso quebra para quem ainda não entrou.
  const marca = await comoAnonimo(async (cliente) => {
    const { rows } = await cliente.query("select sigav.fc_obter_marca_publica() as m");
    return rows[0].m;
  });

  assert.ok(marca && typeof marca === "object", "marca pública veio vazia");
  assert.ok(marca.productName, "marca pública sem nome do produto");
});

test("a presença online registra e lista sem estourar", async () => {
  const status = await comoPessoa(async (cliente) => {
    const { rows } = await cliente.query("select sigav.fc_registrar_presenca() as r");
    return rows[0].r;
  });
  // `DISABLED` é resposta legítima quando a configuração está desligada.
  assert.ok(
    ["OK", "DISABLED"].includes(status?.status),
    `fc_registrar_presenca devolveu ${JSON.stringify(status)}`,
  );
});

test("as imagens migradas saem do banco, não do Storage", async () => {
  // Fecha o ciclo de `scripts/migrar-arquivos-para-o-banco.mjs`: os bytes têm de
  // estar na tabela e a RPC de leitura tem de devolvê-los sem sessão, porque a
  // arte de fundo aparece antes do login.
  const arquivos = await obterPool().query(
    "select co_balde, ds_caminho, tp_conteudo, nu_tamanho from sigav.tb_arquivo order by ds_caminho",
  );
  assert.ok(arquivos.rows.length > 0, "nenhuma imagem no banco — a migração de arquivos não rodou");

  for (const arquivo of arquivos.rows) {
    const conteudo = await comoAnonimo(async (cliente) => {
      const { rows } = await cliente.query(
        "select conteudo, tipo, tamanho from sigav.fc_arq_obter($1, $2)",
        [arquivo.co_balde, arquivo.ds_caminho],
      );
      return rows[0];
    });

    assert.ok(conteudo, `fc_arq_obter não achou ${arquivo.co_balde}/${arquivo.ds_caminho}`);
    assert.equal(conteudo.tamanho, arquivo.nu_tamanho, "tamanho declarado diverge do gravado");
    assert.equal(
      conteudo.conteudo.length,
      arquivo.nu_tamanho,
      "os bytes devolvidos não têm o tamanho declarado",
    );
  }
});

test("nada no banco ainda aponta para o Storage do PostgreSQL", async () => {
  const { rows } = await obterPool().query(`
    select count(*)::int as total from (
      select 1 from sigav.tb_config_plataforma
       where co_configuracao = 1
         and (coalesce(tx_url_logotipo, '') like '%/storage/v1/object/public/%'
           or coalesce(tx_url_fundo_acesso, '') like '%/storage/v1/object/public/%')
      union all
      select 1 from sigav.survey_applications
       where settings::text like '%/storage/v1/object/public/%'
    ) t
  `);
  assert.equal(rows[0].total, 0, "ainda há URL do Storage gravada no banco");
});

test("o papel de serviço alcança a verificação de contrato", async () => {
  const resultado = await comoServico(async (cliente) => {
    const { rows } = await cliente.query(
      "select sigav.fc_srv_verificar_contrato_rpc($1::text[]) as r",
      [["fc_obter_contexto_plataforma"]],
    );
    return rows[0].r;
  });
  assert.deepEqual(resultado.ausentes ?? [], []);
});
