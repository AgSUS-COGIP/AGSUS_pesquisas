import { describe, expect, it } from "vitest";
import {
  classificar,
  conferir,
  papelDaChamada,
  resolverNomes,
} from "./validate-rpc-contracts.mjs";

function papelNoTrecho(fonte) {
  const { marca } = classificar(fonte);
  return papelDaChamada(fonte, marca, fonte.indexOf(".rpc("));
}

describe("validador de contratos RPC", () => {
  it("distingue cliente administrativo de cliente autenticado", () => {
    expect(papelNoTrecho(`
      const supabase = createAdminSupabaseClient();
      await supabase.rpc("fc_interna");
    `)).toBe("service_role");

    expect(papelNoTrecho(`
      const supabase = await createServerSupabaseClient();
      await supabase.rpc("fc_publica");
    `)).toBe("authenticated");
  });

  it("cobra EXECUTE do papel efetivamente usado pela chamada", () => {
    const assinaturas = new Map([["fc_interna", [{
      parametros: [],
      obrigatorios: [],
      executavel: { authenticated: false, service_role: true },
    }]]]);

    expect(conferir({ nome: "fc_interna", argumentos: [], papel: "service_role" }, assinaturas)).toBeNull();
    expect(conferir({ nome: "fc_interna", argumentos: [], papel: "authenticated" }, assinaturas)).toMatch(/authenticated/);
  });

  it("resolve nome guardado em const com expressão ternária", () => {
    const fonte = `
      const rpc = arquivada ? "fc_excluir_pesquisa_arquivada" : "fc_excluir_pesquisa_rascunho";
      await supabase.rpc(rpc, { p_pesquisa: id });
    `;
    const { marca } = classificar(fonte);

    expect(resolverNomes("rpc", fonte, marca)).toEqual([
      "fc_excluir_pesquisa_arquivada",
      "fc_excluir_pesquisa_rascunho",
    ]);
  });
});
