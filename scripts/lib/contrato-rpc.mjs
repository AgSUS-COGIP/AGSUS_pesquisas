import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O contrato mínimo de RPC, lido e conferido num lugar só.
 *
 * Dois consumidores precisam da mesma resposta em momentos diferentes:
 *
 * - `smoke-rpc-contract.mjs`, depois de aplicar as migrations, para dizer se o
 *   push cumpriu o que prometeu;
 * - `vercel-ignore-build.mjs`, antes de publicar a aplicação, para dizer se o
 *   banco já suporta a versão que está prestes a subir.
 *
 * São a mesma pergunta feita dos dois lados do deploy. Deixar cada script com a
 * sua cópia faria as duas divergirem na primeira correção — e a divergência
 * apareceria como um deploy aprovado por um critério e recusado pelo outro, sem
 * nada explicando por quê.
 */

const FUNCAO = "fc_srv_verificar_contrato_rpc";

/**
 * Lê `RPCS_CRITICAS` do TypeScript em vez de duplicá-la aqui.
 *
 * O arquivo é uma lista de literais, então extrair por texto é suficiente e
 * evita depender de um passo de build. Os comentários saem **antes** da
 * extração: o padrão casa qualquer literal entre aspas, e o bloco tem
 * comentários explicando por que cada nome está ali — bastaria um deles citar
 * uma RPC entre aspas duplas para o contrato passar a exigir do banco uma
 * função que ninguém chama.
 */
export function lerContratoCritico(raiz) {
  const fonte = readFileSync(join(raiz, "src/lib/rpc-criticas.ts"), "utf8");
  const bloco = fonte.match(/RPCS_CRITICAS\s*=\s*\[([\s\S]*?)\]\s*as const/);
  if (!bloco) throw new Error("Não foi possível ler RPCS_CRITICAS de src/lib/rpc-criticas.ts");

  const semComentarios = bloco[1]
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ");

  const nomes = [...semComentarios.matchAll(/"([a-z0-9_]+)"/g)].map((m) => m[1]);
  if (!nomes.length) throw new Error("RPCS_CRITICAS está vazia.");
  return nomes;
}

/** Primeiro valor não vazio entre as variáveis de ambiente informadas. */
export function variavel(...nomes) {
  for (const nome of nomes) {
    const valor = process.env[nome];
    if (valor && valor.trim()) return valor.trim();
  }
  return "";
}

/**
 * Pergunta ao banco quais das funções informadas não existem.
 *
 * O retorno é sempre um objeto com `situacao`, nunca uma exceção: quem chama
 * precisa **decidir** (barrar o deploy, falhar o smoke), e um `throw` no meio
 * disso obrigaria cada consumidor a reconstruir a mesma classificação.
 *
 *   `compativel`   todas presentes
 *   `incompleto`   faltam funções — `ausentes` diz quais
 *   `indisponivel` não deu para perguntar (credencial, rede, ou a própria
 *                  função de verificação ausente, que já é a resposta)
 */
export async function verificarContrato({ url, chave, nomes }) {
  if (!url || !chave) {
    return { situacao: "indisponivel", motivo: "faltam a URL do Supabase e a chave de service role" };
  }

  let resposta;
  try {
    resposta = await fetch(`${url.replace(/\/+$/, "")}/rest/v1/rpc/${FUNCAO}`, {
      method: "POST",
      headers: {
        apikey: chave,
        Authorization: `Bearer ${chave}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_nomes: nomes }),
    });
  } catch (erro) {
    return { situacao: "indisponivel", motivo: `falha de rede ao consultar o banco (${erro?.message ?? erro})` };
  }

  const texto = await resposta.text();

  if (!resposta.ok) {
    // A própria função de verificação pode faltar — e isso **é** o defeito
    // procurado, não um erro de infraestrutura a ser tolerado.
    const pista = texto.includes(FUNCAO)
      ? `a migration que cria ${FUNCAO} não foi aplicada`
      : `HTTP ${resposta.status}`;
    return { situacao: "indisponivel", motivo: pista, detalhe: texto };
  }

  let resultado;
  try {
    resultado = JSON.parse(texto);
  } catch {
    return { situacao: "indisponivel", motivo: "o banco devolveu uma resposta que não é JSON" };
  }

  const ausentes = Array.isArray(resultado?.missing) ? resultado.missing : [];
  const conferidas = Number(resultado?.checked) || nomes.length;

  return resultado?.compatible
    ? { situacao: "compativel", conferidas }
    : { situacao: "incompleto", conferidas, ausentes };
}
