import { describe, expect, it } from "vitest";
import { statusDoErroPostgres } from "./resposta-http";

/*
 * A tradução de SQLSTATE para status HTTP decide duas coisas ao mesmo tempo, e a
 * segunda é a que passa desapercebida: o status, e se a MENSAGEM do banco chega
 * à tela. `respostaDeErro` substitui o texto pelo genérico em tudo `>= 500`, de
 * modo que classificar um erro de validação como 500 não deixa só o status
 * errado — apaga a única frase que dizia o que corrigir.
 *
 * As duas famílias abaixo são as que as funções de `sigav` levantam de
 * propósito: 12 usos de `42501` e 6 de `22023`, conferido no catálogo. O resto
 * são códigos nativos do PostgreSQL ou herdados do PostgREST.
 */

describe("recusa e sessão", () => {
  it.each(["PGRST301", "PGRST302", "PGRST303"])("%s é sessão inválida", (codigo) => {
    expect(statusDoErroPostgres({ code: codigo })).toBe(401);
  });

  it("42501 é falta de permissão", () => {
    // O mais usado pelas funções de sigav, e o que o adaptador também devolve
    // quando o allowlist recusa antes de tocar o banco.
    expect(statusDoErroPostgres({ code: "42501", message: "Acesso restrito." })).toBe(403);
  });

  it("PGRST202 é ambiente atrás da migration", () => {
    // 501 carrega a mensagem "confirme o deploy e as migrations". É o sinal de
    // rollout app-before-db, e o adaptador traduz o 42883 nativo para cá.
    expect(statusDoErroPostgres({ code: "PGRST202" })).toBe(501);
  });
});

describe("entrada inválida e conflito", () => {
  it("23505 é conflito de unicidade", () => {
    expect(statusDoErroPostgres({ code: "23505" })).toBe(409);
  });

  it.each(["23514", "22P02"])("%s é entrada que o banco recusa", (codigo) => {
    expect(statusDoErroPostgres({ code: codigo })).toBe(422);
  });

  /*
    `22023` (invalid_parameter_value) faltava e caía no 500 do fim — com a
    mensagem trocada pela genérica no caminho. Quem digitasse um módulo
    inexistente na tela de acessos lia "Não foi possível concluir a operação.
    Tente novamente em instantes." em vez de "Permissões desconhecidas: VOAR":
    erro de validação vestido de falha de servidor, convidando a repetir uma
    operação que nunca ia passar.
  */
  it("22023 é entrada inválida, e a mensagem sobrevive", () => {
    expect(statusDoErroPostgres({
      code: "22023",
      message: "Permissões desconhecidas: VOAR",
    })).toBe(422);
  });

  it.each([
    "Evento de manutenção desconhecido: X",
    "Caminho de arquivo inválido: ../x",
    "O conteúdo do arquivo é obrigatório.",
    "O caminho do arquivo é obrigatório.",
  ])("22023 com %s continua 422", (mensagem) => {
    // As outras cinco mensagens `22023` do catálogo. Nenhuma casa com os
    // padrões de ausência, então todas caem no código.
    expect(statusDoErroPostgres({ code: "22023", message: mensagem })).toBe(422);
  });

  /*
    A exceção, e a razão pela qual o teste de `22023` fica DEPOIS dos padrões de
    mensagem em `statusDoErroPostgres`. As seis ocorrências compartilham o
    SQLSTATE e não querem o mesmo status: esta é ausência de recurso, não
    entrada malformada. Se alguém mover o teste do código para antes dos
    padrões, este caso vira 422 e é aqui que se descobre.
  */
  it("22023 dizendo que não encontrou é 404, não 422", () => {
    expect(statusDoErroPostgres({
      code: "22023",
      message: "Pessoa ativa não encontrada.",
    })).toBe(404);
  });
});

describe("classificação pela mensagem, quando o código não basta", () => {
  /*
    Das 399 ocorrências de `raise exception` nas funções de `sigav`, só 18
    declaram `using errcode`. As outras chegam como `P0001`, e aí a frase é o
    único sinal — o que faz destes padrões parte da autorização, não um detalhe
    de apresentação.
  */
  it.each([
    "Acesso restrito à administração de permissões.",
    "Sem permissão para gravar arquivos.",
    "Não autorizado.",
  ])("%s é recusa", (mensagem) => {
    expect(statusDoErroPostgres({ code: "P0001", message: mensagem })).toBe(403);
  });

  /*
    A redação mais comum do schema, e a que escapava: 14 recusas distintas
    dizem "não possui permissão", que `/sem permiss/i` não pega. Caíam no 409 do
    `P0001`, e como `ErroDeApi.exigePermissao` testa `status === 403`, a tela
    tratava recusa como conflito.
  */
  it.each([
    "Seu perfil não possui permissão para gerenciar participantes.",
    "Seu perfil não possui permissão para consultar a base de pessoas.",
    "Você não possui permissão para criar pesquisas.",
    "Você não possui permissão para retirar esta pessoa.",
    "Voce nao possui permissao para incluir integrantes.",
  ])("%s é recusa", (mensagem) => {
    expect(statusDoErroPostgres({ code: "P0001", message: mensagem })).toBe(403);
  });

  it("não confunde negação de permissão com a proteção da própria permissão", () => {
    // "Você não pode retirar sua própria permissão de administrar acessos."
    // vem de `FC_DEFINIR_PERMISSOES_PESSOA` com errcode 42501 explícito, então
    // o código decide antes de a frase ser lida — e ela não casa com os
    // padrões, o que é correto: não é recusa de acesso, é regra de negócio.
    expect(statusDoErroPostgres({
      code: "42501",
      message: "Você não pode retirar sua própria permissão de administrar acessos.",
    })).toBe(403);
    expect(statusDoErroPostgres({
      code: "P0001",
      message: "Você não pode retirar sua própria permissão de administrar acessos.",
    })).toBe(409);
  });

  it.each(["Pesquisa não encontrada.", "Ciclo inexistente.", "Pessoa não localizada."])(
    "%s é ausência",
    (mensagem) => {
      expect(statusDoErroPostgres({ code: "P0001", message: mensagem })).toBe(404);
    },
  );

  it("P0001 sem pista na mensagem é conflito de regra de negócio", () => {
    expect(statusDoErroPostgres({ code: "P0001", message: "O ciclo já foi encerrado." })).toBe(409);
  });

  it("a recusa tem precedência sobre a ausência", () => {
    // Mensagem que casa com os dois padrões. Dizer 404 a quem foi recusado
    // revelaria que o recurso existe.
    expect(statusDoErroPostgres({
      code: "P0001",
      message: "Acesso restrito: pesquisa não encontrada para o seu perfil.",
    })).toBe(403);
  });
});

describe("o que não se reconhece é falha nossa", () => {
  it("código desconhecido é 500", () => {
    expect(statusDoErroPostgres({ code: "XX999", message: "erro interno" })).toBe(500);
  });

  it("erro sem código nem mensagem é 500", () => {
    // O caso de uma falha de conexão traduzida por `rpc-adapter.ts`: sem
    // SQLSTATE, porque nunca houve sessão no banco para produzir um.
    expect(statusDoErroPostgres({})).toBe(500);
    expect(statusDoErroPostgres({ message: "timeout exceeded when trying to connect" })).toBe(500);
  });
});
