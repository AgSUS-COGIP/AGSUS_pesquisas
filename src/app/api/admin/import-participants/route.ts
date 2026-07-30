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
};

type RequestBody = {
  batchId?: string;
  fileName: string;
  totalRows: number;
  isFirstChunk: boolean;
  isLastChunk: boolean;
  rows: ParticipantRow[];
  issueCounts: { missingEmail: number; duplicateEmail: number; invalidRows: number };
};

function isAuthorized(request: NextRequest) {
  const expected = process.env.ADMIN_IMPORT_TOKEN;
  const received = request.headers.get("x-admin-import-token");
  if (!expected || !received) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  }

  const body = await request.json() as RequestBody;
  if (!Array.isArray(body.rows) || body.rows.length < 1 || body.rows.length > MAX_ROWS_PER_REQUEST) {
    return NextResponse.json({ error: `Cada lote deve conter entre 1 e ${MAX_ROWS_PER_REQUEST} registros.` }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const { data: application, error: applicationError } = await supabase
    .from("survey_applications")
    .select("id, opens_at")
    .eq("code", "CDDI-2026")
    .single();

  if (applicationError || !application) {
    return NextResponse.json({ error: "Aplicação CDDI-2026 não encontrada." }, { status: 500 });
  }

  let batchId = body.batchId;
  if (body.isFirstChunk) {
    const { data: batch, error } = await supabase.from("data_import_batches").insert({
      source_name: body.fileName,
      source_version: new Date().toISOString(),
      entity_type: "CDDI_PARTICIPANTS",
      status: "RUNNING",
      received_rows: body.totalRows,
      warning_rows: body.issueCounts.missingEmail + body.issueCounts.duplicateEmail,
      rejected_rows: body.issueCounts.invalidRows,
      metadata: { application_code: "CDDI-2026", import_channel: "VERCEL_ADMIN_UI", issue_counts: body.issueCounts },
    }).select("id").single();
    if (error || !batch) return NextResponse.json({ error: error?.message ?? "Não foi possível iniciar o lote." }, { status: 500 });
    batchId = batch.id;
  }

  if (!batchId) return NextResponse.json({ error: "Identificador do lote não informado." }, { status: 400 });

  const peoplePayload = body.rows.map((row) => ({
    employee_number: row.employeeNumber,
    full_name: row.fullName,
    institutional_email: row.institutionalEmail,
    job_title: row.jobTitle || null,
    cost_center: row.costCenter || null,
    workplace: row.workplace || null,
    employment_status: row.status || "ATIVO",
    active: row.participates,
    source_system: "CDDI_BASE_PARTICIPANTES_2026",
    source_key: row.participantKey,
    metadata: {
      detailed_status: row.detailedStatus,
      directorate: row.directorate,
      unit: row.unit,
      coordination: row.coordination,
      access_profile: row.accessProfile,
      source_row: row.rowNumber,
      import_batch_id: batchId,
    },
  }));

  const { data: people, error: peopleError } = await supabase
    .from("people")
    .upsert(peoplePayload, { onConflict: "employee_number" })
    .select("id, employee_number");

  if (peopleError || !people) {
    await supabase.from("data_import_batches").update({ status: "FAILED", completed_at: new Date().toISOString() }).eq("id", batchId);
    return NextResponse.json({ error: peopleError?.message ?? "Falha ao gravar pessoas." }, { status: 500 });
  }

  const peopleByEmployee = new Map(people.map((person) => [person.employee_number, person.id]));
  const participantsPayload = body.rows.map((row) => ({
    application_id: application.id,
    person_id: peopleByEmployee.get(row.employeeNumber),
    participant_role: "RESPONDENT",
    status: row.participates ? "ELIGIBLE" : "EXCLUDED",
    access_profile: row.accessProfile || "USUARIO_COMUM",
    metadata: { participant_key: row.participantKey, import_batch_id: batchId, source_row: row.rowNumber },
  }));

  const { error: participantsError } = await supabase
    .from("application_participants")
    .upsert(participantsPayload, { onConflict: "application_id,person_id,participant_role" });
  if (participantsError) {
    await supabase.from("data_import_batches").update({ status: "FAILED", completed_at: new Date().toISOString() }).eq("id", batchId);
    return NextResponse.json({ error: participantsError.message }, { status: 500 });
  }

  const identities = body.rows.filter((row) => row.institutionalEmail && row.emailEligibleForAccess).map((row) => ({
    person_id: peopleByEmployee.get(row.employeeNumber),
    identity_type: "INSTITUTIONAL_EMAIL",
    email: row.institutionalEmail,
    status: "PENDING",
    source: "CDDI_BASE_PARTICIPANTES_2026",
    metadata: { import_batch_id: batchId },
  }));
  if (identities.length) {
    const { error } = await supabase.from("person_access_identities").upsert(identities, { onConflict: "person_id,identity_type,email" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: leaderRole } = await supabase.from("system_roles").select("id").eq("code", "LEADER").single();
  if (leaderRole) {
    const assignments = body.rows.filter((row) => row.accessProfile === "LIDERANCA").map((row) => ({
      person_id: peopleByEmployee.get(row.employeeNumber),
      role_id: leaderRole.id,
      starts_at: application.opens_at ?? "2026-07-01T00:00:00-03:00",
    }));
    if (assignments.length) {
      const { error } = await supabase.from("person_role_assignments").upsert(assignments, { onConflict: "person_id,role_id,starts_at" });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const issues = body.rows.flatMap((row) => {
    if (!row.institutionalEmail) return [{ batch_id: batchId, row_number: row.rowNumber, entity_key: row.employeeNumber, severity: "WARNING", issue_code: "MISSING_EMAIL", message: "Participante sem e-mail institucional informado." }];
    if (!row.emailEligibleForAccess) return [{ batch_id: batchId, row_number: row.rowNumber, entity_key: row.employeeNumber, severity: "WARNING", issue_code: "DUPLICATE_EMAIL", message: "E-mail repetido; identidade de acesso não ativada automaticamente." }];
    return [];
  });
  if (issues.length) await supabase.from("data_import_issues").insert(issues);

  if (body.isLastChunk) {
    await supabase.from("data_import_batches").update({
      status: body.issueCounts.invalidRows || body.issueCounts.missingEmail || body.issueCounts.duplicateEmail ? "COMPLETED_WITH_WARNINGS" : "COMPLETED",
      accepted_rows: body.totalRows - body.issueCounts.invalidRows,
      completed_at: new Date().toISOString(),
    }).eq("id", batchId);
  }

  return NextResponse.json({ batchId, importedRows: body.rows.length, completed: body.isLastChunk });
}
