import { getEmailConfigurationStatus } from "@/config/email";
import { createAdminRpcClient } from "@/lib/db/rpc-adapter";
import { getEmpresaDbConfigurationStatus } from "@/lib/db/pool";
import { RPCS_CRITICAS } from "@/lib/rpc-criticas";
import type { Prontidao } from "@/lib/readiness-state";
export { ehQuedaDeBackend, type Prontidao } from "@/lib/readiness-state";

/**
 * Prontidão do ambiente — a **única** definição de "a plataforma está de pé".
 *
 * ## Por que isto não mora dentro da rota
 *
 * Já existiram duas regras concorrentes para a mesma pergunta.
 * `/api/health/readiness` conferia variáveis, banco e contrato de RPC; a tela
 * de acesso inferia saúde a partir da leitura da marca, e tratava erro **com**
 * código como "respondeu, logo está de pé". Só que falha real chega com código
 * — `57P03` (banco iniciando), `53300` (conexões esgotadas) —, então o login
 * abria como num dia normal enquanto o banco estava fora.
 *
 * A marca voltou a ser o que ela é: organização, cores, arte e textos. Ela não
 * responde mais por saúde da plataforma. Uma definição, dois usos: a rota
 * reduz o resultado a `ready`/`degraded`, a tela de acesso decide pelo motivo.
 *
 * ## As três perguntas, nesta ordem
 *
 * As variáveis existem (barato, sem rede) → o banco responde → o esquema tem as
 * RPCs desta versão. A terceira é a que importa: publicar a aplicação antes das
 * migrations produz falha de contrato na frente de quem usa, e um health que só
 * confere configuração responde `ok` nesse estado.
 */
export async function verificarProntidao(): Promise<Prontidao> {
  /*
    No modo gateway, quem conecta ao PostgreSQL é o gateway dentro da rede da
    AgSUS — este ambiente não tem, e não deve ter, credencial de banco. Exigir
    as três variáveis aqui reprovaria uma instalação saudável.

    O que se confere então é o par que de fato falta para funcionar. A prova de
    que o banco responde continua sendo a mesma, e mais forte: a chamada a
    `FC_SRV_VERIFICAR_CONTRATO_RPC` logo abaixo atravessa o gateway inteiro.
  */
  const viaGateway = Boolean(process.env.GATEWAY_URL?.trim());

  const configuracaoDoBanco = viaGateway
    ? { missingVariables: process.env.GATEWAY_TOKEN?.trim() ? [] : ["GATEWAY_TOKEN"] }
    : getEmpresaDbConfigurationStatus();

  const faltando = [
    ...configuracaoDoBanco.missingVariables,
    ...getEmailConfigurationStatus().missingVariables,
  ];
  if (!process.env.CRON_SECRET?.trim()) faltando.push("CRON_SECRET");

  if (faltando.length) {
    return { estado: "configuracao-ausente", detalhe: faltando.join(", ") };
  }

  try {
    const banco = createAdminRpcClient();
    const { data, error } = await banco.rpc("FC_SRV_VERIFICAR_CONTRATO_RPC", {
      p_nomes: [...RPCS_CRITICAS],
    });

    /*
      Os dois desfechos abaixo fecham a plataforma. O código do erro escolhe
      **o rótulo**, nunca se a plataforma está de pé.

      Vale insistir, porque a distinção se parece com a heurística antiga e é o
      oposto dela. Antes, erro com código significava "respondeu, logo está
      saudável". Aqui, com código ou sem, o resultado é indisponibilidade; a
      diferença serve a quem vai diagnosticar. Com código, o servidor respondeu
      recusando e o SQLSTATE é a pista — inclusive `42883`, que o adaptador
      traduz para `PGRST202` quando a própria função de verificação ainda não
      existe, ou seja, ambiente atrás da migration que a criou. Sem código, a
      sessão sequer chegou a executar: rede, credencial ou instância fora.
    */
    if (error) {
      // O adaptador declara `message` opcional, e um erro sem texto continua
      // sendo um erro: o rótulo garante que o log nunca fique vazio.
      const detalhe = error.message ?? "sem mensagem do banco";
      return error.code
        ? { estado: "esquema-incompativel", detalhe: `${error.code} ${detalhe}` }
        : { estado: "backend-inacessivel", detalhe };
    }

    const resultado = data as { compatible?: boolean; missing?: string[] } | null;
    if (!resultado?.compatible) {
      return {
        estado: "esquema-incompativel",
        detalhe: resultado?.missing?.join(", ") ?? "desconhecido",
      };
    }

    return { estado: "pronta" };
  } catch (erro) {
    return {
      estado: "backend-inacessivel",
      detalhe: erro instanceof Error ? erro.message : String(erro),
    };
  }
}
