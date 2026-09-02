import { describe, expect, it } from "vitest";
import { isRpcAllowedForRole, RPC_PERMISSIONS, type RpcRole } from "./rpc-permissions";

/*
 * `rpc-permissions.ts` diz de si mesmo que é "a ÚNICA linha de defesa que
 * impede uma sessão autenticada comum de invocar uma função pensada para
 * cron/serviço". Até aqui essa afirmação não tinha teste nenhum: o que existe
 * em `tests/banco/contrato-rpc.test.mjs` prova a segunda camada (o corpo da
 * função no banco recusa), e prova por amostra de UMA função.
 *
 * A diferença importa. Se o allowlist errar, a chamada chega ao banco; e só
 * parte das funções de serviço tem verificação própria no corpo. Este arquivo
 * cobre a primeira camada — de graça, sem banco — e cobre TODAS as entradas,
 * não uma amostra.
 *
 * A lista é gerada (replay dos GRANT/REVOKE das 192 migrations). Testar arquivo
 * gerado parece redundante, e é exatamente o oposto: o gerador não roda no CI,
 * então a próxima edição desta lista vai ser à mão, apressada, no meio de um
 * incidente. É esse commit que estes testes esperam.
 */

const PAPEIS: readonly RpcRole[] = ["anon", "authenticated", "service_role"];
const NOMES = Object.keys(RPC_PERMISSIONS);

/**
 * Superfície anônima, escrita à mão de propósito.
 *
 * Estas duas são o que sobrou dos buckets públicos do Storage: a arte de fundo
 * aparece antes do login e a capa da pesquisa aparece em `/responder/[código]`.
 * Qualquer terceira função alcançável sem sessão é decisão de segurança, e uma
 * decisão de segurança não deve poder entrar junto com outra coisa num commit
 * de terça-feira. Aumentar esta lista aqui é o passo que torna a escolha
 * explícita.
 */
const SUPERFICIE_ANONIMA = ["FC_ARQ_OBTER", "FC_OBTER_MARCA_PUBLICA"];

describe("o portão recusa o que não conhece", () => {
  it.each(PAPEIS)("função fora do allowlist é negada para %s", (papel) => {
    expect(isRpcAllowedForRole("FC_FUNCAO_QUE_NAO_EXISTE", papel)).toBe(false);
  });

  it("nome vazio é negado", () => {
    for (const papel of PAPEIS) {
      expect(isRpcAllowedForRole("", papel)).toBe(false);
    }
  });

  /*
    O projeto passou por uma padronização para MAIÚSCULAS (migrations
    `20260831150000` em diante) e o adaptador cita o nome entre aspas, então
    caixa errada não é erro teórico: é o modo de falha da transição. O portão é
    sensível à caixa, e é melhor assim — negar é o lado seguro. O que este teste
    fixa é que negar seja o comportamento, e não um `TypeError` ou um `true`.
  */
  it("o mesmo nome em minúsculas é negado", () => {
    expect(isRpcAllowedForRole("FC_OBTER_MARCA_PUBLICA", "anon")).toBe(true);
    expect(isRpcAllowedForRole("fc_obter_marca_publica", "anon")).toBe(false);
    expect(isRpcAllowedForRole("Fc_Obter_Marca_Publica", "anon")).toBe(false);
  });

  it("nome com espaço em volta é negado", () => {
    // O adaptador não faz trim. Se um dia fizer, este teste vira o lugar de
    // registrar a mudança em vez de descobri-la em produção.
    expect(isRpcAllowedForRole(" FC_OBTER_MARCA_PUBLICA", "anon")).toBe(false);
    expect(isRpcAllowedForRole("FC_OBTER_MARCA_PUBLICA ", "anon")).toBe(false);
  });

  /*
    Chave herdada de `Object.prototype` nega, e nega SEM lançar.

    `RPC_PERMISSIONS` é objeto literal, então `RPC_PERMISSIONS["toString"]`
    devolve a função herdada. Antes de 02/09/2026 o portão lia esse valor e
    chamava `roles.includes(...)` nele — `TypeError`, não `false`. Um portão de
    autorização que estoura onde deveria negar só é seguro enquanto ninguém lhe
    passa a chave errada, e essa não é uma propriedade que se queira depender.
  */
  it.each(["toString", "constructor", "valueOf", "hasOwnProperty", "__defineGetter__"])(
    "a chave herdada %s é negada, sem lançar",
    (herdada) => {
      for (const papel of PAPEIS) {
        expect(isRpcAllowedForRole(herdada, papel)).toBe(false);
      }
    },
  );

  it("nenhum nome herdado entrou na tabela por acidente", () => {
    // A checagem acima só protege se essas chaves de fato não forem RPCs. Se
    // alguém um dia registrar uma função chamada `toString`, é melhor descobrir
    // por aqui do que pelo comportamento do portão.
    for (const herdada of ["toString", "constructor", "valueOf", "hasOwnProperty"]) {
      expect(Object.hasOwn(RPC_PERMISSIONS, herdada)).toBe(false);
    }
  });
});

