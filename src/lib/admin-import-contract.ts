import { z } from "zod";

export const MAX_IMPORT_ROWS_PER_REQUEST = 250;
export const MAX_IMPORT_TOTAL_ROWS = 50_000;

const warningSchema = z.enum([
  "E-mail institucional não informado",
  "E-mail institucional inválido",
  "E-mail compartilhado entre matrículas",
  "Matrícula repetida; registros posteriores serão ignorados",
  "E-mail do gestor inválido",
  "Data de admissão inválida",
]);

const nullableEmailSchema = z.union([
  z.string().trim().email().max(320),
  z.null(),
]);

const nullableDateSchema = z.union([
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  z.null(),
]);

export const participantImportRowSchema = z.object({
  rowNumber: z.number().int().min(2).max(MAX_IMPORT_TOTAL_ROWS + 1),
  status: z.string().trim().min(1).max(80),
  detailedStatus: z.string().trim().max(300),
  fullName: z.string().trim().min(1).max(300),
  employeeNumber: z.string().trim().min(1).max(80),
  jobTitle: z.string().trim().max(300),
  costCenter: z.string().trim().max(300),
  directorate: z.string().trim().max(300),
  unit: z.string().trim().max(300),
  coordination: z.string().trim().max(300),
  institutionalEmail: nullableEmailSchema,
  workplace: z.string().trim().max(300),
  accessProfile: z.string().trim().min(1).max(80),
  participates: z.boolean(),
  participantKey: z.string().trim().min(1).max(160),
  emailEligibleForAccess: z.boolean(),
  admissionDate: nullableDateSchema,
  managerName: z.union([z.string().trim().max(300), z.null()]),
  managerEmail: nullableEmailSchema,
  sourceFormat: z.enum(["CDDI_BASE_COMPILADO", "STANDARD_PEOPLE_BASE"]),
  valid: z.literal(true),
  errors: z.array(z.string()).length(0),
  warnings: z.array(warningSchema).max(8),
}).strict();

export const issueCountsSchema = z.object({
  missingEmail: z.number().int().min(0).max(MAX_IMPORT_TOTAL_ROWS),
  invalidEmail: z.number().int().min(0).max(MAX_IMPORT_TOTAL_ROWS),
  duplicateEmail: z.number().int().min(0).max(MAX_IMPORT_TOTAL_ROWS),
  duplicateEmployee: z.number().int().min(0).max(MAX_IMPORT_TOTAL_ROWS),
  invalidRows: z.number().int().min(0).max(MAX_IMPORT_TOTAL_ROWS),
}).strict();

export const adminImportRequestSchema = z.object({
  batchId: z.string().uuid().optional(),
  fileName: z.string().trim().min(1).max(255),
  totalRows: z.number().int().min(1).max(MAX_IMPORT_TOTAL_ROWS),
  isFirstChunk: z.boolean(),
  isLastChunk: z.boolean(),
  rows: z.array(participantImportRowSchema).min(1).max(MAX_IMPORT_ROWS_PER_REQUEST),
  issueCounts: issueCountsSchema,
}).strict().superRefine((value, context) => {
  if (value.totalRows < value.rows.length) {
    context.addIssue({
      code: "custom",
      path: ["totalRows"],
      message: "O total de registros não pode ser menor que o lote atual.",
    });
  }

  if (value.isFirstChunk && value.batchId) {
    context.addIssue({
      code: "custom",
      path: ["batchId"],
      message: "O primeiro lote não deve informar um identificador existente.",
    });
  }

  if (!value.isFirstChunk && !value.batchId) {
    context.addIssue({
      code: "custom",
      path: ["batchId"],
      message: "Lotes posteriores devem informar o identificador da importação.",
    });
  }

  for (const [field, count] of Object.entries(value.issueCounts)) {
    if (count > value.totalRows) {
      context.addIssue({
        code: "custom",
        path: ["issueCounts", field],
        message: "A contagem não pode superar o total de registros.",
      });
    }
  }
});

export type AdminImportRequest = z.infer<typeof adminImportRequestSchema>;

export function parseAdminImportRequest(value: unknown) {
  return adminImportRequestSchema.safeParse(value);
}

export function formatAdminImportValidationErrors(error: z.ZodError) {
  return error.issues.slice(0, 8).map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));
}
