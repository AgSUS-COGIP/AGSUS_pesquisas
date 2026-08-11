"use client";

import { AlertTriangle, CheckCircle2, Database, FileSpreadsheet, Hourglass, Info, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { PlatformGuardState } from "@/components/platform-guard-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { parsePeopleImportRows, summarizePeopleImport, type PeopleImportRow, type RawPeopleImportRow } from "@/lib/people-import";
import { usePlatformGuard } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";

const CHUNK_SIZE = 200;
type ImportStatus = "idle" | "reading" | "ready" | "importing" | "done" | "error";

/**
 * As oito contagens da validação, cada uma com a consequência explicada. O
 * operador precisa saber o que *acontece* com a linha, não só quantas são —
 * erro bloqueia a linha, aviso preserva a pessoa sem liberar acesso.
 */
type SummaryTile = { label: string; value: number; description: string; tone: "neutral" | "success" | "warning" | "danger" };

export default function ImportPeopleBasePage() {
  const guard = usePlatformGuard(PLATFORM_MODULE.ADMIN_IMPORT);
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
  const analysed = rows.length > 0;

  // A rota de API é a proteção efetiva, mas a tela também não deve abrir para
  // quem não tem o módulo: a carga da base institucional é do Superadmin.
  if (guard.state !== "granted") {
    return <PlatformGuardState
      guard={guard}
      title="importações"
      unidentifiedTitle="Não foi possível abrir importações"
      restrictedTitle="Importações restritas"
      restrictedDescription="A atualização da base institucional é exclusiva do Superadmin."
    />;
  }

  const summaryTiles: SummaryTile[] = [
    { label: "Registros lidos", value: summary.total, description: "linhas encontradas na planilha", tone: "neutral" },
    { label: "Prontos para carga", value: summary.valid, description: "serão criados ou atualizados", tone: "success" },
    { label: "Acesso automático", value: summary.accessEligible, description: "e-mail válido e único entre matrículas", tone: "success" },
    { label: "Linhas rejeitadas", value: summary.invalid, description: "sem matrícula ou sem nome — não entram", tone: "danger" },
    { label: "Sem e-mail", value: summary.missingEmail, description: "pessoa é importada, sem acesso", tone: "warning" },
    { label: "E-mail inválido", value: summary.invalidEmail, description: "pessoa é importada, sem acesso", tone: "warning" },
    { label: "E-mail compartilhado", value: summary.duplicateEmailRows, description: "repetido entre matrículas — não ativa acesso", tone: "warning" },
    { label: "Matrículas repetidas", value: summary.duplicateEmployeeRows, description: "só a primeira ocorrência é importada", tone: "warning" },
  ];

  const canSubmit = summary.valid > 0 && !busy && status !== "done";

  return (
    <main className="min-h-screen bg-[var(--surface-page)] px-5 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--shadow-card)] sm:p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--brand-secondary)]">Administração · Dados mestres</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl">Atualização da base institucional</h1>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Importe a base CDDI ou o modelo institucional padrão. O CPF não é lido nem armazenado neste fluxo.</p>
            </div>
            <Link
              href="/admin/participantes"
              className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
            >
              Voltar aos participantes
            </Link>
          </div>
        </header>

        <p className="flex items-start gap-3 rounded-2xl border border-[var(--status-info-border)] bg-[var(--status-info-bg)] p-4 text-sm leading-6 text-[var(--status-info-text)]">
          <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <span><strong className="font-semibold">Esta operação atualiza apenas a base mestra de pessoas.</strong> Ninguém é vinculado a avaliações automaticamente — isso continua sendo um ato explícito na gestão de participantes.</span>
        </p>

        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <section aria-label="Arquivo de atualização" className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-[var(--brand-primary)]">
                <UploadCloud className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">1. Escolha o arquivo</h2>
                <p className="text-xs leading-5 text-[var(--text-secondary)]">CSV, XLSX ou XLS · aba BASE_PARTICIPANTES, BASE ou a primeira</p>
              </div>
            </div>

            <div className="mt-5">
              <label
                htmlFor="file"
                className={`flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition ${
                  busy
                    ? "cursor-not-allowed border-[var(--border-subtle)] bg-[var(--surface-muted)] opacity-60"
                    : "border-[var(--border-strong)] bg-[var(--surface-muted)] hover:border-[var(--focus-ring)] hover:bg-[var(--surface-hover)]"
                }`}
              >
                <FileSpreadsheet className="h-7 w-7 text-[var(--text-muted)]" aria-hidden="true" />
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  {fileName || "Selecionar planilha"}
                </span>
                <span className="text-xs leading-5 text-[var(--text-secondary)]">
                  {fileName ? "Escolher outro arquivo" : "Nada é enviado antes de você confirmar"}
                </span>
              </label>
              <input
                id="file"
                type="file"
                accept=".csv,.xlsx,.xls"
                disabled={busy}
                onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file); }}
                className="sr-only"
              />
            </div>

            <h2 className="mt-6 text-lg font-semibold tracking-tight text-[var(--text-primary)]">2. Confirme a carga</h2>
            <Button
              fullWidth
              size="lg"
              className="mt-3"
              onClick={() => void synchronizeBase()}
              disabled={!canSubmit}
              title={canSubmit ? `Enviar ${summary.valid} registros válidos para a base institucional` : undefined}
            >
              {status === "importing" ? <Hourglass className="h-5 w-5 animate-pulse" aria-hidden="true" /> : <Database className="h-5 w-5" aria-hidden="true" />}
              {status === "importing"
                ? "Atualizando base..."
                : summary.valid > 0
                  ? `Confirmar ${summary.valid} ${summary.valid === 1 ? "registro" : "registros"}`
                  : "Confirmar carga"}
            </Button>
            {!canSubmit && status !== "importing" && (
              <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                {status === "done"
                  ? "Carga concluída. Selecione outro arquivo para uma nova atualização."
                  : !analysed
                    ? "Escolha uma planilha para habilitar a confirmação."
                    : "Nenhuma linha válida nesta planilha. Corrija a matrícula e o nome dos registros rejeitados."}
              </p>
            )}

            <div
              role="status"
              aria-live="polite"
              className={`mt-5 rounded-xl border p-4 text-sm leading-6 ${
                status === "error"
                  ? "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]"
                  : status === "done"
                    ? "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
                    : "border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-secondary)]"
              }`}
            >
              <div className="flex items-start gap-2">
                {status === "done" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  : status === "error" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  : busy ? <Hourglass className="mt-0.5 h-4 w-4 shrink-0 animate-pulse" aria-hidden="true" />
                  : <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
                <span>{message}</span>
              </div>
              {(status === "importing" || status === "done") && (
                <div
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Progresso da atualização"
                  className="mt-3 h-2.5 overflow-hidden rounded-full bg-[var(--surface-muted)]"
                >
                  <div className="h-full rounded-full bg-[var(--brand-secondary)] transition-all" style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>
          </section>

          <section aria-label="Resumo da validação" className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">Resumo da validação</h2>
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Erro bloqueia apenas a linha; aviso preserva a pessoa sem liberar acesso.</p>
              </div>
              {analysed && (
                <Badge variant={summary.invalid > 0 ? "warning" : "success"}>
                  {summary.invalid > 0
                    ? <><AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />{summary.invalid} {summary.invalid === 1 ? "linha rejeitada" : "linhas rejeitadas"}</>
                    : <><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />Nenhuma linha rejeitada</>}
                </Badge>
              )}
            </div>

            {analysed ? <>
              <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {summaryTiles.map((tile) => (
                  <div key={tile.label} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4">
                    <dt className="text-xs font-semibold uppercase tracking-[.1em] text-[var(--text-secondary)]">{tile.label}</dt>
                    <dd>
                      <strong className={`mt-2 block text-2xl font-semibold ${
                        tile.value === 0 ? "text-[var(--text-muted)]"
                          : tile.tone === "danger" ? "text-[var(--status-danger-text)]"
                          : tile.tone === "warning" ? "text-[var(--status-warning-text)]"
                          : tile.tone === "success" ? "text-[var(--status-success-text)]"
                          : "text-[var(--brand-primary)]"
                      }`}>{tile.value}</strong>
                      <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">{tile.description}</span>
                    </dd>
                  </div>
                ))}
              </dl>

              <h3 className="mt-7 text-base font-semibold tracking-tight text-[var(--text-primary)]">
                Prévia dos primeiros registros
                <span className="ml-2 text-xs font-normal text-[var(--text-secondary)]">
                  {rows.length > 12 ? `mostrando 12 de ${rows.length}` : `${rows.length} ${rows.length === 1 ? "registro" : "registros"}`}
                </span>
              </h3>
              <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
                <table className="min-w-full text-left text-sm">
                  <caption className="sr-only">Prévia dos registros lidos da planilha, com o resultado da validação de cada linha.</caption>
                  <thead className="bg-[var(--surface-muted)] text-xs uppercase tracking-[.08em] text-[var(--text-secondary)]">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold">Linha</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Matrícula</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Nome</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Unidade</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Validação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 12).map((row) => (
                      <tr key={`${row.rowNumber}-${row.employeeNumber}`} className="border-t border-[var(--border-subtle)]">
                        <td className="px-4 py-3 text-[var(--text-secondary)]">{row.rowNumber}</td>
                        <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{row.employeeNumber}</td>
                        <td className="px-4 py-3 text-[var(--text-primary)]">{row.fullName}</td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">{row.coordination || row.unit || row.costCenter || "Não informada"}</td>
                        <td className="px-4 py-3">
                          <Badge variant={!row.valid ? "danger" : row.warnings.length ? "warning" : "success"}>
                            {!row.valid ? row.errors.join("; ") : row.warnings.length ? row.warnings.join("; ") : "Apta"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </> : (
              <EmptyState
                className="mt-5"
                icon={<FileSpreadsheet className="h-6 w-6" aria-hidden="true" />}
                title="Nenhuma planilha analisada"
                description="Escolha um arquivo ao lado. A validação acontece no navegador e nada é enviado antes da sua confirmação."
              />
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
