"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";

const REQUIRED_HEADERS = [
  "Status", "Situação detalhada", "Nome", "Matrícula", "Cargo atual",
  "Centro de custo", "Diretoria", "Unidade", "Coordenação",
  "E-mail institucional", "Local de trabalho", "Perfil de acesso",
  "Participa do ciclo", "Chave participante",
] as const;
const CHUNK_SIZE = 200;

type RawRow = Record<string, unknown>;
type ParticipantRow = {
  rowNumber: number; status: string; detailedStatus: string; fullName: string;
  employeeNumber: string; jobTitle: string; costCenter: string; directorate: string;
  unit: string; coordination: string; institutionalEmail: string | null;
  workplace: string; accessProfile: string; participates: boolean;
  participantKey: string; emailEligibleForAccess: boolean; valid: boolean; errors: string[];
};

const text = (value: unknown) => String(value ?? "").trim();
const normalizeEmail = (value: unknown) => {
  const email = text(value).toLowerCase();
  return email && email.includes("@") ? email : null;
};
const isYes = (value: unknown) => ["SIM", "S", "TRUE", "1"].includes(text(value).toUpperCase());

export default function ImportParticipantsPage() {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParticipantRow[]>([]);
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<"idle" | "reading" | "ready" | "importing" | "done" | "error">("idle");
  const [message, setMessage] = useState("Aguardando seleção da planilha oficial.");
  const [progress, setProgress] = useState(0);

  const summary = useMemo(() => {
    const emailCounts = new Map<string, number>();
    rows.forEach((row) => {
      if (row.institutionalEmail) emailCounts.set(row.institutionalEmail, (emailCounts.get(row.institutionalEmail) ?? 0) + 1);
    });
    const duplicates = new Set([...emailCounts.entries()].filter(([, count]) => count > 1).map(([email]) => email));
    return {
      total: rows.length,
      valid: rows.filter((row) => row.valid).length,
      invalid: rows.filter((row) => !row.valid).length,
      missingEmail: rows.filter((row) => !row.institutionalEmail).length,
      duplicateEmailRows: rows.filter((row) => row.institutionalEmail && duplicates.has(row.institutionalEmail)).length,
      duplicateEmails: duplicates.size,
      leaders: rows.filter((row) => row.accessProfile === "LIDERANCA").length,
    };
  }, [rows]);

  async function readFile(file: File) {
    setStatus("reading");
    setMessage("Lendo e validando a planilha...");
    setProgress(0);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const sheet = workbook.Sheets.BASE_PARTICIPANTES;
      if (!sheet) throw new Error("A aba BASE_PARTICIPANTES não foi encontrada.");
      const data = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: "", raw: false });
      const headers = new Set(Object.keys(data[0] ?? {}));
      const missingHeaders = REQUIRED_HEADERS.filter((header) => !headers.has(header));
      if (missingHeaders.length) throw new Error(`Cabeçalhos ausentes: ${missingHeaders.join(", ")}.`);

      const preliminary = data.map<ParticipantRow>((source, index) => {
        const fullName = text(source["Nome"]);
        const employeeNumber = text(source["Matrícula"]);
        const participantKey = text(source["Chave participante"]);
        const errors: string[] = [];
        if (!fullName) errors.push("Nome não informado");
        if (!employeeNumber) errors.push("Matrícula não informada");
        if (!participantKey) errors.push("Chave do participante não informada");
        return {
          rowNumber: index + 2,
          status: text(source["Status"]) || "Ativo",
          detailedStatus: text(source["Situação detalhada"]),
          fullName,
          employeeNumber,
          jobTitle: text(source["Cargo atual"]),
          costCenter: text(source["Centro de custo"]),
          directorate: text(source["Diretoria"]),
          unit: text(source["Unidade"]),
          coordination: text(source["Coordenação"]),
          institutionalEmail: normalizeEmail(source["E-mail institucional"]),
          workplace: text(source["Local de trabalho"]),
          accessProfile: text(source["Perfil de acesso"]).toUpperCase() || "USUARIO_COMUM",
          participates: isYes(source["Participa do ciclo"]),
          participantKey,
          emailEligibleForAccess: false,
          valid: errors.length === 0,
          errors,
        };
      });

      const counts = new Map<string, number>();
      preliminary.forEach((row) => {
        if (row.institutionalEmail) counts.set(row.institutionalEmail, (counts.get(row.institutionalEmail) ?? 0) + 1);
      });
      setRows(preliminary.map((row) => ({
        ...row,
        emailEligibleForAccess: Boolean(row.institutionalEmail && counts.get(row.institutionalEmail) === 1),
      })));
      setFileName(file.name);
      setStatus("ready");
      setMessage("Planilha validada. Confira o resumo antes da importação.");
    } catch (error) {
      setRows([]);
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Falha ao ler a planilha.");
    }
  }

  async function importRows() {
    const validRows = rows.filter((row) => row.valid);
    if (!token.trim()) {
      setStatus("error");
      setMessage("Informe o token administrativo de importação.");
      return;
    }
    if (!validRows.length) return;

    setStatus("importing");
    setProgress(0);
    let batchId: string | undefined;
    const chunks = Array.from({ length: Math.ceil(validRows.length / CHUNK_SIZE) }, (_, i) => validRows.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));

    try {
      for (let index = 0; index < chunks.length; index += 1) {
        setMessage(`Importando lote ${index + 1} de ${chunks.length}...`);
        const response = await fetch("/api/admin/import-participants", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-admin-import-token": token },
          body: JSON.stringify({
            batchId,
            fileName,
            totalRows: rows.length,
            isFirstChunk: index === 0,
            isLastChunk: index === chunks.length - 1,
            rows: chunks[index],
            issueCounts: {
              missingEmail: summary.missingEmail,
              duplicateEmail: summary.duplicateEmailRows,
              invalidRows: summary.invalid,
            },
          }),
        });
        const result = await response.json() as { batchId?: string; error?: string };
        if (!response.ok) throw new Error(result.error ?? "Falha durante a importação.");
        batchId = result.batchId;
        setProgress(Math.round(((index + 1) / chunks.length) * 100));
      }
      setStatus("done");
      setMessage(`Importação concluída. Lote ${batchId}.`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Falha durante a importação.");
    }
  }

  return (
    <main className="min-h-screen bg-[#edf3f8] px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-3xl bg-[#102c4c] p-7 text-white shadow-xl">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">Administração · CDDI 2026</p>
              <h1 className="mt-2 text-3xl font-black">Importação de participantes</h1>
              <p className="mt-3 max-w-3xl leading-7 text-blue-100">Valide a aba BASE_PARTICIPANTES e grave pessoas, perfis e pendências no Supabase em lotes auditáveis.</p>
            </div>
            <Link href="/area" className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-black">Voltar à área interna</Link>
          </div>
        </header>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <label htmlFor="file" className="text-sm font-black text-slate-700">Planilha oficial (.xlsx ou .xls)</label>
            <input id="file" type="file" accept=".xlsx,.xls" disabled={status === "importing"} onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file); }} className="mt-3 block w-full rounded-xl border border-slate-300 bg-slate-50 p-3" />

            <label htmlFor="token" className="mt-6 block text-sm font-black text-slate-700">Token administrativo</label>
            <input id="token" type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} disabled={status === "importing"} className="mt-3 block w-full rounded-xl border border-slate-300 bg-slate-50 p-3" />

            <button type="button" onClick={() => void importRows()} disabled={!rows.length || status === "reading" || status === "importing" || status === "done"} className="mt-6 w-full rounded-xl bg-[var(--primary)] px-5 py-4 font-black text-white disabled:opacity-40">Confirmar importação</button>

            <div className={`mt-5 rounded-2xl border p-4 text-sm font-bold ${status === "error" ? "border-red-200 bg-red-50 text-red-800" : status === "done" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
              {message}
              {(status === "importing" || status === "done") && <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-[var(--success)] transition-all" style={{ width: `${progress}%` }} /></div>}
            </div>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-[var(--primary-dark)]">Resumo da validação</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Registros", summary.total], ["Válidos", summary.valid], ["Inválidos", summary.invalid],
                ["Sem e-mail", summary.missingEmail], ["E-mails repetidos", summary.duplicateEmails],
                ["Linhas duplicadas", summary.duplicateEmailRows], ["Lideranças", summary.leaders],
                ["Lotes previstos", summary.valid ? Math.ceil(summary.valid / CHUNK_SIZE) : 0],
              ].map(([label, value]) => <div key={String(label)} className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-[var(--primary-dark)]">{value}</p></div>)}
            </div>

            <h3 className="mt-7 text-lg font-black text-[var(--primary-dark)]">Prévia dos primeiros registros</h3>
            <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase text-slate-600"><tr><th className="px-4 py-3">Linha</th><th className="px-4 py-3">Matrícula</th><th className="px-4 py-3">Nome</th><th className="px-4 py-3">E-mail</th><th className="px-4 py-3">Situação</th></tr></thead>
                <tbody>{rows.slice(0, 12).map((row) => <tr key={`${row.rowNumber}-${row.employeeNumber}`} className="border-t border-slate-100"><td className="px-4 py-3">{row.rowNumber}</td><td className="px-4 py-3 font-bold">{row.employeeNumber}</td><td className="px-4 py-3">{row.fullName}</td><td className="px-4 py-3">{row.institutionalEmail ?? "Sem e-mail"}</td><td className="px-4 py-3"><span className={`rounded-full px-3 py-1 text-xs font-black ${row.valid ? row.emailEligibleForAccess ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}`}>{row.valid ? row.emailEligibleForAccess ? "Elegível" : "Com pendência" : row.errors.join("; ")}</span></td></tr>)}</tbody>
              </table>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
