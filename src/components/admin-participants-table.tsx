"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownAZ, ArrowUpAZ, Download, MailWarning, RefreshCw, Search, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type ParticipantRow = {
  id: string;
  employeeNumber: string;
  fullName: string;
  institutionalEmail: string | null;
  jobTitle: string | null;
  costCenter: string | null;
  workplace: string | null;
  accessProfile: string | null;
  status: string;
  completedAt: string | null;
};

async function loadParticipants(): Promise<ParticipantRow[]> {
  const supabase = createBrowserSupabaseClient();
  const { data: application, error: applicationError } = await supabase
    .from("survey_applications")
    .select("id")
    .eq("code", "CDDI-2026")
    .single();

  if (applicationError) throw applicationError;

  const { data, error } = await supabase
    .from("application_participants")
    .select(`
      id,
      status,
      access_profile,
      completed_at,
      person:people!application_participants_person_id_fkey(
        employee_number,
        full_name,
        institutional_email,
        job_title,
        cost_center,
        workplace
      )
    `)
    .eq("application_id", application.id)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((item) => {
    const person = Array.isArray(item.person) ? item.person[0] : item.person;
    return {
      id: item.id,
      employeeNumber: person?.employee_number ?? "—",
      fullName: person?.full_name ?? "Nome não informado",
      institutionalEmail: person?.institutional_email ?? null,
      jobTitle: person?.job_title ?? null,
      costCenter: person?.cost_center ?? null,
      workplace: person?.workplace ?? null,
      accessProfile: item.access_profile ?? null,
      status: item.status,
      completedAt: item.completed_at,
    } satisfies ParticipantRow;
  });
}

function exportCsv(rows: ParticipantRow[]) {
  const header = ["Matrícula", "Nome", "E-mail institucional", "Cargo", "Centro de custo", "Local", "Perfil", "Situação", "Conclusão"];
  const lines = rows.map((row) => [
    row.employeeNumber,
    row.fullName,
    row.institutionalEmail ?? "",
    row.jobTitle ?? "",
    row.costCenter ?? "",
    row.workplace ?? "",
    row.accessProfile ?? "",
    row.status,
    row.completedAt ? new Date(row.completedAt).toLocaleString("pt-BR") : "",
  ]);
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const csv = [header, ...lines].map((line) => line.map((value) => escape(String(value))).join(";")).join("\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `participantes-cddi-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    ELIGIBLE: "Elegível",
    IN_PROGRESS: "Em andamento",
    COMPLETED: "Concluído",
    BLOCKED: "Bloqueado",
    INACTIVE: "Inativo",
  };
  return labels[status] ?? status;
}

