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
import { ArrowDownAZ, ArrowUpAZ, Download, MailWarning, RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableContainer,
  DataTableEmpty,
  DataTableFooter,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  DataTableScroll,
  DataTableState,
  DataTableToolbar,
} from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/surface";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type ParticipantRow = {
  id: string;
  employeeNumber: string;
  fullName: string;
  institutionalEmail: string | null;
  jobTitle: string | null;
  costCenter: string | null;
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
        cost_center
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
      accessProfile: item.access_profile ?? null,
      status: item.status,
      completedAt: item.completed_at,
    } satisfies ParticipantRow;
  });
}

function exportCsv(rows: ParticipantRow[]) {
  const header = ["Matrícula", "Nome", "E-mail institucional", "Cargo", "Unidade/Centro de custo", "Perfil", "Situação", "Conclusão"];
  const lines = rows.map((row) => [row.employeeNumber, row.fullName, row.institutionalEmail ?? "", row.jobTitle ?? "", row.costCenter ?? "", row.accessProfile ?? "", row.status, row.completedAt ? new Date(row.completedAt).toLocaleString("pt-BR") : ""]);
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
  return ({ ELIGIBLE: "Elegível", IN_PROGRESS: "Em andamento", COMPLETED: "Concluído", BLOCKED: "Bloqueado", INACTIVE: "Inativo" } as Record<string, string>)[status] ?? status;
}

function statusVariant(status: string): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "COMPLETED") return "success";
  if (status === "IN_PROGRESS") return "info";
  if (status === "BLOCKED") return "danger";
  if (status === "ELIGIBLE") return "warning";
  return "neutral";
}

