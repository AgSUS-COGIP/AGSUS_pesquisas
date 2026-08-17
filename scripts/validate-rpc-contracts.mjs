/**
 * Confere cada `supabase.rpc(...)` do frontend contra as assinaturas reais do
 * banco reconstruído a partir das migrations.
 *
 * Por que esta porta existe
 * -------------------------
 * Em 10/08/2026 a plataforma caiu inteira porque uma migration removeu
 * `get_my_platform_context` enquanto o bundle publicado ainda a chamava pelo
 * nome. O erro é sempre o mesmo — `Could not find the function … in the schema
 * cache` — e não aparece em `typecheck`, `lint`, `test` nem `build`: o
 * acoplamento entre frontend e banco é por string, e nenhuma dessas ferramentas
 * lê SQL.
 *
 * O PostgREST resolve a função pelo **nome e pelo conjunto de argumentos
 * nomeados**. Errar o nome de um argumento produz exatamente o mesmo erro que
 * apagar a função, então os dois são verificados aqui.
 *
 * Como as assinaturas chegam
 * --------------------------
 * De `scripts/dump-rpc-signatures.sql`, executado contra o banco que o CI
 * reconstrói com `supabase db reset` — não de um retrato versionado, que
 * envelheceria em silêncio, nem de um parser de SQL nosso, que teria de
 * reimplementar `create or replace`, `drop` e sobrecarga para chegar ao mesmo
 * lugar. Sem o arquivo, o script não inventa: avisa e sai com sucesso, como
 * `db:naming` faz sem diff. **A porta real é o CI.**
 *
 * O que ele não consegue ver, ele declara
 * ---------------------------------------
 * Duas chamadas do construtor escolhem a função por ternário
 * (`supabase.rpc(rpc, args)`). O script resolve esse caso pareando os ramos do
 * nome com os ramos dos argumentos, na ordem. Qualquer chamada que ele não
 * consiga resolver é **listada na saída** em vez de sumir da contagem: silêncio
 * aqui seria pior que erro, porque leria como cobertura.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const SOURCE_ROOT = path.resolve(process.cwd(), "src");
const SIGNATURES_FILE = process.env.RPC_SIGNATURES ?? "";
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);

const CODE = 0;
const TEXT = 1;
const NOTE = 2;

/**
 * Marca cada caractere como código, texto literal ou comentário.
 *
 * Serve para que `.rpc(` dentro de uma string ou de um comentário não seja
 * confundido com chamada, e para que vírgula e parêntese dentro de texto não
 * quebrem a contagem de argumentos.
 *
 * Literal de expressão regular não é tratado — `/` sempre conta como divisão.
 * Uma regex contendo aspas abriria uma string fantasma, e o arquivo terminaria
 * com o estado aberto; é isso que `íntegro` denuncia, e o arquivo vira
 * "não verificável" em vez de gerar acusação falsa.
 */
