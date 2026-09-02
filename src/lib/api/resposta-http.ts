import { NextResponse } from "next/server";
import { ERRO_SESSAO_RENOVAVEL, type ErroApi } from "./contratos";

type ErroPostgres = {
  code?: string;
  message?: string;
  details?: string | null;
};

/*
  Classificação por texto, porque o SQLSTATE quase nunca vem: das 399
  ocorrências de `raise exception` nas funções de `sigav`, só 18 declaram
  `using errcode`. Todas as outras chegam como `P0001`, e então o único sinal
  disponível é a frase.

  As duas últimas entradas cobrem "não possui permissão", a redação de 14
  recusas distintas ("Seu perfil não possui permissão para…", "Você não possui
  permissão para…"). Elas não casavam com `/sem permiss/i` e caíam no `P0001`
  do fim, virando 409 — e `ErroDeApi.exigePermissao` testa `status === 403`,
  então a tela tratava recusa de permissão como conflito e não mostrava
  "acesso restrito". Conferido contra o catálogo do banco em 02/09/2026.

  A variante sem acento acompanha cada uma porque a mensagem pode vir de
  migration antiga escrita sem acentuação — mesmo motivo de `nao autorizad`.
*/
const PADROES_DE_RECUSA = [
  /acesso restrito/i,
  /sem permiss/i,
  /não autorizad/i,
  /nao autorizad/i,
  /não possui permiss/i,
  /nao possui permiss/i,
];

const PADROES_DE_AUSENCIA = [
  /não localizad/i,
  /nao localizad/i,
  /não encontrad/i,
  /nao encontrad/i,
  /inexistente/i,
];

export function statusDoErroPostgres(erro: ErroPostgres): number {
  const codigo = erro.code ?? "";
  const mensagem = erro.message ?? "";

  if (codigo === "PGRST301" || codigo === "PGRST302" || codigo === "PGRST303") return 401;
  if (codigo === "42501") return 403;
  if (codigo === "PGRST202") return 501;
  if (codigo === "23505") return 409;
  if (codigo === "23514" || codigo === "22P02") return 422;

  if (PADROES_DE_RECUSA.some((padrao) => padrao.test(mensagem))) return 403;
  if (PADROES_DE_AUSENCIA.some((padrao) => padrao.test(mensagem))) return 404;
  if (codigo === "P0001") return 409;

  /*
    `22023` (invalid_parameter_value) é o segundo — e último — SQLSTATE que as
    funções de `sigav` levantam de propósito: 12 usos de `42501` e 6 dele.

    Faltava aqui, e o efeito era pior do que um status errado: caindo no 500 do
    fim, `respostaDeErro` trocava a mensagem do banco pela genérica, e a tela de
    acessos recebia "Não foi possível concluir a operação. Tente novamente em
    instantes." no lugar de "Permissões desconhecidas: VOAR" — erro de validação
    exibido como falha do servidor, sem dizer o que estava errado, e convidando
    a repetir uma operação que nunca vai passar.

    A POSIÇÃO importa, e é a mesma escolhida para `P0001` logo acima: depois dos
    padrões de mensagem. As seis ocorrências não querem o mesmo status —
    "Pessoa ativa não encontrada." é ausência (404) e as outras cinco são
    entrada inválida (422). Conferido contra o banco: só essa casa com
    `PADROES_DE_AUSENCIA`. Testar o código antes dos padrões devolveria 422 para
    ela e transformaria uma correção em regressão.
  */
  if (codigo === "22023") return 422;

  return 500;
}

function jwtExpirado(erro: ErroPostgres) {
  return erro.code === "PGRST301" && /jwt\s+expired/i.test(erro.message ?? "");
}

export function respostaDeErro(erro: ErroPostgres, contexto: string) {
  const status = statusDoErroPostgres(erro);

  if (status >= 500) {
    console.error(`[api] ${contexto}`, erro.code, erro.message, erro.details);
    const corpo: ErroApi = {
      mensagem: status === 501
        ? "A função necessária não está disponível no banco deste ambiente. Confirme o deploy e as migrations."
        : "Não foi possível concluir a operação. Tente novamente em instantes.",
    };
    return NextResponse.json(corpo, { status });
  }

  if (status === 401) {
    console.warn(`[api] ${contexto}`, erro.code, erro.message);

    // PGRST301 é uma categoria ampla: também cobre JWT inválido ou que não pode
    // ser decodificado. Só o caso explicitamente expirado é recuperável por
    // refresh; os demais 401 devem subir sem repetição automática.
    const corpo: ErroApi = {
      mensagem: "A sua sessão expirou. Entre novamente para continuar.",
      ...(jwtExpirado(erro) ? { codigo: ERRO_SESSAO_RENOVAVEL } : {}),
    };
    return NextResponse.json(corpo, { status });
  }

  const corpo: ErroApi = {
    mensagem: erro.message?.trim() || "Não foi possível concluir a operação.",
  };
  return NextResponse.json(corpo, { status });
}

export function respostaDeEntradaInvalida(mensagem: string) {
  return NextResponse.json({ mensagem } satisfies ErroApi, { status: 400 });
}

export function respostaDeFalha(status: number, mensagem: string) {
  return NextResponse.json({ mensagem } satisfies ErroApi, { status });
}
