import { describe, expect, it } from "vitest";
import { respostaDeErro, statusDoErroPostgres } from "./resposta-http";

/**
 * A tabela de tradução é a parte da camada REST que mais merece teste: um erro
 * classificado como 500 quando era 403 esconde um problema de permissão atrás
 * de "erro interno", e ninguém percebe até auditar o log.
 */
describe("statusDoErroPostgres", () => {
  it("trata violação de RLS como 403", () => {
    // 42501 é o que a própria política levanta — a rede de proteção do banco
    // atuando. A tela precisa distinguir isso de falha de servidor.
    expect(statusDoErroPostgres({ code: "42501", message: "new row violates row-level security policy" })).toBe(403);
  });

  it("trata falha de token como 401, e não como erro interno", () => {
    // Antes, sessão vencida caía no 500 do fim da função: a tela dizia "erro
    // interno" e a pessoa tentava de novo em vez de ser levada a entrar.
    expect(statusDoErroPostgres({ code: "PGRST301", message: "JWT expired" })).toBe(401);
    expect(statusDoErroPostgres({ code: "PGRST302", message: "Anonymous access is disabled" })).toBe(401);
    expect(statusDoErroPostgres({ code: "PGRST303", message: "JWSError JWSInvalidSignature" })).toBe(401);
  });

  it("não confunde função ausente com sessão expirada", () => {
    // Mapear todo PGRST* para 401 faria migration não aplicada parecer logout.
    expect(statusDoErroPostgres({ code: "PGRST202", message: "Could not find the function" })).not.toBe(401);
  });

  it("trata função ausente do cache de esquema como 501", () => {
    expect(statusDoErroPostgres({ code: "PGRST202", message: "Could not find the function" })).toBe(501);
  });

  it("trata código repetido como 409", () => {
    expect(statusDoErroPostgres({ code: "23505", message: "duplicate key value" })).toBe(409);
  });

  it("trata violação de constraint e entrada malformada como 422", () => {
    expect(statusDoErroPostgres({ code: "23514", message: "check constraint" })).toBe(422);
    expect(statusDoErroPostgres({ code: "22P02", message: "invalid input syntax for type uuid" })).toBe(422);
  });

  it("reconhece as recusas de autorização escritas pelas RPCs", () => {
    // `raise exception` sem cláusula usa P0001 para tudo, então o texto é o
    // único sinal disponível. Estas são as frases reais das migrations.
    expect(statusDoErroPostgres({ code: "P0001", message: "Acesso restrito à administração." })).toBe(403);
    expect(statusDoErroPostgres({ code: "P0001", message: "Acesso restrito à administração de avaliações." })).toBe(403);
  });

  it("reconhece recurso inexistente pelo texto", () => {
    expect(statusDoErroPostgres({ code: "P0001", message: "Avaliação não localizada." })).toBe(404);
  });

  it("trata recusa de regra de negócio como 409", () => {
    // Pedido bem formado, estado que não permite. Não é 400 (o cliente não
    // errou o formato) nem 403 (não é questão de permissão).
    expect(statusDoErroPostgres({ code: "P0001", message: "Esta avaliação não tem versão com estrutura para copiar." })).toBe(409);
  });

  it("trata erro desconhecido como 500", () => {
    expect(statusDoErroPostgres({ code: "XX000", message: "internal error" })).toBe(500);
    expect(statusDoErroPostgres({})).toBe(500);
  });

  it("prioriza o código sobre o texto quando os dois existem", () => {
    // Um erro de infraestrutura que por acaso contenha "não localizada" na
    // mensagem não pode virar 404.
    expect(statusDoErroPostgres({ code: "42501", message: "Avaliação não localizada." })).toBe(403);
  });
});

describe("respostaDeErro — marca de sessão renovável", () => {
  /*
    Os três códigos viram 401, mas só um deles melhora com uma renovação. A
    marca é o que impede o cliente de gastar renovação e repetição num 401 que
    vai falhar igual — e é aqui, no servidor, que a distinção existe: a tela só
    enxerga o status.
  */
  async function corpoDe(erro: { code: string; message: string }) {
    return (await respostaDeErro(erro, "teste").json()) as { mensagem: string; codigo?: string };
  }

  it("marca PGRST301 (JWT expirado) como renovável", async () => {
    expect(await corpoDe({ code: "PGRST301", message: "JWT expired" }))
      .toMatchObject({ codigo: "SESSAO_RENOVAVEL" });
  });

  it("não marca assinatura inválida nem acesso anônimo desabilitado", async () => {
    // Renovar devolve um token emitido pela mesma chave: falharia igual.
    expect(await corpoDe({ code: "PGRST303", message: "JWSError JWSInvalidSignature" }))
      .not.toHaveProperty("codigo");
    expect(await corpoDe({ code: "PGRST302", message: "Anonymous access is disabled" }))
      .not.toHaveProperty("codigo");
  });

  it("continua devolvendo a frase que conduz à ação, sem o texto interno do PostgREST", async () => {
    const corpo = await corpoDe({ code: "PGRST301", message: "JWT expired" });
    expect(corpo.mensagem).toBe("A sua sessão expirou. Entre novamente para continuar.");
  });
});
