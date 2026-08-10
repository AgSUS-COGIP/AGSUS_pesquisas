"use client";

import { Check, Loader2, Search, ShieldCheck, UserCog } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PersonAvatar } from "@/components/person-avatar";
import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableContainer,
  DataTableEmpty,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  DataTableScroll,
  DataTableState,
} from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/feedback";
import { Input } from "@/components/ui/form-controls";
import { PageHeader, Surface } from "@/components/ui/surface";
import { deriveModules, invalidatePlatformContext, profileLabel, usePlatformContext } from "@/lib/platform-context";
import { PLATFORM_MODULE, resolvePlatformRole } from "@/lib/platform-modules";
import { PLATFORM_ROLE } from "@/lib/platform-roles";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type Role = { id: string; code: string; name: string; description: string | null };
type PersonRole = { assignmentId: string; code: string; name: string };
type Person = {
  personId: string;
  fullName: string;
  employeeNumber: string | null;
  institutionalEmail: string | null;
  jobTitle: string | null;
  unit: string | null;
  active: boolean;
  roles: PersonRole[];
};
type Workspace = { status: string; roles: Role[]; people: Person[] };

const roleOrder: string[] = [PLATFORM_ROLE.SUPER_ADMIN, PLATFORM_ROLE.ADMIN, PLATFORM_ROLE.EVALUATOR, PLATFORM_ROLE.PARTICIPANT];

/**
 * Perfil exibido como selecionado para uma pessoa.
 *
 * Base histórica pode ter mais de um papel vigente; a interface mostra o de
 * maior privilégio, o mesmo que `resolvePlatformRole()` usa para liberar módulos.
 */
function effectiveRoleCode(person: Person) {
  return resolvePlatformRole(person.roles.map((role) => role.code));
}

