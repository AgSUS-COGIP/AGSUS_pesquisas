// Coerência entre o que a aplicação acha que pode chamar e o que o banco tem.
//
// POR QUE ISTO IMPORTA MAIS DO QUE PARECE. Desde que a conexão virou direta,
// `src/lib/db/rpc-permissions.ts` é a única barreira que separa uma sessão comum
// de uma função de serviço — não existem mais os papéis do Postgres que o
// PostgREST usava. Essa lista é gerada, e lista gerada envelhece: uma função
// renomeada por migration continua listada, e o defeito só aparece quando
// alguém abre a tela e recebe "Could not find the function".
//
// A verificação de existência reusa `sigav.fc_srv_verificar_contrato_rpc`, que
// o próprio projeto criou para isso, em vez de reimplementar a consulta.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { obterPool, encerrarPool, comoServico, comSessao } from "../apoio/banco.mjs";
import { RPC_PERMISSIONS } from "../../src/lib/db/rpc-permissions.ts";
import { RPC_RETURN_SHAPE } from "../../src/lib/db/rpc-return-shape.ts";
import { RPC_JSON_ARGS } from "../../src/lib/db/rpc-json-args.ts";

after(encerrarPool);

const NOMES = Object.keys(RPC_PERMISSIONS).sort();

test("toda RPC do allowlist existe no banco", async () => {
  // A função tem teto de 200 nomes por chamada, por desenho.
  const lotes = [];
  for (let i = 0; i < NOMES.length; i += 200) lotes.push(NOMES.slice(i, i + 200));

  const ausentes = [];
  for (const lote of lotes) {
    const resultado = await comoServico(async (cliente) => {
      const { rows } = await cliente.query(
        "select sigav.fc_srv_verificar_contrato_rpc($1::text[]) as r",
        [lote],
      );
      return rows[0].r;
    });
    ausentes.push(...(resultado.ausentes ?? []));
  }

  assert.deepEqual(
    ausentes,
    [],
    "funções listadas em rpc-permissions.ts que não existem em sigav",
  );
});

test("allowlist e metadado de retorno cobrem o mesmo conjunto", async () => {
  // O adaptador avisa no console quando falta shape e trata como "set", o que
  // pode devolver a linha inteira onde a tela espera um escalar. Divergência
  // aqui é defeito silencioso em produção.
  const semShape = NOMES.filter((n) => RPC_RETURN_SHAPE[n] === undefined);
  const shapeOrfao = Object.keys(RPC_RETURN_SHAPE).filter((n) => !(n in RPC_PERMISSIONS));

  assert.deepEqual(semShape, [], "RPCs no allowlist sem metadado de shape");
  assert.deepEqual(shapeOrfao, [], "shapes declarados para RPCs fora do allowlist");
});

test("as funções de serviço recusam uma sessão comum", async () => {
  // Amostra do que nunca pode ser alcançado por quem só está logado. A recusa
  // vale em duas camadas — o allowlist no app e o corpo da função no banco —, e
  // este teste exercita a segunda, que é a que sobrevive a um bug na primeira.
  const deServico = NOMES.filter(
    (n) => RPC_PERMISSIONS[n].length === 1 && RPC_PERMISSIONS[n][0] === "service_role",
  );
  assert.ok(deServico.length > 0, "esperava encontrar RPCs exclusivas de serviço");

  const alvo = "fc_srv_verificar_contrato_rpc";
  assert.ok(deServico.includes(alvo), `${alvo} deveria ser exclusiva de serviço`);

  await assert.rejects(
    () =>
      comSessao("authenticated", { sub: "00000000-0000-0000-0000-000000000000" }, (cliente) =>
        cliente.query(`select sigav.${alvo}($1::text[])`, [["people"]]),
      ),
    /Acesso restrito/,
    "função de serviço aceitou uma sessão autenticada comum",
  );
});

test("nenhuma função de sigav mudou de dono para superusuário", async () => {
  // Função `security definer` roda com os privilégios do dono. Se alguma delas
  // passasse a pertencer a um superusuário, uma falha de validação no corpo
  // deixaria de ser um erro de aplicação e viraria acesso irrestrito ao banco.
  const { rows } = await obterPool().query(`
    select p.proname, p.proowner::regrole::text as dono
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_roles r on r.oid = p.proowner
    where n.nspname = 'sigav' and p.prosecdef and r.rolsuper
    order by p.proname
  `);
  assert.deepEqual(
    rows.map((r) => `${r.proname} (${r.dono})`),
    [],
    "há função security definer pertencente a superusuário",
  );
});

// Exceção única e deliberada, com prazo de validade. As duas assinaturas de
// conclusão de e-mail NÃO são equivalentes: a de 3 argumentos atualiza a fila
// sem checar nada, e a de 4 exige `st_envio = 'PROCESSANDO'` com token vigente
// e levanta erro se a reivindicação expirou. O despachador
// (src/app/api/tarefas/emails/despachador.ts) ainda cai na primeira quando
// `email.claimToken` vem vazio — o que contorna a proteção contra execução
// concorrente.
//
// A janela de deploy que justificava esse fallback fechou em 20/08/2026, com
// 20260820180000_claim_de_email_expira.sql. Quando o despachador passar a
// sempre reivindicar antes de concluir, apague estas duas linhas e as duas
// funções de 3 argumentos: o teste volta a cobrir o conjunto inteiro.
const SOBRECARGA_TOLERADA = ["fc_srv_concluir_email", "fc_concluir_email_participante"];

