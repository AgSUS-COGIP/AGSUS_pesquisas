import { chamar } from "./requisicao";
import type { ArquivoGravado, ArquivoListado, Balde } from "./contratos-arquivos";

/**
 * Envio e remoção de imagens da plataforma.
 *
 * Antes o navegador falava direto com o Storage do banco, autenticado pelo
 * cookie e autorizado pelas políticas do bucket. Sem bucket, o upload passa a
 * atravessar a aplicação — é o único caminho pelo qual o navegador alcança o
 * Postgres. O corpo vai como binário puro, e não `multipart`: há exatamente um
 * arquivo por requisição, e o tipo já viaja no cabeçalho.
 */

function endereco(balde: Balde, caminho: string) {
  const partes = caminho.split("/").map(encodeURIComponent).join("/");
  return `/api/arquivos/${balde}/${partes}`;
}

export function enviarArquivo(balde: Balde, caminho: string, arquivo: File) {
  return chamar<ArquivoGravado>(endereco(balde, caminho), {
    method: "PUT",
    body: arquivo,
    // Sobrescreve o `application/json` que `chamar` aplicaria por haver corpo:
    // aqui o tipo do arquivo é o que a rota valida e o que o banco guarda.
    headers: { "Content-Type": arquivo.type },
  });
}

export function removerArquivo(balde: Balde, caminho: string) {
  return chamar<{ removidos: number }>(endereco(balde, caminho), { method: "DELETE" });
}

export function listarArquivos(balde: Balde, prefixo = "") {
  const parametros = new URLSearchParams({ balde, prefixo });
  return chamar<ArquivoListado[]>(`/api/arquivos/listagem?${parametros}`);
}
