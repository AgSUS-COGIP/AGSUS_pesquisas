import { NextResponse } from "next/server";
import type { ErroApi } from "./contratos";

/**
 * Tradução de erro do PostgreSQL para status HTTP.
 *
 * O status é o que permite à tela tratar 403 com a guarda de acesso, 404 com
 * estado vazio e só cair no toast genérico em 5xx.
 *
 * A classificação é por `code` do Postgres quando existe (estável e
 * documentado), e por texto da mensagem apenas para as exceções que as RPCs
 * levantam sem `errcode` — `raise exception` sem cláusula usa `P0001`
 * (raise_exception) para todas, então o texto é o único sinal disponível.
 */

type ErroPostgres = {
  code?: string;
  message?: string;
  details?: string | null;
};

/** Frases com que as RPCs deste projeto recusam por autorização. */
const PADROES_DE_RECUSA = [
  /acesso restrito/i,
  /sem permiss/i,
  /não autorizad/i,
  /nao autorizad/i,
];

/** Frases com que as RPCs deste projeto sinalizam recurso inexistente. */
const PADROES_DE_AUSENCIA = [
  /não localizad/i,
  /nao localizad/i,
  /não encontrad/i,
  /nao encontrad/i,
  /inexistente/i,
];

/**
 * Deriva o status HTTP de um erro vindo do Supabase.
 *
 * Exportada para teste: um erro classificado como 500 quando era 403 esconde um
 * problema de permissão atrás de "erro interno".
 */
export function statusDoErroPostgres(erro: ErroPostgres): number {
  const codigo = erro.code ?? "";
  const mensagem = erro.message ?? "";

  // `42501` (insufficient_privilege) é o que a própria RLS levanta quando a
  // política barra a operação — a rede de proteção do banco atuando.
  if (codigo === "42501") return 403;

  // `PGRST202` é a função ausente do cache de esquema: migration não aplicada
  // neste ambiente. Não é erro do cliente nem falha transitória — é
  // configuração, e 501 diz isso sem sugerir que tentar de novo resolve.
  if (codigo === "PGRST202") return 501;

  // `23505` é unique_violation: código de avaliação repetido, por exemplo.
  if (codigo === "23505") return 409;

  // `23514` é check_violation e `22P02` é entrada malformada — os dois são
  // dado inválido enviado pelo cliente.
  if (codigo === "23514" || codigo === "22P02") return 422;

  if (PADROES_DE_RECUSA.some((padrao) => padrao.test(mensagem))) return 403;
  if (PADROES_DE_AUSENCIA.some((padrao) => padrao.test(mensagem))) return 404;

  // `P0001` sem padrão reconhecido é regra de negócio recusando a operação:
  // período fechado, ciclo já aberto, rascunho com resposta. O pedido está
  // bem formado, mas o estado atual não permite — 409 é o que descreve isso.
  if (codigo === "P0001") return 409;

  return 500;
}

/**
 * Converte erro do Supabase em resposta HTTP.
 *
 * A mensagem do banco é repassada à tela quando o erro é do cliente (4xx):
 * as RPCs deste projeto escrevem exceções em português voltadas ao operador
 * ("Esta avaliação não tem versão com estrutura para copiar"), e reescrevê-las
 * na rota só perderia informação.
 *
 * Em 5xx a mensagem original **não** é repassada: erro interno pode carregar
 * nome de coluna, trecho de SQL ou dado de outra pessoa. O servidor registra o
 * detalhe no log e a tela recebe texto genérico.
 */
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

  const corpo: ErroApi = {
    mensagem: erro.message?.trim() || "Não foi possível concluir a operação.",
  };
  return NextResponse.json(corpo, { status });
}

/** Resposta de pedido malformado, antes de qualquer ida ao banco. */
export function respostaDeEntradaInvalida(mensagem: string) {
  return NextResponse.json({ mensagem } satisfies ErroApi, { status: 400 });
}
