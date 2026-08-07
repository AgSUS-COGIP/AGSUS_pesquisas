import { NextRequest, NextResponse } from "next/server";
import {
  formatAdminImportValidationErrors,
  parseAdminImportRequest,
  type AdminImportRequest,
} from "@/lib/admin-import-contract";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function securityHeaders() {
  return {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
}

function warningCount(counts: AdminImportRequest["issueCounts"]) {
  return counts.missingEmail + counts.invalidEmail + counts.duplicateEmail + counts.duplicateEmployee;
}

async function resolveAuthorizedActor() {
  const sessionClient = await createServerSupabaseClient();
  const { data: userData, error: userError } = await sessionClient.auth.getUser();
  if (userError || !userData.user) return null;

  const { data: context, error: contextError } = await sessionClient.rpc("get_my_platform_context");
  if (contextError || !context || typeof context !== "object") return null;

  const value = context as {
    status?: string;
    canManageSurveys?: boolean;
    person?: { id?: string };
    roles?: string[];
  };

  const allowedRoles = new Set(["ADMINISTRATOR", "SURVEY_MANAGER", "TECHNICAL_TEAM"]);
  const allowed = value.canManageSurveys === true
    && value.roles?.some((role) => allowedRoles.has(role));

  if (!allowed || value.status !== "OK" || !value.person?.id) return null;
  return { personId: value.person.id, authUserId: userData.user.id, roles: value.roles ?? [] };
}

async function markBatchFailed(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  batchId: string,
  actorPersonId: string,
  stage: string,
  message: string,
) {
  await admin.from("data_import_batches").update({
    status: "FAILED",
    completed_at: new Date().toISOString(),
    metadata: {
      import_mode: "MASTER_DATA_SYNC",
      failure_stage: stage,
      failure_message: message.slice(0, 500),
      failed_by: actorPersonId,
    },
  }).eq("id", batchId).eq("executed_by", actorPersonId);
}

/**
 * Sincroniza um lote da base institucional de pessoas.
 *
 * Chamada por `/admin/importacao` uma vez por lote de até
 * `MAX_IMPORT_ROWS_PER_REQUEST` linhas (ver `@/lib/admin-import-contract`). O
 * primeiro lote abre o registro em `data_import_batches`; o último o encerra.
 * Falha em qualquer etapa marca o lote como `FAILED`, preservando a trilha de
 * auditoria da tentativa.
 *
 * A autorização vem da sessão do administrador (`resolveAuthorizedActor`), não
 * de token compartilhado: o lote fica vinculado a `executed_by`.
 *
 * **Atualiza apenas a base mestra.** Ninguém é vinculado a pesquisa — daí
 * `survey_assignment: false` e `surveyAssignmentsCreated: 0`. Vincular público a
 * um ciclo é ato explícito do administrador em `/admin/participantes`.
 */
export async function POST(request: NextRequest) {
  const actor = await resolveAuthorizedActor();
  if (!actor) {
    return NextResponse.json({ error: "Acesso administrativo não autorizado." }, {
      status: 403,
      headers: securityHeaders(),
    });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Conteúdo JSON inválido." }, {
      status: 400,
      headers: securityHeaders(),
    });
  }

  const parsed = parseAdminImportRequest(rawBody);
  if (!parsed.success) {
    return NextResponse.json({
      error: "Dados da importação inválidos.",
      details: formatAdminImportValidationErrors(parsed.error),
    }, { status: 400, headers: securityHeaders() });
  }

  const body = parsed.data;
  const admin = createAdminSupabaseClient();
  let batchId = body.batchId;

  if (body.isFirstChunk) {
    const { data: batch, error } = await admin.from("data_import_batches").insert({
      source_name: body.fileName,
      source_version: new Date().toISOString(),
      entity_type: "PEOPLE_BASE",
      status: "RUNNING",
      received_rows: body.totalRows,
      warning_rows: warningCount(body.issueCounts),
      rejected_rows: body.issueCounts.invalidRows,
      executed_by: actor.personId,
      metadata: {
        import_channel: "VERCEL_ADMIN_UI_AUTHENTICATED",
        import_mode: "MASTER_DATA_SYNC",
        issue_counts: body.issueCounts,
        source_format: body.rows[0].sourceFormat,
        survey_assignment: false,
        actor_roles: actor.roles,
      },
    }).select("id").single();

    if (error || !batch) {
      return NextResponse.json({ error: error?.message ?? "Não foi possível iniciar o lote." }, {
        status: 500,
        headers: securityHeaders(),
      });
    }
    batchId = batch.id;
  }

  if (!batchId) {
    return NextResponse.json({ error: "Identificador do lote não informado." }, {
      status: 400,
      headers: securityHeaders(),
    });
  }

  const { data: ownedBatch } = await admin.from("data_import_batches")
    .select("id,status,executed_by")
    .eq("id", batchId)
    .eq("executed_by", actor.personId)
    .single();

  if (!ownedBatch || ownedBatch.status !== "RUNNING") {
    return NextResponse.json({ error: "O lote não pertence ao usuário atual ou não está em execução." }, {
      status: 409,
      headers: securityHeaders(),
    });
  }

  const { data: syncResult, error: syncError } = await admin.rpc("sync_people_base_rows", {
    p_rows: body.rows,
    p_batch_id: batchId,
  });
  if (syncError) {
    await markBatchFailed(admin, batchId, actor.personId, "PEOPLE_SYNC", syncError.message);
    return NextResponse.json({ error: "Falha ao sincronizar a base de pessoas." }, {
      status: 500,
      headers: securityHeaders(),
    });
  }

  const { data: managerSyncResult, error: managerSyncError } = await admin.rpc("sync_cddi_manager_rows", {
    p_rows: body.rows,
    p_batch_id: batchId,
  });
  if (managerSyncError) {
    await markBatchFailed(admin, batchId, actor.personId, "MANAGER_SYNC", managerSyncError.message);
    return NextResponse.json({ error: "Falha ao sincronizar vínculos de liderança." }, {
      status: 500,
      headers: securityHeaders(),
    });
  }

  // As pendências são derivadas do texto exato dos avisos produzidos por
  // `parsePeopleImportRows` em `@/lib/people-import`. Alterar uma dessas mensagens
  // exige atualizar os literais aqui, senão a pendência deixa de ser registrada
  // silenciosamente. Todas são WARNING: a pessoa entra na base mesmo sem e-mail
  // utilizável, apenas sem identidade de acesso.
  const issues = body.rows.flatMap((row) => {
    const result: Array<Record<string, unknown>> = [];
    const add = (issueCode: string, message: string) => result.push({
      batch_id: batchId,
      row_number: row.rowNumber,
      entity_key: row.employeeNumber,
      severity: "WARNING",
      issue_code: issueCode,
      message,
    });
    if (row.warnings.includes("E-mail institucional não informado")) add("MISSING_EMAIL", "Pessoa sem e-mail institucional informado; cadastro mantido sem identidade de acesso.");
    if (row.warnings.includes("E-mail institucional inválido")) add("INVALID_EMAIL", "E-mail institucional inválido; cadastro mantido sem identidade de acesso.");
    if (row.warnings.includes("E-mail compartilhado entre matrículas")) add("DUPLICATE_EMAIL", "E-mail compartilhado entre matrículas; identidade de acesso não ativada automaticamente.");
    if (row.warnings.includes("E-mail do gestor inválido")) add("INVALID_MANAGER_EMAIL", "E-mail da liderança possui formato inválido.");
    if (row.warnings.includes("Data de admissão inválida")) add("INVALID_ADMISSION_DATE", "Data de admissão não reconhecida e não importada.");
    return result;
  });

  if (issues.length) {
    const { error } = await admin.from("data_import_issues").insert(issues);
    if (error) {
      await markBatchFailed(admin, batchId, actor.personId, "ISSUE_REGISTRATION", error.message);
      return NextResponse.json({ error: "Falha ao registrar alertas da importação." }, {
        status: 500,
        headers: securityHeaders(),
      });
    }
  }

  if (body.isLastChunk) {
    const hasWarnings = body.issueCounts.invalidRows > 0 || warningCount(body.issueCounts) > 0;
    const completedAt = new Date().toISOString();
    const { error } = await admin.from("data_import_batches").update({
      status: hasWarnings ? "COMPLETED_WITH_WARNINGS" : "COMPLETED",
      accepted_rows: body.totalRows - body.issueCounts.invalidRows,
      completed_at: completedAt,
      metadata: {
        import_channel: "VERCEL_ADMIN_UI_AUTHENTICATED",
        import_mode: "MASTER_DATA_SYNC",
        survey_assignment: false,
        issue_counts: body.issueCounts,
        source_format: body.rows[0].sourceFormat,
        manager_sync: managerSyncResult,
        completed_by: actor.personId,
      },
    }).eq("id", batchId).eq("executed_by", actor.personId);

    if (error) {
      return NextResponse.json({ error: "Falha ao concluir o lote de importação." }, {
        status: 500,
        headers: securityHeaders(),
      });
    }

    await admin.from("audit_events").insert({
      actor_person_id: actor.personId,
      event_type: "PEOPLE_BASE_IMPORT_COMPLETED",
      entity_type: "DATA_IMPORT_BATCH",
      entity_id: batchId,
      after_data: {
        status: hasWarnings ? "COMPLETED_WITH_WARNINGS" : "COMPLETED",
        acceptedRows: body.totalRows - body.issueCounts.invalidRows,
        rejectedRows: body.issueCounts.invalidRows,
      },
      metadata: {
        sourceName: body.fileName,
        sourceFormat: body.rows[0].sourceFormat,
        authUserId: actor.authUserId,
      },
    });
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