function classificar(fonte) {
  const marca = new Uint8Array(fonte.length);
  const modelos = [];
  let estado = "codigo";
  let chaves = 0;
  let i = 0;

  while (i < fonte.length) {
    const atual = fonte[i];
    const proximo = fonte[i + 1];

    if (estado === "codigo") {
      if (atual === "/" && proximo === "/") {
        marca[i] = NOTE;
        marca[i + 1] = NOTE;
        estado = "linha";
        i += 2;
        continue;
      }
      if (atual === "/" && proximo === "*") {
        marca[i] = NOTE;
        marca[i + 1] = NOTE;
        estado = "bloco";
        i += 2;
        continue;
      }
      if (atual === "'" || atual === '"') {
        marca[i] = TEXT;
        estado = atual === "'" ? "simples" : "dupla";
        i += 1;
        continue;
      }
      if (atual === "`") {
        marca[i] = TEXT;
        estado = "modelo";
        i += 1;
        continue;
      }
      if (atual === "{") {
        chaves += 1;
      } else if (atual === "}") {
        chaves -= 1;
        if (modelos.length && modelos[modelos.length - 1] === chaves) {
          modelos.pop();
          marca[i] = TEXT;
          estado = "modelo";
          i += 1;
          continue;
        }
      }
      marca[i] = CODE;
      i += 1;
      continue;
    }

    if (estado === "linha") {
      if (atual === "\n") {
        marca[i] = CODE;
        estado = "codigo";
        i += 1;
        continue;
      }
      marca[i] = NOTE;
      i += 1;
      continue;
    }

    if (estado === "bloco") {
      if (atual === "*" && proximo === "/") {
        marca[i] = NOTE;
        marca[i + 1] = NOTE;
        estado = "codigo";
        i += 2;
        continue;
      }
      marca[i] = NOTE;
      i += 1;
      continue;
    }

    if (estado === "simples" || estado === "dupla") {
      const fecha = estado === "simples" ? "'" : '"';
      if (atual === "\\") {
        marca[i] = TEXT;
        marca[i + 1] = TEXT;
        i += 2;
        continue;
      }
      marca[i] = TEXT;
      if (atual === fecha) estado = "codigo";
      i += 1;
      continue;
    }

    // modelo (template literal)
    if (atual === "\\") {
      marca[i] = TEXT;
      marca[i + 1] = TEXT;
      i += 2;
      continue;
    }
    if (atual === "$" && proximo === "{") {
      marca[i] = TEXT;
      marca[i + 1] = TEXT;
      modelos.push(chaves);
      chaves += 1;
      estado = "codigo";
      i += 2;
      continue;
    }
    marca[i] = TEXT;
    if (atual === "`") estado = "codigo";
    i += 1;
    continue;
  }

  return { marca, integro: estado === "codigo" && modelos.length === 0 };
}

/** Divide o conteúdo de uma lista pelas vírgulas de nível superior. */
function separarPorVirgula(texto) {
  const { marca, integro } = classificar(texto);
  if (!integro) return null;

  const partes = [];
  let profundidade = 0;
  let inicio = 0;

  for (let i = 0; i < texto.length; i += 1) {
    if (marca[i] !== CODE) continue;
    const atual = texto[i];
    if (atual === "(" || atual === "[" || atual === "{") profundidade += 1;
    else if (atual === ")" || atual === "]" || atual === "}") profundidade -= 1;
    else if (atual === "," && profundidade === 0) {
      partes.push(texto.slice(inicio, i));
      inicio = i + 1;
    }
  }
  partes.push(texto.slice(inicio));
  return partes.map((parte) => parte.trim()).filter((parte) => parte.length > 0);
}

/** Lê os argumentos de uma chamada a partir do parêntese que a abre. */
function lerArgumentos(fonte, marca, aberturaIndex) {
  let profundidade = 0;
  for (let i = aberturaIndex; i < fonte.length; i += 1) {
    if (marca[i] !== CODE) continue;
    const atual = fonte[i];
    if (atual === "(" || atual === "[" || atual === "{") {
      profundidade += 1;
    } else if (atual === ")" || atual === "]" || atual === "}") {
      profundidade -= 1;
      if (profundidade === 0) {
        return separarPorVirgula(fonte.slice(aberturaIndex + 1, i));
      }
    }
  }
  return null;
}

/** Devolve o lado direito de `const <nome> = …;` declarado no arquivo. */
function lerInicializacao(fonte, marca, nome) {
  const padrao = new RegExp(`\\b(?:const|let|var)\\s+${nome}\\s*=`, "g");
  let achado;
  while ((achado = padrao.exec(fonte)) !== null) {
    const inicio = achado.index;
    if (marca[inicio] !== CODE) continue;

    let profundidade = 0;
    for (let i = achado.index + achado[0].length; i < fonte.length; i += 1) {
      if (marca[i] !== CODE) continue;
      const atual = fonte[i];
      if (atual === "(" || atual === "[" || atual === "{") profundidade += 1;
      else if (atual === ")" || atual === "]" || atual === "}") profundidade -= 1;
      else if (atual === ";" && profundidade === 0) {
        return fonte.slice(achado.index + achado[0].length, i).trim();
      }
      if (profundidade < 0) break;
    }
  }
  return null;
}

