// Traz para `sigav.tb_arquivo` as imagens que ainda são servidas pelo Storage
// do Supabase, e reescreve as URLs gravadas para `/api/arquivos/...`.
//
// Uso:
//   node --env-file=.env.local scripts/migrar-arquivos-para-o-banco.mjs           (relatório, não grava)
//   node --env-file=.env.local scripts/migrar-arquivos-para-o-banco.mjs --aplicar
//
// POR QUE ESTE SCRIPT EXISTE. `20260827160000_arquivos_no_banco.sql` criou a
// tabela e as RPCs que substituem os buckets, mas migration não baixa arquivo
// da internet — os bytes ficaram para trás. Enquanto isso, a arte de fundo da
// tela de acesso e a capa de ciclo continuam vindo de
// `https://<projeto>.supabase.co/storage/...`, o que significa que a aplicação
// ainda depende de um serviço que ela pretende desligar. No dia em que aquele
// projeto sair do ar, as duas imagens somem — em produção e no ambiente local.
//
// A varredura é dirigida pelo que está gravado no banco, não por uma lista fixa:
// qualquer URL de Storage que apareça na configuração da plataforma ou no
// `settings` de uma aplicação entra. É idempotente — rodar de novo depois de
// aplicar não encontra mais nada.
//
// O caminho dentro do balde é preservado. É ele que `accessBackgroundPath` e
// `bannerPath` já guardam, e é por ele que a rota nova resolve o arquivo; mudar
// o caminho obrigaria a reescrever esses campos também, sem ganho nenhum.

import pg from "pg";

// Mesmos limites da tabela (`ck_tb_arquivo_tipo`, `ck_tb_arquivo_tamanho`) e da
// rota. Um SVG malicioso servido da própria origem executaria script no
// contexto da aplicação, e é por isso que a lista não inclui `image/svg+xml`.
const TIPOS_ACEITOS = ["image/png", "image/jpeg", "image/webp"];
const TAMANHO_MAXIMO = 5 * 1024 * 1024;
const BALDES = ["platform-assets", "survey-assets"];

