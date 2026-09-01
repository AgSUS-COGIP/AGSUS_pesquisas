import { normalizePlatformModules, PLATFORM_MODULE, type PlatformModule } from "./platform-modules";
import { AVISO_MODO_ADMINISTRATIVO } from "./manutencao";
import type { PlatformContext } from "./platform-context";

/**
 * Usuário exibido pela casca (`PlatformShell`).
 *
 * Mantido estruturalmente compatível com a prop `user` de `PlatformShell` — é o
 * mesmo objeto que cada página montava à mão antes de `resolvePlatformGuard()`.
 */
export type PlatformShellUser = {
  id?: string;
  fullName: string;
  institutionalEmail: string | null;
  employeeNumber: string;
  profileLabel: string;
  avatarUrl?: string | null;
  modules: PlatformModule[];
};

/**
 * Decisão da guarda de uma página autenticada, nos cinco desfechos possíveis.
 *
 * `granted` é o único que carrega dados: quando o acesso é negado não existe
 * pessoa nem módulo para renderizar, e o tipo impede a página de tentar ler.
 */
export type PlatformGuardDecision =
  | { state: "loading" }
  | { state: "unidentified"; message: string }
  | { state: "restricted"; requiredModule: PlatformModule }
  /** O módulo existe e a pessoa tem acesso — ele apenas está fora no momento. */
  | { state: "manutencao"; modulo: PlatformModule }
  | {
      state: "granted";
      context: PlatformContext;
      person: NonNullable<PlatformContext["person"]>;
      modules: PlatformModule[];
      user: PlatformShellUser;
      /** Preenchido quando ADMIN_ACCESS entrou num módulo em manutenção. */
      avisoDeManutencao: string | null;
    };

export type PlatformGuardInput = {
  context: PlatformContext | null;
  loading: boolean;
  error: string;
  /** Módulo exigido pela rota. Ausente = basta estar identificado (ex.: `/perfil`). */
  requiredModule?: PlatformModule;
  /**
   * Módulos em manutenção agora.
   *
   * `undefined` enquanto a leitura não chegou — e nesse intervalo nada é
   * bloqueado, porque bloquear por falta de informação transformaria uma
   * leitura lenta em módulo fora do ar.
   */
  modulosEmManutencao?: readonly PlatformModule[];
};

const UNIDENTIFIED_FALLBACK = "Acesso não identificado.";

/**
 * Traduz o contexto institucional na decisão de acesso de uma página.
 *
 * Função pura: a ordem dos desfechos é a regra de guarda do produto e fica
 * testável sem React. Sequência — carregando → identidade → permissão → manutenção → liberado.
 *
 * A lista de módulos é calculada no PostgreSQL e chega em `context.modules`.
 * Aqui apenas descartamos códigos que este bundle ainda não conhece. A guarda
 * não recalcula permissão a partir do perfil, evitando uma segunda fonte de
 * verdade no frontend.
 */
export function resolvePlatformGuard({
  context,
  loading,
  error,
  requiredModule,
  modulosEmManutencao,
}: PlatformGuardInput): PlatformGuardDecision {
  if (loading) return { state: "loading" };

  const person = context?.person;
  if (!context || !person) return { state: "unidentified", message: error || UNIDENTIFIED_FALLBACK };

  const modules = normalizePlatformModules(context.modules);
  if (requiredModule && !modules.includes(requiredModule)) return { state: "restricted", requiredModule };

  /*
    Manutenção é conferida **depois** da permissão, e a ordem importa.

    Quem não tem o módulo continua vendo "acesso restrito", que é a verdade
    sobre o perfil dela. Dizer "em manutenção" a quem nunca teria acesso daria
    a entender que o módulo voltaria a aparecer quando a manutenção saísse.

    E nada aqui altera permissão: `modules` continua exatamente como o banco
    respondeu. Retirar a manutenção devolve o acesso na mesma hora, sem nada
    para recalcular.
  */
  const emManutencao = Boolean(requiredModule && modulosEmManutencao?.includes(requiredModule));
  const podeAdministrarAcesso = modules.includes(PLATFORM_MODULE.ADMIN_ACCESS);

  if (emManutencao && requiredModule && !podeAdministrarAcesso) {
    return { state: "manutencao", modulo: requiredModule };
  }

  return {
    state: "granted",
    avisoDeManutencao: emManutencao ? AVISO_MODO_ADMINISTRATIVO : null,
    context,
    person,
    modules,
    user: {
      id: person.id,
      fullName: person.fullName,
      institutionalEmail: person.institutionalEmail,
      employeeNumber: person.employeeNumber,
      profileLabel: "Usuário autenticado",
      avatarUrl: person.avatarUrl,
      modules,
    },
  };
}
