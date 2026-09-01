import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeEntradaInvalida, respostaDeFalha } from "@/lib/api/resposta-http";
import { PLATFORM_MODULE } from "@/lib/platform-modules";
import { MANUTENCAO_INATIVA, validarModulosDeManutencao, type EstadoDeManutencao } from "@/lib/manutencao";
import {
  escritaConfigurada,
  gravarManutencao,
  lerManutencao,
} from "@/lib/manutencao-control-plane";

export const dynamic = "force-dynamic";

/**
 * Estado operacional da plataforma — leitura e escrita.
 *
 * ## A autorização não confia no cliente
 *
 * O papel **nunca** vem do corpo da requisição: ele é lido de
 * `fc_obter_contexto_plataforma()`, que o resolve no banco a partir da sessão.
 * Um cliente que enviasse `{"role":"ADMINISTRATOR"}` seria simplesmente
 * ignorado.
 *
 * E a checagem acontece duas vezes, de propósito. Aqui, para recusar cedo e com
 * mensagem legível; e dentro de `fc_registrar_manutencao_auditoria`, que é a
 * garantia — se amanhã outra rota chamar sem conferir, o banco continua
 * recusando.
 *
 * ## Esta rota não pode ser bloqueada pela manutenção que ela controla
 *
 * Ela consta em `ROTAS_SEMPRE_LIBERADAS`. Sem isso, ativar a manutenção global
 * tornaria impossível desativá-la pela própria plataforma, e a única saída
 * seria o painel da Vercel.
 */

const EVENTO = {
  GLOBAL_ON: "PLATFORM_MAINTENANCE_ENABLED",
  GLOBAL_OFF: "PLATFORM_MAINTENANCE_DISABLED",
  MODULO_ON: "MODULE_MAINTENANCE_ENABLED",
  MODULO_OFF: "MODULE_MAINTENANCE_DISABLED",
} as const;

const LIMITE_DO_MOTIVO = 300;

type Sessao = Awaited<ReturnType<typeof createServerRpcClient>>;

/** Sessão válida **e** perfil de administração da plataforma, resolvidos no banco. */
async function exigirAdministrador(banco: Sessao) {
  const { data, error } = await banco.rpc("FC_OBTER_CONTEXTO_PLATAFORMA");
  if (error) {
    return { erro: respostaDeFalha(503, "Não foi possível confirmar suas permissões agora.") };
  }

  const contexto = data as { status?: string; modules?: string[]; person?: { id?: string } } | null;
  if (contexto?.status === "AUTH_REQUIRED") {
    return { erro: respostaDeFalha(401, "Sua sessão expirou. Entre novamente para continuar.") };
  }
  if (!contexto?.modules?.includes(PLATFORM_MODULE.ADMIN_ACCESS)) {
    return { erro: respostaDeFalha(403, "Apenas a administração da plataforma pode alterar a manutenção.") };
  }

  return { erro: null, pessoa: contexto.person?.id ?? null };
}

/**
 * Estado atual, em dois níveis.
 *
 * Qualquer sessão válida recebe **o que a bloqueia**: se há manutenção global e
 * quais módulos estão fora. É isso que a guarda de página precisa saber, e ela
 * precisa saber sem cache — um estado guardado por dois minutos faria a
 * manutenção demorar dois minutos para valer.
 *
 * O restante — motivo, quem alterou, quando, e se a escrita está provisionada —
 * só vai para a administração. O motivo é operacional e pode citar sistema
 * interno; quem alterou é dado de pessoa.
 */