export function AdminParticipantsTable() {
  const [sorting, setSorting] = useState<SortingState>([{ id: "fullName", desc: false }]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");

  const query = useQuery({
    queryKey: ["admin", "participants", "CDDI-2026"],
    queryFn: loadParticipants,
  });

  const filteredData = useMemo(() => {
    const rows = query.data ?? [];
    if (statusFilter === "TODOS") return rows;
    if (statusFilter === "SEM_EMAIL") return rows.filter((row) => !row.institutionalEmail);
    return rows.filter((row) => row.status === statusFilter);
  }, [query.data, statusFilter]);

  const columns = useMemo<ColumnDef<ParticipantRow>[]>(() => [
    {
      accessorKey: "fullName",
      header: "Participante",
      cell: ({ row }) => (
        <div className="min-w-64">
          <strong className="block text-sm text-slate-900">{row.original.fullName}</strong>
          <span className="mt-1 block text-xs text-slate-500">Matrícula {row.original.employeeNumber}</span>
        </div>
      ),
    },
    {
      accessorKey: "institutionalEmail",
      header: "Contato",
      cell: ({ row }) => row.original.institutionalEmail ? (
        <span className="text-sm text-slate-700">{row.original.institutionalEmail}</span>
      ) : (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
          <MailWarning className="h-3.5 w-3.5" /> Sem e-mail
        </span>
      ),
    },
    {
      accessorKey: "jobTitle",
      header: "Cargo e unidade",
      cell: ({ row }) => (
        <div className="min-w-56 text-sm">
          <span className="block font-semibold text-slate-800">{row.original.jobTitle ?? "Cargo não informado"}</span>
          <span className="mt-1 block text-xs text-slate-500">{row.original.costCenter ?? row.original.workplace ?? "Unidade não informada"}</span>
        </div>
      ),
    },
    {
      accessorKey: "accessProfile",
      header: "Perfil",
      cell: ({ getValue }) => <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">{String(getValue() ?? "Participante")}</span>,
    },
    {
      accessorKey: "status",
      header: "Situação",
      cell: ({ getValue }) => {
        const value = String(getValue());
        const completed = value === "COMPLETED";
        return <span className={`rounded-full px-3 py-1 text-xs font-bold ${completed ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>{statusLabel(value)}</span>;
      },
    },
  ], []);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  });

  const total = query.data?.length ?? 0;
  const withoutEmail = query.data?.filter((row) => !row.institutionalEmail).length ?? 0;
  const completed = query.data?.filter((row) => row.status === "COMPLETED").length ?? 0;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Participantes", value: total, helper: "vinculados ao CDDI", icon: UsersRound },
          { label: "Sem e-mail", value: withoutEmail, helper: "necessitam tratamento", icon: MailWarning },
          { label: "Concluídos", value: completed, helper: "formularios finalizados", icon: ArrowUpAZ },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.14em] text-slate-400">{item.label}</p>
                  <strong className="mt-2 block text-3xl font-black text-[#003b70]">{item.value.toLocaleString("pt-BR")}</strong>
                  <span className="mt-1 block text-sm text-slate-500">{item.helper}</span>
                </div>
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-[#003b70]"><Icon className="h-5 w-5" /></span>
              </div>
            </article>
          );
        })}
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row">
            <label className="relative flex-1">
              <span className="sr-only">Pesquisar participantes</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={globalFilter}
                onChange={(event) => setGlobalFilter(event.target.value)}
                placeholder="Pesquisar por nome, matrícula, e-mail ou cargo"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            >
              <option value="TODOS">Todas as situações</option>
              <option value="ELIGIBLE">Elegíveis</option>
              <option value="IN_PROGRESS">Em andamento</option>
              <option value="COMPLETED">Concluídos</option>
              <option value="SEM_EMAIL">Sem e-mail</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => query.refetch().then(() => toast.success("Base de participantes atualizada."))}
              disabled={query.isFetching}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} /> Atualizar
            </button>
            <button
              type="button"
              onClick={() => { exportCsv(table.getFilteredRowModel().rows.map((row) => row.original)); toast.success("Arquivo CSV gerado."); }}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#003b70] px-4 text-sm font-black text-white transition hover:bg-[#075ea8]"
            >
              <Download className="h-4 w-4" /> Exportar
            </button>
          </div>
        </div>

        {query.isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-14 animate-pulse rounded-2xl bg-slate-100" />)}</div>
        ) : query.isError ? (
          <div className="p-10 text-center">
            <p className="font-black text-red-700">Não foi possível carregar os participantes.</p>
            <p className="mt-2 text-sm text-slate-500">{query.error instanceof Error ? query.error.message : "Erro desconhecido"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead className="bg-slate-50">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id} className="border-b border-slate-200 px-5 py-4 text-xs font-black uppercase tracking-[.12em] text-slate-500">
                        {header.isPlaceholder ? null : (
                          <button type="button" onClick={header.column.getToggleSortingHandler()} className="inline-flex items-center gap-2">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {header.column.getIsSorted() === "asc" ? <ArrowDownAZ className="h-4 w-4" /> : header.column.getIsSorted() === "desc" ? <ArrowUpAZ className="h-4 w-4" /> : null}
                          </button>
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 transition hover:bg-blue-50/40">
                    {row.getVisibleCells().map((cell) => <td key={cell.id} className="px-5 py-4 align-middle">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}
                  </tr>
                )) : (
                  <tr><td colSpan={columns.length} className="px-6 py-16 text-center text-sm font-semibold text-slate-500">Nenhum participante encontrado para os filtros selecionados.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm font-semibold text-slate-500">
            {table.getFilteredRowModel().rows.length.toLocaleString("pt-BR")} registro(s) encontrados
          </span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">Anterior</button>
            <span className="px-2 text-sm font-bold text-slate-600">Página {table.getState().pagination.pageIndex + 1} de {Math.max(table.getPageCount(), 1)}</span>
            <button type="button" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">Próxima</button>
          </div>
        </div>
      </section>
    </div>
  );
}
