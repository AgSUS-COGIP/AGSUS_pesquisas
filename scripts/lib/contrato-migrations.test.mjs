import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { lerVersoesMigrations, verificarMigrations } from "./contrato-migrations.mjs";

const temporarios = [];

function repositorioTemporario(arquivos) {
  const raiz = mkdtempSync(join(tmpdir(), "agsus-migrations-"));
  temporarios.push(raiz);
  const pasta = join(raiz, "supabase", "migrations");
  mkdirSync(pasta, { recursive: true });
  for (const nome of arquivos) writeFileSync(join(pasta, nome), "select 1;\n");
  return raiz;
}

function resposta(status, corpo) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(corpo),
  };
}

afterEach(() => {
  while (temporarios.length) rmSync(temporarios.pop(), { recursive: true, force: true });
});

describe("contrato de migrations", () => {
  it("lê e ordena os identificadores do repositório", () => {
    const raiz = repositorioTemporario([
      "20260824120000_segunda.sql",
      "20260824090000_primeira.sql",
    ]);
    expect(lerVersoesMigrations(raiz)).toEqual(["20260824090000", "20260824120000"]);
  });

  it("recusa identificadores duplicados", () => {
    const raiz = repositorioTemporario([
      "20260824120000_primeira.sql",
      "20260824120000_segunda.sql",
    ]);
    expect(() => lerVersoesMigrations(raiz)).toThrow(/duplicados/);
  });

  it("classifica banco alinhado", async () => {
    const fetchImpl = async () => resposta(200, {
      checked: 2,
      missing: [],
      compatible: true,
      latestApplied: "20260824120000",
    });
    await expect(verificarMigrations({
      url: "https://exemplo.supabase.co",
      chave: "segredo",
      versoes: ["20260824090000", "20260824120000"],
      fetchImpl,
    })).resolves.toMatchObject({ situacao: "compativel", conferidas: 2 });
  });

  it("expõe exatamente as migrations ausentes", async () => {
    const fetchImpl = async () => resposta(200, {
      checked: 3,
      missing: ["20260824120000", "20260824121000"],
      compatible: false,
      latestApplied: "20260824100000",
    });
    await expect(verificarMigrations({
      url: "https://exemplo.supabase.co",
      chave: "segredo",
      versoes: ["20260824090000", "20260824120000", "20260824121000"],
      fetchImpl,
    })).resolves.toMatchObject({
      situacao: "incompleto",
      ausentes: ["20260824120000", "20260824121000"],
    });
  });

  it("falha fechada quando o verificador ainda não existe no banco", async () => {
    const fetchImpl = async () => resposta(404, { message: "Could not find fc_srv_verificar_migrations" });
    const resultado = await verificarMigrations({
      url: "https://exemplo.supabase.co",
      chave: "segredo",
      versoes: ["20260824120000"],
      fetchImpl,
    });
    expect(resultado.situacao).toBe("indisponivel");
    expect(resultado.motivo).toContain("fc_srv_verificar_migrations");
  });

  it("recusa resposta que não conferiu toda a lista esperada", async () => {
    const fetchImpl = async () => resposta(200, { checked: 1, missing: [], compatible: true });
    const resultado = await verificarMigrations({
      url: "https://exemplo.supabase.co",
      chave: "segredo",
      versoes: ["20260824090000", "20260824120000"],
      fetchImpl,
    });
    expect(resultado.situacao).toBe("indisponivel");
  });
});
