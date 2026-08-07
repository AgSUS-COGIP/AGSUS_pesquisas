import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const MAX_ROWS_PER_REQUEST = 250;

type ParticipantRow = {
  rowNumber: number;
  status: string;
  detailedStatus: string;
  fullName: string;
  employeeNumber: string;
  jobTitle: string;
  costCenter: string;
  directorate: string;
  unit: string;
  coordination: string;
  institutionalEmail: string | null;
  workplace: string;
  accessProfile: string;
  participates: boolean;
  participantKey: string;
  emailEligibleForAccess: boolean;
  admissionDate: string | null;
  managerName: string | null;
  managerEmail: string | null;
  sourceFormat: string;
  warnings: string[];
};

type IssueCounts = {
  missingEmail: number;
  invalidEmail: number;
  duplicateEmail: number;
  duplicateEmployee: number;
  invalidRows: number;
};

type RequestBody = {
  batchId?: string;
  fileName: string;
  totalRows: number;
  isFirstChunk: boolean;
  isLastChunk: boolean;
  rows: ParticipantRow[];
  issueCounts: IssueCounts;
};

// Comparação em tempo constante: `===` vazaria o prefixo correto do token por
// diferença de tempo. `timingSafeEqual` exige buffers de mesmo tamanho, daí a
// checagem prévia de comprimento.
function isAuthorized(request: NextRequest) {
  const expected = process.env.ADMIN_IMPORT_TOKEN;
  const received = request.headers.get("x-admin-import-token");
  if (!expected || !received) return false;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

function securityHeaders() {
  return {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
}

function warningCount(counts: IssueCounts) {
  return counts.missingEmail + counts.invalidEmail + counts.duplicateEmail + counts.duplicateEmployee;
}

/**
 * Sincroniza um lote da base institucional de pessoas.
 *
 * Chamada por `/admin/importacao` uma vez por lote de até
 * {@link MAX_ROWS_PER_REQUEST} linhas. O primeiro lote abre o registro em
 * `data_import_batches`; o último o encerra. Falha em qualquer etapa marca o lote
 * como `FAILED`, preservando a trilha de auditoria da tentativa.
 *
 * **Atualiza apenas a base mestra.** Ninguém é vinculado a pesquisa — daí
 * `survey_assignment: false` e `surveyAssignmentsCreated: 0`. Vincular público a
 * um ciclo é ato explícito do administrador em `/admin/participantes`.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401, headers: securityHeaders() });
  }

  let body: RequestBody;
  try {
    body = await request.json() as RequestBody;
  } catch {
    return NextResponse.json({ error: "Conteúdo JSON inválido." }, { status: 400, headers: securityHeaders() });
  }

  if (!Array.isArray(body.rows) || body.rows.length < 1 || body.rows.length > MAX_ROWS_PER_REQUEST) {
    return NextResponse.json({ error: `Cada lote deve conter entre 1 e ${MAX_ROWS_PER_REQUEST} registros.` }, { status: 400, headers: securityHeaders() });
  }
  if (!body.fileName?.trim() || !Number.isInteger(body.totalRows) || body.totalRows < body.rows.length) {
    return NextResponse.json({ error: "Metadados do arquivo inválidos." }, { status: 400, headers: securityHeaders() });
  }

  const supabase = createAdminSupabaseClient();
  let batchId = body.batchId;

  if (body.isFirstChunk) {
    const { data: batch, error } = await supabase.from("data_import_batches").insert({
      source_name: body.fileName.trim(),
      source_version: new Date().toISOString(),
      entity_type: "PEOPLE_BASE",
      status: "RUNNING",
      received_rows: body.totalRows,
      warning_rows: warningCount(body.issueCounts),
      rejected_rows: body.issueCounts.invalidRows,
      metadata: {
        import_channel: "VERCEL_ADMIN_UI",
        import_mode: "MASTER_DATA_SYNC",
        issue_counts: body.issueCounts,
        source_format: body.rows[0]?.sourceFormat ?? "UNKNOWN",
        survey_assignment: false,
      },
    }).select("id").single();

    if (error || !batch) {
      return NextResponse.json({ error: error?.message ?? "Não foi possível iniciar o lote." }, { status: 500, headers: securityHeaders() });
    }
    batchId = batch.id;
  }

  if (!batchId) {
    return NextResponse.json({ error: "Identificador do lote não informado." }, { status: 400, headers: securityHeaders() });
  }

  const { data: syncResult, error: syncError } = await supabase.rpc("sync_people_base_rows", {
    p_rows: body.rows,
    p_batch_id: batchId,
  });

  if (syncError) {
    await supabase.from("data_import_batches").update({
      status: "FAILED",
      completed_at: new Date().toISOString(),
      metadata: {
        import_mode: "MASTER_DATA_SYNC",
        failure_message: syncError.message,
      },
    }).eq("id", batchId);
    return NextResponse.json({ error: syncError.message }, { status: 500, headers: securityHeaders() });
  }

  const { data: managerSyncResult, error: managerSyncError } = await supabase.rpc("sync_cddi_manager_rows", {
    p_rows: body.rows,
    p_batch_id: batchId,
  });

  if (managerSyncError) {
    await supabase.from("data_import_batches").update({
      status: "FAILED",
      completed_at: new Date().toISOString(),
      metadata: {
        import_mode: "MASTER_DATA_SYNC",
        failure_stage: "MANAGER_SYNC",
        failure_message: managerSyncError.message,
      },
    }).eq("id", batchId);
    return NextResponse.json({ error: managerSyncError.message }, { status: 500, headers: securityHeaders() });
  }

  // As pendências são derivadas do texto exato dos avisos produzidos por
  // `parsePeopleImportRows` em `@/lib/people-import`. Alterar uma dessas mensagens
  // exige atualizar os literais aqui, senão a pendência deixa de ser registrada
  // silenciosamente. Todas são WARNING: a pessoa entra na base mesmo sem e-mail
  // utilizável, apenas sem identidade de acesso.
  const issues = body.rows.flatMap((row) => {
    const rowIssues: Array<Record<string, unknown>> = [];
    if (row.warnings.includes("E-mail institucional não informado")) {
      rowIssues.push({ batch_id: batchId, row_number: row.rowNumber, entity_key: row.employeeNumber, severity: "WARNING", issue_code: "MISSING_EMAIL", message: "Pessoa sem e-mail institucional informado; cadastro mantido sem identidade de acesso." });
    }
    if (row.warnings.includes("E-mail institucional inválido")) {
      rowIssues.push({ batch_id: batchId, row_number: row.rowNumber, entity_key: row.employeeNumber, severity: "WARNING", issue_code: "INVALID_EMAIL", message: "E-mail institucional inválido; cadastro mantido sem identidade de acesso." });
    }
    if (row.warnings.includes("E-mail compartilhado entre matrículas")) {
      rowIssues.push({ batch_id: batchId, row_number: row.rowNumber, entity_key: row.employeeNumber, severity: "WARNING", issue_code: "DUPLICATE_EMAIL", message: "E-mail compartilhado entre matrículas; identidade de acesso não foi ativada automaticamente." });
    }
    if (row.warnings.includes("E-mail do gestor inválido")) {
      rowIssues.push({ batch_id: batchId, row_number: row.rowNumber, entity_key: row.employeeNumber, severity: "WARNING", issue_code: "INVALID_MANAGER_EMAIL", message: "E-mail do gestor ou coordenador possui formato inválido." });
    }
    if (row.warnings.includes("Data de admissão inválida")) {
      rowIssues.push({ batch_id: batchId, row_number: row.rowNumber, entity_key: row.employeeNumber, severity: "WARNING", issue_code: "INVALID_ADMISSION_DATE", message: "Data de admissão não reconhecida e não importada." });
    }
    return rowIssues;
  });

  if (issues.length) {
    const { error: issueError } = await supabase.from("data_import_issues").insert(issues);
    if (issueError) return NextResponse.json({ error: issueError.message }, { status: 500, headers: securityHeaders() });
  }

  if (body.isLastChunk) {
    const hasWarnings = body.issueCounts.invalidRows > 0 || warningCount(body.issueCounts) > 0;
    const { error: batchError } = await supabase.from("data_import_batches").update({
      status: hasWarnings ? "COMPLETED_WITH_WARNINGS" : "COMPLETED",
      accepted_rows: body.totalRows - body.issueCounts.invalidRows,
      completed_at: new Date().toISOString(),
      metadata: {
        import_channel: "VERCEL_ADMIN_UI",
        import_mode: "MASTER_DATA_SYNC",
        survey_assignment: false,
        issue_counts: body.issueCounts,
        source_format: body.rows[0]?.sourceFormat ?? "UNKNOWN",
        manager_sync: managerSyncResult,
      },
    }).eq("id", batchId);
    if (batchError) return NextResponse.json({ error: batchError.message }, { status: 500, headers: securityHeaders() });
  }

  return NextResponse.json({
    batchId,
    synchronizedRows: body.rows.length,
    syncResult,
    managerSyncResult,
    completed: body.isLastChunk,
    surveyAssignmentsCreated: 0,
  }, { headers: securityHeaders() });
}