export default function AdminAccessPage() {
  const { context, loading, error } = usePlatformContext();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [query, setQuery] = useState("");
  const [fetching, setFetching] = useState(false);
  const [changing, setChanging] = useState("");

  async function load(term = "") {
    setFetching(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error: rpcError } = await supabase.rpc("list_access_workspace", { search_term: term });
      if (rpcError) throw rpcError;
      setWorkspace(data as Workspace);
    } catch (loadError) {
      toast.error(loadError instanceof Error ? loadError.message : "Não foi possível carregar os acessos.");
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    if (context && deriveModules(context).includes(PLATFORM_MODULE.ADMIN_ACCESS)) void load();
  }, [context]);

  const roles = useMemo(
    () =>
      [...(workspace?.roles ?? [])].sort((a, b) => {
        const ai = roleOrder.indexOf(a.code);
        const bi = roleOrder.indexOf(b.code);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      }),
    [workspace],
  );

  /**
   * Define o perfil de uma pessoa.
   *
   * Os quatro perfis são mutuamente exclusivos: `fc_definir_perfil_pessoa`
   * concede o escolhido e encerra os demais na mesma transação, então a pessoa
   * nunca fica sem acesso nem com dois perfis por falha parcial.
   */
  async function setProfile(person: Person, role: Role) {
    if (person.roles.length === 1 && person.roles[0]?.code === role.code) return;

    setChanging(person.personId);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: rpcError } = await supabase.rpc("fc_definir_perfil_pessoa", {
        p_pessoa: person.personId,
        p_perfil: role.code,
      });
      if (rpcError) throw rpcError;

      toast.success(`${person.fullName} agora tem o perfil ${role.name}.`);
      // O perfil alimenta o contexto cacheado da casca: sem invalidar, quem teve
      // o próprio perfil alterado veria a navegação antiga por até 2 minutos.
      invalidatePlatformContext();
      await load(query);
    } catch (changeError) {
      toast.error(changeError instanceof Error ? changeError.message : "Não foi possível alterar o perfil.");
      await load(query);
    } finally {
      setChanging("");
    }
  }

  if (loading) return <PlatformSkeleton title="Carregando acessos" />;
  if (!context?.person) return <main className="p-8 text-red-700">{error || "Acesso não identificado."}</main>;

  const modules = deriveModules(context);
  const user = {
    fullName: context.person.fullName,
    institutionalEmail: context.person.institutionalEmail,
    employeeNumber: context.person.employeeNumber,
    profileLabel: profileLabel(context),
    avatarUrl: context.person.avatarUrl,
    roles: context.roles,
    modules,
  };

  if (!modules.includes(PLATFORM_MODULE.ADMIN_ACCESS)) {
    return (
      <PlatformShell user={user} eyebrow="Segurança" title="Acessos e permissões">
        <EmptyState
          className="mx-auto max-w-xl"
          icon={<ShieldCheck className="h-6 w-6" aria-hidden="true" />}
          title="Acesso exclusivo"
          description="Somente o Superadmin pode alterar o perfil de acesso de uma pessoa."
        />
      </PlatformShell>
    );
  }

  return (
    <PlatformShell user={user} eyebrow="Superadmin" title="Pessoas e permissões">
      <div className="min-w-0 space-y-5">
        <PageHeader
          eyebrow="Segurança e governança"
          title="Controle de acesso por perfil"
          description="Pesquise uma pessoa e defina seu perfil: Participante, Avaliador, Admin ou Superadmin. Toda mudança permanece registrada para auditoria."
          actions={
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void load(query);
              }}
              className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:min-w-[32rem] sm:flex-row sm:items-end"
            >
              <Input
                label="Pesquisar pessoa"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nome, matrícula ou e-mail"
                containerClassName="min-w-0 flex-1"
                className="mt-2"
              />
              <Button type="submit" disabled={fetching} className="sm:mb-0">
                {fetching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
                Buscar
              </Button>
            </form>
          }
        />

        <Surface className="p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-950 text-white">
              <UserCog className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Perfis disponíveis</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {roles.length
                  ? `Cada pessoa tem exatamente um dos ${roles.length} perfis. Selecionar um substitui o anterior.`
                  : "Os perfis serão exibidos assim que a configuração for carregada."}
              </p>
            </div>
          </div>
        </Surface>

        <DataTableContainer className="min-w-0" aria-label="Pessoas e perfis da plataforma">
          {fetching && !workspace ? (
            <DataTableState aria-live="polite">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-[var(--brand-primary)]" aria-hidden="true" />
              <p className="mt-3 font-semibold">Carregando pessoas e permissões...</p>
            </DataTableState>
          ) : (
            <DataTableScroll className="max-h-[65dvh] min-w-0 overflow-auto overscroll-contain [scrollbar-gutter:stable] lg:max-h-[calc(100dvh-22rem)]">
              <DataTable className="min-w-max">
                <DataTableHead className="sticky top-0 z-20">
                  <DataTableRow className="hover:bg-transparent">
                    <DataTableHeaderCell className="sticky left-0 z-30 min-w-[19rem] bg-slate-50 shadow-[10px_0_18px_-18px_rgba(15,23,42,.8)] sm:min-w-[22rem]">
                      Pessoa
                    </DataTableHeaderCell>
                    {roles.map((role) => (
                      <DataTableHeaderCell key={role.code} className="w-32 min-w-32 text-center">
                        <span title={role.description ?? role.name}>{role.name}</span>
                      </DataTableHeaderCell>
                    ))}
                  </DataTableRow>
                </DataTableHead>
                <DataTableBody>
                  {(workspace?.people ?? []).map((person) => (
                    <DataTableRow key={person.personId} className="group">
                      <DataTableCell className="sticky left-0 z-10 bg-white shadow-[10px_0_18px_-18px_rgba(15,23,42,.8)] transition-colors group-hover:bg-blue-50/40">
                        <div className="flex min-w-72 items-center gap-3">
                          <PersonAvatar
                            fullName={person.fullName}
                            className="h-10 w-10 rounded-xl"
                            fallbackClassName="text-xs"
                          />
                          <div className="min-w-0 max-w-[17rem] sm:max-w-[20rem]">
                            <div className="flex flex-wrap items-center gap-2">
                              <strong className="truncate text-sm text-slate-900">{person.fullName}</strong>
                              <Badge variant={person.active ? "success" : "neutral"}>{person.active ? "Ativo" : "Inativo"}</Badge>
                            </div>
                            <span className="mt-1 block truncate text-xs text-slate-500">
                              {person.institutionalEmail ?? person.employeeNumber ?? "Sem identificação"}
                            </span>
                            <span className="block truncate text-[11px] text-slate-400">
                              {person.jobTitle ?? "Cargo não informado"}
                              {person.unit ? ` · ${person.unit}` : ""}
                            </span>
                          </div>
                        </div>
                      </DataTableCell>
                      {roles.map((role) => {
                        const active = effectiveRoleCode(person) === role.code;
                        const busy = changing === person.personId;

                        return (
                          <DataTableCell key={role.code} className="w-32 min-w-32 text-center">
                            <button
                              type="button"
                              aria-pressed={active}
                              aria-label={`Definir o perfil ${role.name} para ${person.fullName}`}
                              onClick={() => void setProfile(person, role)}
                              disabled={busy}
                              className={`grid h-7 w-7 place-items-center rounded-full border-2 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 disabled:cursor-wait disabled:opacity-60 ${
                                active ? "border-emerald-500 bg-emerald-500" : "border-slate-300 bg-white hover:border-emerald-400"
                              }`}
                            >
                              {busy && active ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-white" aria-hidden="true" />
                              ) : active ? (
                                <Check className="h-3.5 w-3.5 text-white" aria-hidden="true" />
                              ) : null}
                            </button>
                          </DataTableCell>
                        );
                      })}
                    </DataTableRow>
                  ))}
                  {!fetching && !(workspace?.people?.length) && (
                    <DataTableEmpty colSpan={Math.max(roles.length + 1, 1)}>
                      Nenhuma pessoa encontrada para os critérios informados.
                    </DataTableEmpty>
                  )}
                </DataTableBody>
              </DataTable>
            </DataTableScroll>
          )}
        </DataTableContainer>
      </div>
    </PlatformShell>
  );
}