const LITERAL = /^(?:"([^"]*)"|'([^']*)'|`([^`$]*)`)$/;
const IDENTIFICADOR = /^[A-Za-z_$][\w$]*$/;

/** Ramos de uma expressão ternária de nível superior, ou null. */
function ramosDoTernario(texto) {
  const { marca, integro } = classificar(texto);
  if (!integro) return null;

  let profundidade = 0;
  for (let i = 0; i < texto.length; i += 1) {
    if (marca[i] !== CODE) continue;
    const atual = texto[i];
    if (atual === "(" || atual === "[" || atual === "{") profundidade += 1;
    else if (atual === ")" || atual === "]" || atual === "}") profundidade -= 1;
    else if (atual === "?" && profundidade === 0 && texto[i + 1] !== ".") {
      // O separador é o `:` de nível superior que vem depois.
      let interno = 0;
      for (let j = i + 1; j < texto.length; j += 1) {
        if (marca[j] !== CODE) continue;
        const c = texto[j];
        if (c === "(" || c === "[" || c === "{") interno += 1;
        else if (c === ")" || c === "]" || c === "}") interno -= 1;
        else if (c === ":" && interno === 0) {
          return [texto.slice(i + 1, j).trim(), texto.slice(j + 1).trim()];
        }
      }
      return null;
    }
  }
  return null;
}

/** Nomes de função possíveis para o primeiro argumento de `.rpc(...)`. */
function resolverNomes(expressao, fonte, marca) {
  const literal = LITERAL.exec(expressao);
  if (literal) return [literal[1] ?? literal[2] ?? literal[3]];

  if (IDENTIFICADOR.test(expressao)) {
    const inicializacao = lerInicializacao(fonte, marca, expressao);
    if (!inicializacao) return null;
    const ramos = ramosDoTernario(inicializacao);
    if (ramos) {
      const nomes = ramos.map((ramo) => LITERAL.exec(ramo)?.slice(1).find(Boolean));
      return nomes.every(Boolean) ? nomes : null;
    }
    const direto = LITERAL.exec(inicializacao);
    return direto ? [direto[1] ?? direto[2] ?? direto[3]] : null;
  }

  return null;
}

/** Chaves de um literal de objeto, resolvendo espalhamento de const local. */
function chavesDoObjeto(expressao, fonte, marca, visitados = new Set()) {
  if (!expressao.startsWith("{") || !expressao.endsWith("}")) return null;

  const partes = separarPorVirgula(expressao.slice(1, -1));
  if (partes === null) return null;

  const chaves = [];
  for (const parte of partes) {
    if (parte.startsWith("...")) {
      const origem = parte.slice(3).trim();
      if (!IDENTIFICADOR.test(origem) || visitados.has(origem)) return null;
      visitados.add(origem);
      const inicializacao = lerInicializacao(fonte, marca, origem);
      if (!inicializacao) return null;
      const espalhadas = chavesDoObjeto(inicializacao, fonte, marca, visitados);
      if (!espalhadas) return null;
      chaves.push(...espalhadas);
      continue;
    }

    const separador = separadorDeChave(parte);
    const bruta = separador === -1 ? parte : parte.slice(0, separador).trim();
    if (bruta.startsWith("[")) return null; // chave calculada
    const literal = LITERAL.exec(bruta);
    const chave = literal ? (literal[1] ?? literal[2] ?? literal[3]) : bruta;
    if (!IDENTIFICADOR.test(chave)) return null;
    chaves.push(chave);
  }
  return chaves;
}

/** Posição do `:` que separa chave de valor, ignorando o de tipo aninhado. */
function separadorDeChave(parte) {
  const { marca, integro } = classificar(parte);
  if (!integro) return -1;
  let profundidade = 0;
  for (let i = 0; i < parte.length; i += 1) {
    if (marca[i] !== CODE) continue;
    const atual = parte[i];
    if (atual === "(" || atual === "[" || atual === "{") profundidade += 1;
    else if (atual === ")" || atual === "]" || atual === "}") profundidade -= 1;
    else if (atual === ":" && profundidade === 0) return i;
  }
  return -1;
}