const PADRAO_STORAGE = /https:\/\/[^/]+\/storage\/v1\/object\/public\/([^/]+)\/([^"'\s?]+)(\?[^"'\s]*)?/g;

function lerConfiguracaoConexao() {
  const bruta = process.env.EMPRESA_DATABASE_URL?.trim();
  if (!bruta) {
    console.error(
      "EMPRESA_DATABASE_URL não está no ambiente.\n" +
      "Rode com: node --env-file=.env.local scripts/migrar-arquivos-para-o-banco.mjs",
    );
    process.exit(1);
  }
  const url = new URL(bruta.startsWith("jdbc:") ? bruta.slice(5) : bruta);
  const user = process.env.USERNAME_DATABASE_URL?.trim() || url.username;
  const password = process.env.PASSWORD_DATABASE_URL?.trim() || url.password;
  if (!user || !password) {
    console.error("USERNAME_DATABASE_URL e PASSWORD_DATABASE_URL precisam estar no ambiente.");
    process.exit(1);
  }
  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    database: url.pathname.replace(/^\//, ""),
    user,
    password,
  };
}

/** Extrai (balde, caminho, url) de qualquer texto que contenha URLs de Storage. */
function acharReferencias(texto) {
  const encontradas = [];
  for (const [urlCompleta, balde, caminho] of texto.matchAll(PADRAO_STORAGE)) {
    if (!BALDES.includes(balde)) continue;
    encontradas.push({ url: urlCompleta, balde, caminho: decodeURIComponent(caminho) });
  }
  return encontradas;
}

/** Onde procurar: a configuração de linha única e o `settings` de cada ciclo. */
async function levantarReferencias(cliente) {
  const referencias = new Map();

  const { rows: config } = await cliente.query(`
    select tx_url_logotipo, tx_url_fundo_acesso
    from sigav.tb_config_plataforma
    where co_configuracao = 1
  `);
  for (const linha of config) {
    for (const valor of Object.values(linha)) {
      if (typeof valor !== "string") continue;
      for (const ref of acharReferencias(valor)) {
        referencias.set(`${ref.balde}/${ref.caminho}`, { ...ref, origem: "tb_config_plataforma" });
      }
    }
  }

  const { rows: aplicacoes } = await cliente.query(`
    select id, code, settings::text as settings
    from sigav.survey_applications
    where settings::text like '%/storage/v1/object/public/%'
  `);
  for (const linha of aplicacoes) {
    for (const ref of acharReferencias(linha.settings)) {
      referencias.set(`${ref.balde}/${ref.caminho}`, {
        ...ref,
        origem: `survey_applications (${linha.code})`,
      });
    }
  }

  return [...referencias.values()];
}

async function baixar(url) {
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error(`HTTP ${resposta.status} ao baixar ${url}`);

  const tipo = (resposta.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!TIPOS_ACEITOS.includes(tipo)) {
    throw new Error(`tipo "${tipo}" não é aceito (só PNG, JPEG e WEBP)`);
  }

  const conteudo = Buffer.from(await resposta.arrayBuffer());
  if (!conteudo.length) throw new Error("arquivo vazio");
  if (conteudo.length > TAMANHO_MAXIMO) {
    throw new Error(`${(conteudo.length / 1024 / 1024).toFixed(1)} MB excede o limite de 5 MB`);
  }
  return { conteudo, tipo };
}

async function main() {
  const aplicar = process.argv.slice(2).includes("--aplicar");
  const cliente = new pg.Client(lerConfiguracaoConexao());
  await cliente.connect();

  try {
    const referencias = await levantarReferencias(cliente);

    if (!referencias.length) {
      const { rows } = await cliente.query("select count(*)::int as total from sigav.tb_arquivo");
      console.log(
        `Nenhuma URL de Storage encontrada. A tabela tem ${rows[0].total} arquivo(s); ` +
        "as imagens já são servidas pela própria aplicação.",
      );
      return;
    }

    console.log(`${referencias.length} imagem(ns) ainda vindas do Storage:\n`);
    for (const ref of referencias) {
      console.log(`  ${ref.balde}/${ref.caminho}\n    origem: ${ref.origem}`);
    }

    if (!aplicar) {
      console.log("\nNada foi gravado. Para migrar:  --aplicar");
      return;
    }

    console.log("\nMigrando:\n");
    // Transação única: se uma imagem falhar, nem os bytes nem a reescrita das
    // URLs sobrevivem. Um estado pela metade — arquivo no banco mas
    // configuração ainda apontando para o Storage, ou o inverso — é pior do que
    // não ter começado.
    await cliente.query("begin");

    for (const ref of referencias) {
      process.stdout.write(`  ${ref.balde}/${ref.caminho} ... `);
      const { conteudo, tipo } = await baixar(ref.url);

      await cliente.query(
        `insert into sigav.tb_arquivo (co_balde, ds_caminho, tp_conteudo, nu_tamanho, im_conteudo)
         values ($1, $2, $3, $4, $5)
         on conflict on constraint uk_tb_arquivo_caminho do update
           set tp_conteudo = excluded.tp_conteudo,
               nu_tamanho = excluded.nu_tamanho,
               im_conteudo = excluded.im_conteudo,
               dt_atualizacao = now()`,
        [ref.balde, ref.caminho, tipo, conteudo.length, conteudo],
      );

      // A URL nova é relativa de propósito: herda o esquema e o domínio da
      // página, e por isso funciona igual em localhost e em produção, sem
      // depender de variável de ambiente.
      const nova = `/api/arquivos/${ref.balde}/${ref.caminho}`;

      // `replace` sobre o texto do jsonb alcança a URL onde quer que ela esteja
      // dentro do documento, inclusive com o `?v=` que a tela acrescenta — o
      // padrão de captura já inclui a query.
      await cliente.query(
        `update sigav.survey_applications
            set settings = replace(settings::text, $1, $2)::jsonb,
                updated_at = timezone('utc', now())
          where settings::text like '%' || $1 || '%'`,
        [ref.url, nova],
      );

      await cliente.query(
        `update sigav.tb_config_plataforma
            set tx_url_logotipo = case when tx_url_logotipo = $1 then $2 else tx_url_logotipo end,
                tx_url_fundo_acesso = case when tx_url_fundo_acesso = $1 then $2 else tx_url_fundo_acesso end
          where co_configuracao = 1
            and $1 in (tx_url_logotipo, tx_url_fundo_acesso)`,
        [ref.url, nova],
      );

      console.log(`ok (${(conteudo.length / 1024).toFixed(0)} KB, ${tipo})`);
    }

    const { rows: sobraram } = await cliente.query(`
      select count(*)::int as total from (
        select 1 from sigav.tb_config_plataforma
         where co_configuracao = 1
           and (coalesce(tx_url_logotipo,'') like '%/storage/v1/object/public/%'
             or coalesce(tx_url_fundo_acesso,'') like '%/storage/v1/object/public/%')
        union all
        select 1 from sigav.survey_applications
         where settings::text like '%/storage/v1/object/public/%'
      ) t
    `);

    if (sobraram[0].total !== 0) {
      await cliente.query("rollback");
      console.error(
        `\nAinda restaram ${sobraram[0].total} referência(s) ao Storage depois da reescrita. ` +
        "Nada foi gravado.",
      );
      process.exitCode = 1;
      return;
    }

    await cliente.query("commit");
    console.log("\nPronto. As imagens agora saem de /api/arquivos e nada mais aponta para o Storage.");
  } catch (erro) {
    await cliente.query("rollback").catch(() => {});
    console.error(`\nFALHOU: ${erro.message}\nNada foi gravado.`);
    process.exitCode = 1;
  } finally {
    await cliente.end();
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
