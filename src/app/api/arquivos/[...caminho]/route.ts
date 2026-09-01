import { NextResponse } from "next/server";
import { createPublicRpcClient, createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida, respostaDeFalha } from "@/lib/api/resposta-http";
import { BALDES, TIPOS_DE_IMAGEM, TAMANHO_MAXIMO_ARQUIVO, type Balde } from "@/lib/api/contratos-arquivos";

/**
 * Imagens da plataforma, no lugar do Storage do banco.
 *
 * O endereço reproduz o dos buckets — `<balde>/<caminho>` — de propósito: os
 * caminhos já gravados em `accessBackgroundPath` e no `settings` das aplicações
 * continuam válidos, e a migração não precisou reescrever configuração alguma.
 *
 * O GET é público, como os buckets eram: a arte de fundo é exibida antes do
 * login e a capa de pesquisa aparece em `/responder/[applicationCode]`. PUT e
 * DELETE exigem sessão aqui e `can_manage_surveys()` no corpo da RPC.
 */
export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ caminho: string[] }> };

/** Separa `['platform-assets','branding','arte.png']` em balde e caminho. */
function partirEndereco(segmentos: string[]) {
  const [balde, ...resto] = segmentos.map((s) => decodeURIComponent(s));
  if (!balde || !BALDES.includes(balde as Balde) || !resto.length) return null;
  return { balde: balde as Balde, caminho: resto.join("/") };
}

export async function GET(request: Request, { params }: Contexto) {
  const { caminho: segmentos } = await params;
  const endereco = partirEndereco(segmentos ?? []);
  if (!endereco) return respostaDeFalha(404, "Arquivo não encontrado.");

  // Cliente anônimo de propósito: a leitura não depende de sessão, e usar o
  // cliente de sessão faria a rota pública custar uma resolução de identidade a
  // cada imagem carregada na tela de acesso.
  const banco = createPublicRpcClient();
  const { data, error } = await banco.rpc("FC_ARQ_OBTER", {
    p_balde: endereco.balde,
    p_caminho: endereco.caminho,
  });

  if (error) return respostaDeErro(error, "GET /api/arquivos/[...caminho]");

  const linha = (data as { conteudo: Buffer; tipo: string; atualizado_em: string }[] | null)?.[0];
  if (!linha) return respostaDeFalha(404, "Arquivo não encontrado.");

  // O ETag deriva do instante de atualização em ISO — `String(Date)` daria a
  // representação de locale do servidor, que muda de máquina para máquina e
  // invalidaria o cache sem que o arquivo tivesse mudado.
  const etag = `"${Buffer.from(new Date(linha.atualizado_em).toISOString()).toString("base64url")}"`;

  // Substituir a capa pelo mesmo caminho muda `"DT_ALTERACAO"`, logo muda o
  // ETag: a imagem nova aparece na revalidação seguinte sem depender do `?v=`
  // que as telas acrescentam.
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: { ETag: etag, "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
    });
  }

  return new NextResponse(new Uint8Array(linha.conteudo), {
    headers: {
      "Content-Type": linha.tipo,
      "Content-Length": String(linha.conteudo.length),
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      ETag: etag,
      // Servidos da própria origem, ao contrário do bucket. `nosniff` impede o
      // navegador de reinterpretar o tipo declarado, e `inline` evita download
      // forçado. Não adianta mandar CSP aqui: `next.config.ts` define uma
      // política global em `headers()`, que substitui a da resposta. A defesa
      // contra arquivo ativo é o allowlist de tipo — PNG, JPEG e WEBP —, que
      // vale tanto na rota quanto na constraint `ck_tb_arquivo_tipo`.
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}

export async function PUT(request: Request, { params }: Contexto) {
  const { caminho: segmentos } = await params;
  const endereco = partirEndereco(segmentos ?? []);
  if (!endereco) return respostaDeEntradaInvalida("Informe o balde e o caminho do arquivo.");

  const tipo = (request.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!TIPOS_DE_IMAGEM.includes(tipo as (typeof TIPOS_DE_IMAGEM)[number])) {
    return respostaDeEntradaInvalida("Use uma imagem PNG, JPG ou WEBP.");
  }

  const conteudo = Buffer.from(await request.arrayBuffer());
  if (!conteudo.length) return respostaDeEntradaInvalida("O arquivo enviado está vazio.");
  if (conteudo.length > TAMANHO_MAXIMO_ARQUIVO) {
    return respostaDeEntradaInvalida("A imagem precisa ter até 5 MB.");
  }

  const banco = await createServerRpcClient();
  const { data, error } = await banco.rpc("FC_ARQ_GRAVAR", {
    p_balde: endereco.balde,
    p_caminho: endereco.caminho,
    p_tipo: tipo,
    // O adaptador vincula parâmetros pelo driver, que não tem tipo próprio para
    // `bytea` vindo de JSON. Base64 explícito, decodificado no corpo da função,
    // evita depender da inferência de tipo do node-postgres.
    p_conteudo_base64: conteudo.toString("base64"),
  });

  if (error) return respostaDeErro(error, "PUT /api/arquivos/[...caminho]");

  return NextResponse.json(data);
}

export async function DELETE(_request: Request, { params }: Contexto) {
  const { caminho: segmentos } = await params;
  const endereco = partirEndereco(segmentos ?? []);
  if (!endereco) return respostaDeEntradaInvalida("Informe o balde e o caminho do arquivo.");

  const banco = await createServerRpcClient();
  const { data, error } = await banco.rpc("FC_ARQ_REMOVER", {
    p_balde: endereco.balde,
    p_caminho: endereco.caminho,
  });

  if (error) return respostaDeErro(error, "DELETE /api/arquivos/[...caminho]");

  return NextResponse.json(data);
}