export function AdminParticipantsTable() {
  const [sorting, setSorting] = useState<SortingState>([{ id: "fullName", desc: false }]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const query = useQuery({ queryKey: ["admin", "participants", "CDDI-2026"], queryFn: loadParticipants });

  const filteredData = useMemo(() => {
    const rows = query.data ?? [];
    if (statusFilter === "TODOS") return rows;
    if (statusFilter === "SEM_EMAIL") return rows.filter((row) => !row.institutionalEmail);
    return rows.filter((row) => row.status === statusFilter);
  }, [query.data, statusFilter]);

  const columns = useMemo<ColumnDef<ParticipantRow>[]>(() => [
    { accessorKey: "fullName", header: "Participante", cell: ({ row }) => <div className="min-w-64"><strong className="block text-sm text-slate-900">{row.original.fullName}</strong><span className="mt-1 block text-xs text-slate-500">Matrícula {row.original.employeeNumber}</span></div> },
    { accessorKey: "institutionalEmail", header: "Contato", cell: ({ row }) => row.original.institutionalEmail ? <span className="text-sm text-slate-700">{row.original.institutionalEmail}</span> : <Badge variant="warning"><MailWarning className="h-3.5 w-3.5" aria-hidden="true" />Sem e-mail</Badge> },
    { accessorKey: "jobTitle", header: "Cargo e unidade", cell: ({ row }) => <div className="min-w-56 text-sm"><span className="block font-semibold text-slate-800">{row.original.jobTitle ?? "Cargo não informado"}</span><span className="mt-1 block text-xs text-slate-500">{row.original.costCenter ?? "Unidade não informada"}</span></div> },
    { accessorKey: "accessProfile", header: "Perfil", cell: ({ getValue }) => <Badge variant="info">{String(getValue() ?? "Participante")}</Badge> },
    { accessorKey: "status", header: "Situação", cell: ({ getValue }) => { const value = String(getValue()); return <Badge variant={statusVariant(value)}>{statusLabel(value)}</Badge>; } },
  ], []);

  // TanStack Table manages callback identity internally; React Compiler skips this hook safely.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: filteredData, columns, state: { sorting, globalFilter }, onSortingChange: setSorting, onGlobalFilterChange: setGlobalFilter, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getFilteredRowModel: getFilteredRowModel(), getPaginationRowModel: getPaginationRowModel(), initialState: { pagination: { pageSize: 20 } } });
  const total = query.data?.length ?? 0;
  const withoutEmail = query.data?.filter((row) => !row.institutionalEmail).length ?? 0;
  const completed = query.data?.filter((row) => row.status === "COMPLETED").length ?? 0;
  const visibleRows = table.getRowModel().rows;
  const filteredRows = table.getFilteredRowModel().rows;

  return <div className="space-y-6">
    <section className="grid gap-4 md:grid-cols-3" aria-label="Indicadores dos participantes">
      <StatCard label="Participantes" value={total.toLocaleString("pt-BR")} description="Vinculados ao CDDI" />
      <StatCard label="Sem e-mail" value={withoutEmail.toLocaleString("pt-BR")} description="Necessitam tratamento" />
      <StatCard label="Concluídos" value={completed.toLocaleString("pt-BR")} description="Formulários finalizados" />
    </section>

    <DataTableContainer aria-label="Participantes do CDDI">
      <DataTableToolbar>
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <label className="relative flex-1"><span className="sr-only">Pesquisar participantes</span><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input value={globalFilter} onChange={(event) => setGlobalFilter(event.target.value)} placeholder="Pesquisar por nome, matrícula, e-mail ou cargo" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100" /></label>
          <label><span className="sr-only">Filtrar por situação</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 sm:w-auto"><option value="TODOS">Todas as situações</option><option value="ELIGIBLE">Elegíveis</option><option value="IN_PROGRESS">Em andamento</option><option value="COMPLETED">Concluídos</option><option value="SEM_EMAIL">Sem e-mail</option></select></label>
        </div>
        <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => query.refetch().then(() => toast.success("Base de participantes atualizada."))} disabled={query.isFetching}><RefreshCw className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} aria-hidden="true" />Atualizar</Button><Button onClick={() => { exportCsv(filteredRows.map((row) => row.original)); toast.success("Arquivo CSV gerado."); }}><Download className="h-4 w-4" aria-hidden="true" />Exportar</Button></div>
      </DataTableToolbar>

      {query.isLoading ? <DataTableState aria-live="polite"><div className="space-y-3">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}</div><span className="sr-only">Carregando participantes</span></DataTableState> : query.isError ? <DataTableState className="text-red-700" role="alert"><p className="font-semibold">Não foi possível carregar os participantes.</p><p className="mt-2 text-slate-500">{query.error instanceof Error ? query.error.message : "Erro desconhecido"}</p></DataTableState> : <DataTableScroll><DataTable><DataTableHead>{table.getHeaderGroups().map((headerGroup) => <DataTableRow key={headerGroup.id} className="hover:bg-transparent">{headerGroup.headers.map((header) => <DataTableHeaderCell key={header.id}>{header.isPlaceholder ? null : <button type="button" onClick={header.column.getToggleSortingHandler()} className="inline-flex items-center gap-2 rounded focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100">{flexRender(header.column.columnDef.header, header.getContext())}{header.column.getIsSorted() === "asc" ? <ArrowDownAZ className="h-4 w-4" aria-label="Ordem crescente" /> : header.column.getIsSorted() === "desc" ? <ArrowUpAZ className="h-4 w-4" aria-label="Ordem decrescente" /> : null}</button>}</DataTableHeaderCell>)}</DataTableRow>)}</DataTableHead><DataTableBody>{visibleRows.length ? visibleRows.map((row) => <DataTableRow key={row.id}>{row.getVisibleCells().map((cell) => <DataTableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</DataTableCell>)}</DataTableRow>) : <DataTableEmpty colSpan={columns.length}>Nenhum participante encontrado para os filtros selecionados.</DataTableEmpty>}</DataTableBody></DataTable></DataTableScroll>}

      <DataTableFooter><span className="text-sm font-semibold text-slate-500">{filteredRows.length.toLocaleString("pt-BR")} registro(s) encontrados</span><div className="flex flex-wrap items-center gap-2"><Button variant="secondary" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Anterior</Button><span className="px-2 text-sm font-semibold text-slate-600">Página {table.getState().pagination.pageIndex + 1} de {Math.max(table.getPageCount(), 1)}</span><Button variant="secondary" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Próxima</Button></div></DataTableFooter>
    </DataTableContainer>
  </div>;
}
