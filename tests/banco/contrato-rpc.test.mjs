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
