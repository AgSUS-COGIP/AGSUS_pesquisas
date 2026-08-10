"use client";

import { AlertTriangle, CheckCircle2, Database, FileSpreadsheet, Loader2, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { FullPageState } from "@/components/full-page-state";
import { PlatformSkeleton } from "@/components/platform-shell";
import { parsePeopleImportRows, summarizePeopleImport, type PeopleImportRow, type RawPeopleImportRow } from "@/lib/people-import";
import { deriveModules, usePlatformContext } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";

const CHUNK_SIZE = 200;
type ImportStatus = "idle" | "reading" | "ready" | "importing" | "done" | "error";

export default function ImportPeopleBasePage() {
  const { context, loading, error: contextError } = usePlatformContext();
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<PeopleImportRow[]>([]);
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [message, setMessage] = useState("Selecione a base institucional em CSV, XLSX ou XLS.");
  const [progress, setProgress] = useState(0);

  const summary = useMemo(() => summarizePeopleImport(rows), [rows]);

  async function readFile(file: File) {
    setStatus("reading");
    setMessage("Lendo e validando a base institucional...");
    setProgress(0);

    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const preferredSheet = workbook.Sheets.BASE_PARTICIPANTES
        ?? workbook.Sheets.BASE
        ?? workbook.Sheets[workbook.SheetNames[0]];
      if (!preferredSheet) throw new Error("O arquivo não contém uma aba ou tabela legível.");

      const data = XLSX.utils.sheet_to_json<RawPeopleImportRow>(preferredSheet, { defval: "", raw: false });
      if (!data.length) throw new Error("O arquivo não contém registros para atualização.");

      const parsedRows = parsePeopleImportRows(data);
      if (!parsedRows.some((row) => row.employeeNumber) || !parsedRows.some((row) => row.fullName)) {
        throw new Error("Não foi possível localizar as colunas de matrícula e nome.");
      }

      setRows(parsedRows);
      setFileName(file.name);
      setStatus("ready");
      setMessage(`${parsedRows.length} registros analisados. A atualização da base não vinculará ninguém automaticamente a avaliações.`);
    } catch (error) {
      setRows([]);
      setFileName("");
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Falha ao ler o arquivo.");
    }
  }

  async function synchronizeBase() {
    const validRows = rows.filter((row) => row.valid);
    if (!validRows.length) return;

    setStatus("importing");
    setProgress(0);
    let batchId: string | undefined;
    const chunks = Array.from(
      { length: Math.ceil(validRows.length / CHUNK_SIZE) },
      (_, index) => validRows.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
    );

    try {
      for (let index = 0; index < chunks.length; index += 1) {
        setMessage(`Atualizando lote ${index + 1} de ${chunks.length}...`);
        const response = await fetch("/api/admin/import-participants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            batchId,
            fileName,
            totalRows: rows.length,
            isFirstChunk: index === 0,
            isLastChunk: index === chunks.length - 1,
            rows: chunks[index],
            issueCounts: {
              missingEmail: summary.missingEmail,
              invalidEmail: summary.invalidEmail,
              duplicateEmail: summary.duplicateEmailRows,
              duplicateEmployee: summary.duplicateEmployeeRows,
              invalidRows: summary.invalid,
            },
          }),
        });
        const result = await response.json() as { batchId?: string; error?: string };
        if (!response.ok) throw new Error(result.error ?? "Falha durante a atualização da base.");
        batchId = result.batchId;
        setProgress(Math.round(((index + 1) / chunks.length) * 100));
      }

      setStatus("done");
      setMessage(`Base institucional atualizada. Lote ${batchId}. As pessoas já podem ser selecionadas na gestão de participantes.`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Falha durante a atualização da base.");
    }
  }

  const busy = status === "reading" || status === "importing";

  // A rota de API é a proteção efetiva, mas a tela também não deve abrir para
  // quem não tem o módulo: a carga da base institucional é do Superadmin.
  if (loading) return <PlatformSkeleton title="Carregando importações" />;
  if (!context?.person) return <FullPageState title="Não foi possível abrir importações" description={contextError || "Seu acesso institucional não foi identificado."} actionHref="/acesso" actionLabel="Voltar ao acesso" />;
  if (!deriveModules(context).includes(PLATFORM_MODULE.ADMIN_IMPORT)) {
    return <FullPageState tone="restricted" title="Importações restritas" description="A atualização da base institucional é exclusiva do Superadmin." />;
  }

  return (
    <main className="min-h-screen bg-[#edf3f8] px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <header className="overflow-hidden rounded-[2rem] bg-[#102c4c] text-white shadow-xl">
          <div className="h-1.5 bg-[linear-gradient(90deg,#003b70,#0b8f58,#f2b705,#d92d3a,#00a8d6)]" />
          <div className="flex flex-wrap items-start justify-between gap-5 p-7">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">Administração · Dados mestres</p>
              <h1 className="mt-2 text-3xl font-black">Atualização da base institucional</h1>
              <p className="mt-3 max-w-3xl leading-7 text-blue-100">Importe diretamente a base CDDI ou o modelo institucional padrão. CPF não é armazenado neste fluxo.</p>
            </div>
            <Link href="/admin/participantes" className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-black transition hover:bg-white/15">Voltar aos participantes</Link>
          </div>
        </header>

        <section className="mt-5 flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
          <Database className="mt-0.5 h-5 w-5 shrink-0" />
          <span><strong>Regra da arquitetura:</strong> esta operação atualiza apenas a base mestra de pessoas. A autorização é validada pela sessão institucional e pelo perfil do usuário.</span>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-[#003b70]"><UploadCloud className="h-5 w-5" /></span><div><h2 className="font-black text-[#003b70]">Arquivo de atualização</h2><p className="text-xs text-slate-500">CSV, XLSX ou XLS · primeira aba ou BASE_PARTICIPANTES</p></div></div>

            <label htmlFor="file" className="mt-6 block text-sm font-black text-slate-700">Base oficial de pessoas</label>
            <input id="file" type="file" accept=".csv,.xlsx,.xls" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file); }} className="mt-3 block w-full rounded-xl border border-slate-300 bg-slate-50 p-3" />

            <button type="button" onClick={() => void synchronizeBase()} disabled={!summary.valid || busy || status === "done"} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#003b70] px-5 py-4 font-black text-white transition hover:bg-[#075ea8] disabled:cursor-not-allowed disabled:opacity-40">
              {status === "importing" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Database className="h-5 w-5" />}
              {status === "importing" ? "Atualizando base..." : `Confirmar ${summary.valid || ""} registros`}
            </button>

            <div role="status" className={`mt-5 rounded-2xl border p-4 text-sm font-bold ${status === "error" ? "border-red-200 bg-red-50 text-red-800" : status === "done" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
              <div className="flex items-start gap-2">{status === "done" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : status === "error" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : null}<span>{message}</span></div>
              {(status === "importing" || status === "done") && <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-emerald-600 transition-all" style={{ width: `${progress}%` }} /></div>}
            </div>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><FileSpreadsheet className="h-5 w-5" /></span><div><h2 className="text-xl font-black text-[#003b70]">Resumo da validação</h2><p className="text-xs text-slate-500">Erros bloqueiam apenas a linha; alertas preservam a pessoa sem ativar acesso inseguro</p></div></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Registros", summary.total], ["Prontos para carga", summary.valid], ["Acesso automático", summary.accessEligible], ["Linhas rejeitadas", summary.invalid],
                ["Sem e-mail", summary.missingEmail], ["E-mail inválido", summary.invalidEmail], ["E-mail compartilhado", summary.duplicateEmailRows], ["Matrículas repetidas", summary.duplicateEmployeeRows],
              ].map(([label, value]) => <div key={String(label)} className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-[#003b70]">{value}</p></div>)}
            </div>

            <h3 className="mt-7 text-lg font-black text-[#003b70]">Prévia dos primeiros registros</h3>
            <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase text-slate-600"><tr><th className="px-4 py-3">Linha</th><th className="px-4 py-3">Matrícula</th><th className="px-4 py-3">Nome</th><th className="px-4 py-3">Unidade</th><th className="px-4 py-3">Validação</th></tr></thead>
                <tbody>{rows.slice(0, 12).map((row) => <tr key={`${row.rowNumber}-${row.employeeNumber}`} className="border-t border-slate-100"><td className="px-4 py-3">{row.rowNumber}</td><td className="px-4 py-3 font-bold">{row.employeeNumber}</td><td className="px-4 py-3">{row.fullName}</td><td className="px-4 py-3">{row.coordination || row.unit || row.costCenter || "Não informada"}</td><td className="px-4 py-3"><span className={`rounded-full px-3 py-1 text-xs font-black ${!row.valid ? "bg-red-100 text-red-800" : row.warnings.length ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{!row.valid ? row.errors.join("; ") : row.warnings.length ? row.warnings.join("; ") : "Apta"}</span></td></tr>)}</tbody>
              </table>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