export async function GET() {
  const banco = await createServerRpcClient();

  const leitura = await lerManutencao();
  const estado = leitura.ok ? leitura.estado : MANUTENCAO_INATIVA;

  const { data, error } = await banco.rpc("FC_OBTER_CONTEXTO_PLATAFORMA");
  if (error) return respostaDeFalha(503, "Não foi possível confirmar suas permissões agora.");
  const contexto = data as { status?: string; modules?: string[] } | null;
  if (contexto?.status === "AUTH_REQUIRED") {
    return respostaDeFalha(401, "Sua sessão expirou. Entre novamente para continuar.");
  }
  const ehAdministrador = Boolean(contexto?.modules?.includes(PLATFORM_MODULE.ADMIN_ACCESS));

  if (!ehAdministrador) {
    return NextResponse.json(
      { global: estado.global, modules: estado.modules, leituraDisponivel: leitura.ok },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      global: estado.global,
      modules: estado.modules,
      // A tela precisa distinguir três coisas que um booleano confundiria: não
      // há manutenção; não consegui ler; e não existe control plane aqui. A
      // primeira é normal, a segunda é incidente e a terceira é provisionamento
      // pendente — e cada uma pede uma frase diferente de quem administra.
      leituraDisponivel: leitura.ok,
      controlPlaneAusente: !leitura.ok && leitura.motivo === "nao-configurado",
      escritaDisponivel: escritaConfigurada(),
      detalhe: { reason: estado.reason, updatedAt: estado.updatedAt, updatedBy: estado.updatedBy },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PUT(request: Request) {
  const banco = await createServerRpcClient();
  const guarda = await exigirAdministrador(banco);
  if (guarda.erro) return guarda.erro;

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return respostaDeEntradaInvalida("Corpo da requisição inválido.");
  }

  const entrada = corpo as { global?: unknown; modules?: unknown; reason?: unknown };

  if (typeof entrada.global !== "boolean") {
    return respostaDeEntradaInvalida("O campo 'global' precisa ser verdadeiro ou falso.");
  }

  /*
    Módulo desconhecido é **recusado**, não filtrado.

    Na leitura do control plane o desconhecido é descartado, para que uma chave
    velha não derrube a plataforma. Aqui é o oposto: o valor acabou de sair da
    tela de quem opera, e engolir em silêncio faria a pessoa acreditar que
    colocou um módulo em manutenção quando não colocou.
  */
  const { validos: modulos, invalidos } = validarModulosDeManutencao(entrada.modules ?? []);
  if (invalidos.length) {
    return respostaDeEntradaInvalida(
      `Módulo desconhecido: ${invalidos.join(", ")}. Use apenas os módulos institucionais.`,
    );
  }

  const motivo = typeof entrada.reason === "string" ? entrada.reason.trim() : "";

  const leituraAnterior = await lerManutencao();
  const anterior = leituraAnterior.ok ? leituraAnterior.estado : MANUTENCAO_INATIVA;

  const modulosAtivados = modulos.filter((modulo) => !anterior.modules.includes(modulo));
  const modulosDesativados = anterior.modules.filter((modulo) => !modulos.includes(modulo));
  const globalAtivado = entrada.global && !anterior.global;
  const globalDesativado = !entrada.global && anterior.global;
  const ativouAlgo = globalAtivado || modulosAtivados.length > 0;

  // Motivo é obrigatório para **ativar**. Retirar manutenção devolve o sistema
  // ao normal e não precisa ser justificado — só registrado.
  if (ativouAlgo && !motivo) {
    return respostaDeEntradaInvalida("Informe o motivo da manutenção.");
  }
  if (motivo.length > LIMITE_DO_MOTIVO) {
    return respostaDeEntradaInvalida(`O motivo deve ter até ${LIMITE_DO_MOTIVO} caracteres.`);
  }

  if (!globalAtivado && !globalDesativado && !modulosAtivados.length && !modulosDesativados.length) {
    return NextResponse.json({ estado: anterior, semMudanca: true }, { headers: { "Cache-Control": "no-store" } });
  }

  const novo: EstadoDeManutencao = {
    global: entrada.global,
    modules: modulos,
    reason: motivo,
    updatedAt: new Date().toISOString(),
    updatedBy: guarda.pessoa,
  };

  /*
    Gravar antes de auditar.

    Se a ordem fosse a inversa e a gravação falhasse, o diário de bordo
    afirmaria uma mudança que nunca aconteceu — e é a auditoria que alguém vai
    consultar para entender por que a plataforma parou. Auditoria que falha
    depois de a escrita ter dado certo deixa uma mudança sem registro, o que é
    ruim mas verdadeiro; o inverso é mentira.
  */
  const escrita = await gravarManutencao(novo);
  if (!escrita.ok) return respostaDeFalha(502, escrita.motivo);

  const eventos: { evento: string; modulos: string[] }[] = [];
  if (globalAtivado) eventos.push({ evento: EVENTO.GLOBAL_ON, modulos: [] });
  if (globalDesativado) eventos.push({ evento: EVENTO.GLOBAL_OFF, modulos: [] });
  if (modulosAtivados.length) eventos.push({ evento: EVENTO.MODULO_ON, modulos: modulosAtivados });
  if (modulosDesativados.length) eventos.push({ evento: EVENTO.MODULO_OFF, modulos: modulosDesativados });

  for (const item of eventos) {
    const { error } = await banco.rpc("FC_REGISTRAR_MANUT_AUDITORIA", {
      p_evento: item.evento,
      p_motivo: motivo,
      p_estado_anterior: anterior,
      p_estado_posterior: novo,
      p_modulos: item.modulos,
    });
    // Banco fora não impede operar a manutenção — que é justamente o que se
    // precisa fazer quando o banco está fora. Fica o aviso no log.
    if (error) {
      console.warn("maintenance_audit_failed", { evento: item.evento, codigo: error.code });
    }
  }

  console.warn(entrada.global ? "maintenance_global_active" : "maintenance_module_active", {
    global: novo.global,
    modules: novo.modules,
  });

  return NextResponse.json({ estado: novo }, { headers: { "Cache-Control": "no-store" } });
}