/** Conjuntos de argumentos possíveis para o segundo argumento de `.rpc(...)`. */
function resolverArgumentos(expressao, fonte, marca) {
  if (expressao === undefined) return [[]];

  const direto = chavesDoObjeto(expressao, fonte, marca);
  if (direto) return [direto];

  const ramos = ramosDoTernario(expressao);
  if (ramos) {
    const conjuntos = ramos.map((ramo) => chavesDoObjeto(ramo, fonte, marca));
    return conjuntos.every(Boolean) ? conjuntos : null;
  }

  if (IDENTIFICADOR.test(expressao)) {
    const inicializacao = lerInicializacao(fonte, marca, expressao);
    if (!inicializacao) return null;
    return resolverArgumentos(inicializacao, fonte, marca);
  }

  return null;
}

/**
 * Combina os ramos de nome com os de argumento.
 *
 * Ramos em igual número são pareados **na ordem** — é o formato do construtor,
 * onde a mesma condição escolhe a função e o conjunto de argumentos. Produto
 * cartesiano acusaria `add_survey_section` de receber os argumentos de
 * `update_survey_section`, que nenhuma execução monta.
 */
function combinar(nomes, conjuntos) {
  if (nomes.length === conjuntos.length) {
    return nomes.map((nome, indice) => ({ nome, argumentos: conjuntos[indice] }));
  }
  if (nomes.length === 1) {
    return conjuntos.map((argumentos) => ({ nome: nomes[0], argumentos }));
  }
  if (conjuntos.length === 1) {
    return nomes.map((nome) => ({ nome, argumentos: conjuntos[0] }));
  }
  return null;
}

async function listarFontes(diretorio) {
  const entradas = await readdir(diretorio, { withFileTypes: true });
  const arquivos = [];
  for (const entrada of entradas) {
    const completo = path.join(diretorio, entrada.name);
    if (entrada.isDirectory()) {
      arquivos.push(...(await listarFontes(completo)));
    } else if (SOURCE_EXTENSIONS.has(path.extname(entrada.name))) {
      arquivos.push(completo);
    }
  }
  return arquivos;
}

function linhaDe(fonte, indice) {
  let linha = 1;
  for (let i = 0; i < indice; i += 1) if (fonte[i] === "\n") linha += 1;
  return linha;
}

function conferir(chamada, assinaturas) {
  const sobrecargas = assinaturas.get(chamada.nome);
  if (!sobrecargas) {
    return `a função \`${chamada.nome}\` não existe no banco. Ou a migration que a cria não foi escrita, ou ela foi removida enquanto o frontend ainda a chama.`;
  }

  // Argumentos ilegíveis não impedem a checagem que mais importa: nome
  // inexistente é a falha de 10/08, e ele aqui é literal.
  if (chamada.argumentos === null) {
    return sobrecargas.some((sobrecarga) => sobrecarga.executavel)
      ? null
      : `\`${chamada.nome}\` existe, mas \`authenticated\` não tem EXECUTE. A chamada falha por permissão.`;
  }

  const passados = new Set(chamada.argumentos);
  const compativeis = sobrecargas.filter((sobrecarga) => {
    const aceitos = new Set(sobrecarga.parametros);
    const cobre = chamada.argumentos.every((chave) => aceitos.has(chave));
    const completa = sobrecarga.obrigatorios.every((chave) => passados.has(chave));
    return cobre && completa;
  });

  if (!compativeis.length) {
    const oferta = sobrecargas
      .map((s) => `(${s.parametros.join(", ") || "sem argumentos"})`)
      .join(" ou ");
    const enviado = chamada.argumentos.join(", ") || "sem argumentos";
    return `\`${chamada.nome}\` foi chamada com (${enviado}), mas o banco declara ${oferta}. O PostgREST resolve pelo nome dos argumentos: divergência aqui devolve o mesmo "Could not find the function" de função inexistente.`;
  }

  if (!compativeis.some((sobrecarga) => sobrecarga.executavel)) {
    return `\`${chamada.nome}\` existe, mas \`authenticated\` não tem EXECUTE. A chamada falha por permissão. Conceda o grant na migration que cria a função.`;
  }

  return null;
}

