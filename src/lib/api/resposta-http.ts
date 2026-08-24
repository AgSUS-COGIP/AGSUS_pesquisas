import { NextResponse } from "next/server";
import { ERRO_SESSAO_RENOVAVEL, type ErroApi } from "./contratos";

type ErroPostgres = {
  code?: string;
  message?: string;
  details?: string | null;
};

const PADROES_DE_RECUSA = [
  /acesso restrito/i,
  /sem permiss/i,
  /não autorizad/i,
  /nao autorizad/i,
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
