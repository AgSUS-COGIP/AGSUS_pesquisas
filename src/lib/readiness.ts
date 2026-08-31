import { getEmailConfigurationStatus } from "@/config/email";
import {
  AdminSupabaseConfigurationError,
  createAdminSupabaseClient,
  getAdminSupabaseConfigurationStatus,
} from "@/lib/supabase/admin";
import { RPCS_CRITICAS } from "@/lib/rpc-criticas";

/**
 * Prontidão do ambiente — a **única** definição de "a plataforma está de pé".
 *
 * ## Por que isto saiu de dentro da rota
 *
 * Existiam duas regras concorrentes para a mesma pergunta. `/api/health/readiness`
 * conferia variáveis, banco e contrato de RPC. A tela de acesso, por sua vez,
 * inferia saúde a partir da leitura da marca: erro **com** código do PostgREST
 * queria dizer "respondeu, logo está de pé"; exceção ou erro sem código queria
 * dizer "fora".
 *
 * Esse segundo critério não se sustenta. Uma falha real entre PostgREST e
 * PostgreSQL chega com código — `57P03` (banco iniciando), `53300` (conexões
 * esgotadas), `PGRST002` (o esquema não pôde ser carregado). Todos são o banco
 * fora, e todos abriam a tela de login como se fosse um dia normal.
 *
 * A marca volta a ser o que ela é: organização, cores, arte e textos. Ela não
 * responde mais por saúde da plataforma.
 *
 * ## Por que o resultado não é um booleano
 *
 * "Degradado" reúne situações que pedem respostas opostas na porta de entrada.
 *
 * Faltar `SMTP_APP_PASSWORD` degrada o ambiente — e-mail não sai —, mas não
 * impede ninguém de entrar. Fechar o login por isso seria trocar uma falha de
 * envio por uma queda total. Já o banco inacessível ou um esquema atrás das
 * migrations impedem qualquer jornada autenticada, e aí a tela precisa dizer.
 *
 * Por isso o retorno é discriminado: a rota reduz tudo a `ready`/`degraded`,
 * enquanto a tela de acesso decide pelo motivo. Uma definição, dois usos.
 */
export type Prontidao =
  | { estado: "pronta" }
  | { estado: "configuracao-ausente"; detalhe: string }
  | { estado: "backend-inacessivel"; detalhe: string }
  | { estado: "esquema-incompativel"; detalhe: string };

/**
 * Impede que a porta de entrada fique pendurada num backend que aceita a
 * conexão e não responde. Sem isto não há nem o que ler enquanto se espera —
 * pior que a tela errada.
 */
const TEMPO_LIMITE_MS = 5_000;

/** O ambiente responde e o esquema é compatível com esta versão da aplicação? */
export async function verificarProntidao(): Promise<Prontidao> {
  const faltando = [
    ...getAdminSupabaseConfigurationStatus().missingVariables,
    ...getEmailConfigurationStatus().missingVariables,
  ];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) faltando.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()) faltando.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  if (!process.env.CRON_SECRET?.trim()) faltando.push("CRON_SECRET");

  if (faltando.length) {
    return { estado: "configuracao-ausente", detalhe: faltando.join(", ") };
  }

  try {
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .rpc("fc_srv_verificar_contrato_rpc", { p_nomes: [...RPCS_CRITICAS] })
      .abortSignal(AbortSignal.timeout(TEMPO_LIMITE_MS));

    /*
      Os dois desfechos abaixo fecham a plataforma. O código do erro só escolhe
      **o rótulo do log**, nunca se a plataforma está de pé.

      Vale insistir nisso, porque a distinção parece a heurística antiga e é o
      oposto dela. Antes, erro com código significava "respondeu, logo está
      saudável", e o login abria. Aqui, com código ou sem, o resultado é
      indisponibilidade; a diferença serve a quem vai diagnosticar: sem código o
      cliente nem chegou ao servidor (DNS, rede, projeto pausado — o
      `TypeError: fetch failed` do supabase-js chega assim), com código o
      servidor respondeu recusando, e aí a mensagem do PostgREST é a pista.

      A própria função de verificação pode faltar — ambiente atrás da migration
      que a criou. Isso é incompatibilidade de esquema, não falha a engolir.
    */
    if (error) {
      return error.code
        ? { estado: "esquema-incompativel", detalhe: `${error.code} ${error.message}` }
        : { estado: "backend-inacessivel", detalhe: error.message };
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
    if (erro instanceof AdminSupabaseConfigurationError) {
      return { estado: "configuracao-ausente", detalhe: erro.message };
    }
    return { estado: "backend-inacessivel", detalhe: String(erro) };
  }
}

/**
 * A plataforma consegue atender uma jornada autenticada?
 *
 * Configuração ausente fica **de fora** de propósito: é build ou
 * pré-visualização sem backend, e mostrar indisponibilidade ali seria mentir
 * sobre produção. O mesmo julgamento que a tela de acesso já fazia.
 */
export function ehQuedaDeBackend(prontidao: Prontidao) {
  return prontidao.estado === "backend-inacessivel" || prontidao.estado === "esquema-incompativel";
}