async function main() {
  if (!SIGNATURES_FILE) {
    console.log(
      "Nenhuma assinatura informada (RPC_SIGNATURES). A porta real é o CI, que gera o arquivo a partir do banco reconstruído.",
    );
    return;
  }

  const assinaturas = new Map();
  for (const registro of JSON.parse(await readFile(SIGNATURES_FILE, "utf8"))) {
    const lista = assinaturas.get(registro.nome) ?? [];
    lista.push({
      parametros: registro.parametros ?? [],
      obrigatorios: registro.obrigatorios ?? [],
      executavel: registro.executavel === true,
    });
    assinaturas.set(registro.nome, lista);
  }

  const erros = [];
  const opacos = [];
  const nomesVistos = new Set();
  let chamadasVerificadas = 0;
  let argumentosNaoLidos = 0;

  for (const arquivo of await listarFontes(SOURCE_ROOT)) {
    const fonte = await readFile(arquivo, "utf8");
    if (!fonte.includes(".rpc(")) continue;

    const relativo = path.relative(process.cwd(), arquivo).replaceAll("\\", "/");
    const { marca, integro } = classificar(fonte);
    if (!integro) {
      opacos.push(`${relativo}: não foi possível separar código de texto no arquivo.`);
      continue;
    }

    for (let i = 0; i + 5 < fonte.length; i += 1) {
      if (marca[i] !== CODE || !fonte.startsWith(".rpc(", i)) continue;

      const local = `${relativo}:${linhaDe(fonte, i)}`;
      const partes = lerArgumentos(fonte, marca, i + 4);
      if (!partes || !partes.length) {
        opacos.push(`${local}: chamada sem argumentos legíveis.`);
        continue;
      }

      const nomes = resolverNomes(partes[0], fonte, marca);
      if (!nomes) {
        opacos.push(`${local}: o nome da função não é resolvível estaticamente (\`${partes[0]}\`).`);
        continue;
      }

      const conjuntos = resolverArgumentos(partes[1], fonte, marca);
      if (!conjuntos) {
        // `null` marca "não li os argumentos"; o nome continua sendo conferido.
        opacos.push(
          `${local}: os argumentos de \`${nomes.join("/")}\` não são legíveis estaticamente — só o nome foi conferido.`,
        );
      }

      const chamadas = combinar(nomes, conjuntos ?? [null]);
      if (!chamadas) {
        opacos.push(`${local}: ${nomes.length} nomes e ${conjuntos.length} conjuntos de argumentos — não dá para parear.`);
        continue;
      }

      for (const chamada of chamadas) {
        nomesVistos.add(chamada.nome);
        chamadasVerificadas += 1;
        if (chamada.argumentos === null) argumentosNaoLidos += 1;
        const problema = conferir(chamada, assinaturas);
        if (problema) erros.push(`${local}: ${problema}`);
      }
    }
  }

  if (opacos.length) {
    console.log(`Chamadas não verificáveis (${opacos.length}):`);
    opacos.forEach((aviso) => console.log(`- ${aviso}`));
    console.log("");
  }

  if (erros.length) {
    console.error("Contratos de RPC quebrados:\n");
    erros.forEach((erro) => console.error(`- ${erro}`));
    console.error(
      "\nFrontend e banco são acoplados pelo nome da função. Publique o frontend antes de remover a RPC antiga, ou mantenha a antiga como ponte. Ver docs/operacao-permissoes.md.",
    );
    process.exitCode = 1;
    return;
  }

  const ressalva = argumentosNaoLidos
    ? ` Em ${argumentosNaoLidos} delas, só o nome foi conferido.`
    : "";
  console.log(
    `Contratos de RPC conferidos: ${chamadasVerificadas} chamada(s), ${nomesVistos.size} função(ões) distinta(s), todas presentes no banco e chamáveis por authenticated.${ressalva}`,
  );
}

main().catch((error) => {
  console.error("Não foi possível validar os contratos de RPC.", error);
  process.exitCode = 1;
});