test("nenhuma RPC do allowlist tem sobrecarga no banco", async () => {
  // O adaptador monta `select * from sigav.fn(arg => $1, ...)`, e o Postgres
  // resolve a sobrecarga pelo CONJUNTO de argumentos nomeados. Duas assinaturas
  // com o mesmo nome significam que uma chamada que omite um parâmetro cai numa
  // função DIFERENTE — silenciosamente, com outra regra de negócio dentro.
  // Foi assim que `tx_perfis_param` sobreviveu ao fim dos perfis: a versão
  // antiga continuava lá, atendendo quem não passava o argumento novo.
  const { rows } = await obterPool().query(`
    select p.proname                                              as nome,
           count(*)                                               as assinaturas,
           string_agg(pg_get_function_identity_arguments(p.oid), ' | ' order by p.oid) as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'sigav' and p.prokind = 'f' and p.proname = any($1::text[])
     group by p.proname
    having count(*) > 1
     order by p.proname
  `, [NOMES]);

  assert.deepEqual(
    rows
      .filter((r) => !SOBRECARGA_TOLERADA.includes(r.nome))
      .map((r) => `${r.nome} (${r.assinaturas}): ${r.args}`),
    [],
    "RPC do allowlist com mais de uma assinatura — a chamada pode cair na versão errada",
  );

  // A exceção também é verificada: se alguém resolver a dupla de e-mail, a lista
  // deixa de ter razão de existir e o teste avisa em vez de seguir tolerando.
  const toleradasAindaSobrecarregadas = rows.map((r) => r.nome)
    .filter((n) => SOBRECARGA_TOLERADA.includes(n));
  assert.deepEqual(
    toleradasAindaSobrecarregadas.sort(),
    [...SOBRECARGA_TOLERADA].sort(),
    "SOBRECARGA_TOLERADA lista nome que já não tem sobrecarga — remova a exceção",
  );
});

test("toda RPC com argumento jsonb está registrada em rpc-json-args.ts", async () => {
  // node-postgres não serializa objeto JS para JSON ao vincular parâmetro: sem
  // o registro, `p_regra` chega ao banco como a string "[object Object]". Não
  // levanta erro — a função recebe um jsonb inválido e devolve resultado vazio
  // ou errado, que é pior do que falhar.
  const { rows } = await obterPool().query(`
    select p.proname as nome,
           array_agg(a.nome_arg order by a.ordem) as args_json
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      cross join lateral (
        select t.typname, arg.ordem, p.proargnames[arg.ordem] as nome_arg
          from unnest(p.proargtypes) with ordinality as arg(oid, ordem)
          join pg_type t on t.oid = arg.oid
         where t.typname in ('jsonb', 'json')
      ) a
     where n.nspname = 'sigav' and p.prokind = 'f' and p.proname = any($1::text[])
     group by p.proname
     order by p.proname
  `, [NOMES]);

  const faltando = rows
    .filter((r) => {
      const registrados = RPC_JSON_ARGS[r.nome] ?? [];
      return r.args_json.some((arg) => !registrados.includes(arg));
    })
    .map((r) => `${r.nome}: ${r.args_json.join(", ")}`);

  assert.deepEqual(
    faltando,
    [],
    "argumento jsonb sem registro em rpc-json-args.ts — chegaria como [object Object]",
  );
});

test("o shape declarado corresponde ao que a função devolve", async () => {
  // O teste acima garante que existe shape para toda RPC; este garante que ele
  // está CERTO. Declarar "scalar" uma função `returns setof` faz o adaptador
  // entregar só a primeira linha, e a tela mostra um item onde havia vários.
  const { rows } = await obterPool().query(`
    select p.proname as nome, p.proretset as conjunto
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'sigav' and p.prokind = 'f' and p.proname = any($1::text[])
  `, [NOMES]);

  const divergentes = rows
    .filter((r) => {
      const declarado = RPC_RETURN_SHAPE[r.nome];
      if (declarado === undefined || declarado === "void") return false;
      return r.conjunto !== (declarado === "set");
    })
    .map((r) => `${r.nome}: banco ${r.conjunto ? "setof" : "escalar"}, declarado "${RPC_RETURN_SHAPE[r.nome]}"`);

  assert.deepEqual(divergentes, [], "shape declarado diverge do retorno real da função");
});

test("nenhum corpo de função chama função que não existe", async () => {
  // A classe de defeito recorrente deste projeto: corpo de função é TEXTO, e
  // uma chamada a função inexistente compila sem reclamar — só falha quando
  // alguém usa a tela. Já aconteceu com `private.effective_platform_modules` na
  // unificação de schemas, e de novo com `set_person_role`, que era ponte para
  // a `fc_definir_perfil_pessoa` removida junto das tabelas de perfil.
  const { rows } = await obterPool().query(`
    with chamadas as (
      select p.oid::regprocedure::text as origem, lower(m[1]) as chamada
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        -- Barras dobradas: isto vive num template literal, que engole \. e \(
        -- antes de o SQL ver. Sem dobrar, o Postgres recebe parêntese solto.
        cross join lateral regexp_matches(p.prosrc, 'sigav\\.([a-z_][a-z_0-9]*)\\s*\\(', 'g') as m
       where n.nspname = 'sigav' and p.prokind = 'f'
    )
    select c.chamada, string_agg(distinct c.origem, ', ') as citada_por
      from chamadas c
     where not exists (
             select 1 from pg_proc p2
             join pg_namespace n2 on n2.oid = p2.pronamespace
              where n2.nspname = 'sigav' and lower(p2.proname) = c.chamada)
       and not exists (
             select 1 from information_schema.tables t
              where t.table_schema = 'sigav' and lower(t.table_name) = c.chamada)
     group by c.chamada
     order by c.chamada
  `);

  assert.deepEqual(
    rows.map((r) => `sigav.${r.chamada}() citada por ${r.citada_por}`),
    [],
    "corpo de função cita objeto de sigav que não existe — quebra em tempo de execução",
  );
});
