import { describe, expect, it } from "vitest";
import { RPC_PERMISSIONS, isRpcAllowedForRole } from "./rpc-permissions";
import { RPC_RETURN_SHAPE } from "./rpc-return-shape";
import { RPC_JSON_ARGS } from "./rpc-json-args";

/*
 * A garantia que mudou de lugar na unificação do banco.
 *
 * Enquanto existia PostgREST, o que mantinha `FC_VALORES_DE_DIMENSAO` interna
 * era `revoke execute … from authenticated` na migration: o privilégio do
 * Postgres barrava a chamada direta, e um teste pgTAP provava isso sob
 * `set local role authenticated`.
 *
 * Não há mais roles no cluster — a conexão é única. A proteção passou a ser a
 * **ausência** do helper em `rpc-permissions.ts`, porque `executeRpc` recusa com
 * 42501 qualquer nome fora do allowlist antes de abrir transação.
 *
 * Isto aqui é Vitest, e não `tests/banco`, de propósito: a asserção não precisa
 * de banco, e no CI só o Vitest roda a cada PR. Deixá-la na suíte que exige
 * conexão significaria descobrir a regressão em homologação, não na revisão.
 */

describe("contrato da lista operacional de participantes", () => {
  it("a RPC da lista está liberada para sessão autenticada", () => {
    expect(RPC_PERMISSIONS["FC_LISTAR_PARTIC_PAINEL"]).toEqual(["authenticated"]);
    expect(isRpcAllowedForRole("FC_LISTAR_PARTIC_PAINEL", "authenticated")).toBe(true);
  });

  it("o helper de dimensões continua fora do alcance da aplicação", () => {
    // Se alguém acrescentar o helper ao allowlist um dia, isto quebra — que é
    // exatamente o momento em que a porta lateral seria aberta.
    expect(RPC_PERMISSIONS).not.toHaveProperty("FC_VALORES_DE_DIMENSAO");

    for (const papel of ["anon", "authenticated", "service_role"] as const) {
      expect(isRpcAllowedForRole("FC_VALORES_DE_DIMENSAO", papel)).toBe(false);
    }
  });

  it("nenhum papel além de authenticated alcança a lista", () => {
    expect(isRpcAllowedForRole("FC_LISTAR_PARTIC_PAINEL", "anon")).toBe(false);
    expect(isRpcAllowedForRole("FC_LISTAR_PARTIC_PAINEL", "service_role")).toBe(false);
  });

  it("o retorno é escalar, senão a tela recebe um array onde espera o objeto", () => {
    expect(RPC_RETURN_SHAPE["FC_LISTAR_PARTIC_PAINEL"]).toBe("scalar");
  });

  it("`p_filtros` é declarado como argumento JSON", () => {
    // Sem isto o bind manda "[object Object]" e a RPC devolve o ciclo inteiro,
    // ignorando o recorte sem erro nenhum.
    expect(RPC_JSON_ARGS["FC_LISTAR_PARTIC_PAINEL"]).toContain("p_filtros");
  });

  it("o nome cabe no limite de 30 caracteres do padrão de nomenclatura", () => {
    expect("FC_LISTAR_PARTIC_PAINEL".length).toBeLessThanOrEqual(30);
    expect("FC_VALORES_DE_DIMENSAO".length).toBeLessThanOrEqual(30);
  });
});