describe("superfície anônima", () => {
  it("é exatamente a lista revisada", () => {
    const alcancaveisSemSessao = NOMES.filter((nome) =>
      isRpcAllowedForRole(nome, "anon"),
    ).sort();
    expect(alcancaveisSemSessao).toEqual([...SUPERFICIE_ANONIMA].sort());
  });

  it("tudo o que anon alcança, uma sessão comum também alcança", () => {
    // O contrário seria uma rota pública que para de funcionar depois do login.
    for (const nome of SUPERFICIE_ANONIMA) {
      expect(isRpcAllowedForRole(nome, "authenticated")).toBe(true);
    }
  });
});

describe("separação entre sessão comum e serviço", () => {
  const somenteServico = NOMES.filter((nome) => {
    const papeis = RPC_PERMISSIONS[nome];
    return papeis.length === 1 && papeis[0] === "service_role";
  });

  it("existe um conjunto de funções exclusivas de serviço", () => {
    expect(somenteServico.length).toBeGreaterThan(0);
  });

  it.each(somenteServico)("%s é inalcançável por sessão comum e por anônimo", (nome) => {
    expect(isRpcAllowedForRole(nome, "service_role")).toBe(true);
    expect(isRpcAllowedForRole(nome, "authenticated")).toBe(false);
    expect(isRpcAllowedForRole(nome, "anon")).toBe(false);
  });

  /*
    `FC_SRV_` é prefixo com significado de segurança: marca o que roda por cron,
    fila de e-mail ou callback de login — sempre sem sessão de pessoa. A regra
    vale nos dois sentidos, e é o sentido inverso que este teste protege: uma
    função nova nomeada `FC_SRV_*` que entre no allowlist como `authenticated`
    passaria por revisão de código sem chamar atenção, porque o nome diz uma
    coisa e a entrada diz outra.
  */
  it("todo nome FC_SRV_* é exclusivo de serviço", () => {
    const desalinhadas = NOMES.filter(
      (nome) => nome.startsWith("FC_SRV_") && !somenteServico.includes(nome),
    );
    expect(desalinhadas).toEqual([]);
  });

  it("nenhuma função de serviço é também anônima", () => {
    // Seria o pior dos dois mundos: alcançável sem sessão E com poder de cron.
    const abertas = NOMES.filter(
      (nome) =>
        RPC_PERMISSIONS[nome].includes("service_role") &&
        RPC_PERMISSIONS[nome].includes("anon") &&
        !SUPERFICIE_ANONIMA.includes(nome),
    );
    expect(abertas).toEqual([]);
  });
});

describe("integridade da tabela", () => {
  it("nenhuma entrada sem papel", () => {
    // Entrada com array vazio é negação para todo mundo — a função existiria no
    // allowlist e não funcionaria para ninguém, sintoma difícil de ler.
    const vazias = NOMES.filter((nome) => RPC_PERMISSIONS[nome].length === 0);
    expect(vazias).toEqual([]);
  });

  it("nenhum papel inventado", () => {
    const invalidos = NOMES.flatMap((nome) =>
      RPC_PERMISSIONS[nome]
        .filter((papel) => !PAPEIS.includes(papel))
        .map((papel) => `${nome}: ${papel}`),
    );
    expect(invalidos).toEqual([]);
  });

  it("nenhum papel repetido na mesma entrada", () => {
    const repetidos = NOMES.filter(
      (nome) => new Set(RPC_PERMISSIONS[nome]).size !== RPC_PERMISSIONS[nome].length,
    );
    expect(repetidos).toEqual([]);
  });

  /*
    O adaptador monta `select * from sigav."NOME"(...)` interpolando o nome
    direto, com `quoteIdent` cuidando só das aspas. O allowlist é o que garante
    que o nome interpolado seja um identificador conhecido, e não texto vindo de
    outro lugar. Fixar o formato aqui mantém essa garantia legível.
  */
  it("todo nome tem o formato de identificador esperado", () => {
    const foraDoPadrao = NOMES.filter((nome) => !/^FC_[A-Z0-9_]+$/.test(nome));
    expect(foraDoPadrao).toEqual([]);
  });

  it("a tabela não está vazia", () => {
    // Um `export const RPC_PERMISSIONS = {}` por acidente de merge negaria toda
    // chamada da plataforma, e todo teste acima passaria alegremente.
    expect(NOMES.length).toBeGreaterThan(100);
  });
});
