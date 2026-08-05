export type RawPeopleImportRow = Record<string, unknown>;

export type PeopleImportRow = {
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
  sourceFormat: "CDDI_BASE_COMPILADO" | "STANDARD_PEOPLE_BASE";
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export type PeopleImportSummary = {
  total: number;
  valid: number;
  invalid: number;
  active: number;
  missingEmail: number;
  invalidEmail: number;
  duplicateEmailRows: number;
  duplicateEmails: number;
  duplicateEmployeeRows: number;
  duplicateEmployees: number;
  accessEligible: number;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACTIVE_STATUSES = new Set(["ATIVO", "NORMAL", "ACTIVE", "EM EXERCICIO"]);

const FIELD_ALIASES = {
  employeeNumber: ["MATRICULA", "MATRÍCULA"],
  fullName: ["NOME"],
  status: ["STATUS"],
  detailedStatus: ["SITUACAO DETALHADA", "SITUAÇÃO DETALHADA"],
  jobTitle: ["CARGO ATUAL", "CARGO ATUAL DESC", "CARGO_ATUAL_DESC"],
  costCenter: ["CENTRO DE CUSTO", "UNIDADE ORCAMENTARIA DESC", "UNIDADE_ORCAMENTARIA_DESC"],
  directorate: ["DIRETORIA", "DIVISAO DESC", "DIVISAO_DESC"],
  unit: ["UNIDADE", "SUBDIVISAO DESC", "SUBDIVISAO_DESC"],
  coordination: ["COORDENACAO", "COORDENAÇÃO", "COORDENACAO UTILIZADA", "COORDENAÇÃO UTILIZADA"],
  coordinationFallback: ["PLANILHA FELIPE", "DIMENSIONAMENTO"],
  institutionalEmail: [
    "E MAIL INSTITUCIONAL",
    "EMAIL INSTITUCIONAL",
    "E-MAIL INSTITUCIONAL",
    "E-MAIL_INSTUCIONAL",
    "E MAIL INSTUCIONAL",
    "EMAIL INSTUCIONAL",
  ],
  workplace: ["LOCAL DE TRABALHO"],
  accessProfile: ["PERFIL DE ACESSO"],
  participates: ["PARTICIPA DO CICLO"],
  participantKey: ["CHAVE PARTICIPANTE"],
  admissionDate: ["DATA ADMISSAO", "DATA ADMISSÃO", "DATA_ADMISSAO"],
  managerName: ["NOME GESTOR COORDENADOR", "NOME GESTOR/COORDENADOR"],
  managerEmail: ["E MAIL GESTOR", "EMAIL GESTOR", "E-MAIL GESTOR"],
} as const;

function text(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeToken(value: unknown) {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function sourceValues(source: RawPeopleImportRow) {
  return new Map(Object.entries(source).map(([key, value]) => [normalizeToken(key), value]));
}

function firstValue(values: Map<string, unknown>, aliases: readonly string[]) {
  for (const alias of aliases) {
    const value = values.get(normalizeToken(alias));
    if (text(value)) return text(value);
  }
  return "";
}

function parseBoolean(value: string) {
  return new Set(["SIM", "S", "TRUE", "1"]).has(normalizeToken(value));
}

function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  return EMAIL_PATTERN.test(email) ? email : null;
}

function normalizeDate(value: string) {
  const raw = value.trim();
  if (!raw) return null;
  const brazilian = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  if (brazilian) {
    const [, day, month, year] = brazilian;
    const iso = `${year}-${month}-${day}`;
    const date = new Date(`${iso}T00:00:00Z`);
    return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso ? null : iso;
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) {
    const date = new Date(`${raw}T00:00:00Z`);
    return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw ? null : raw;
  }
  return null;
}

function detectSourceFormat(headers: string[]): PeopleImportRow["sourceFormat"] {
  const normalizedHeaders = new Set(headers.map(normalizeToken));
  return normalizedHeaders.has(normalizeToken("CARGO_ATUAL_DESC"))
    || normalizedHeaders.has(normalizeToken("E-MAIL_INSTUCIONAL"))
    ? "CDDI_BASE_COMPILADO"
    : "STANDARD_PEOPLE_BASE";
}

export function parsePeopleImportRows(data: RawPeopleImportRow[]): PeopleImportRow[] {
  if (!data.length) return [];

  const sourceFormat = detectSourceFormat(Object.keys(data[0]));
  const preliminary = data.map<PeopleImportRow>((source, index) => {
    const values = sourceValues(source);
    const employeeNumber = firstValue(values, FIELD_ALIASES.employeeNumber);
    const fullName = firstValue(values, FIELD_ALIASES.fullName);
    const rawEmail = firstValue(values, FIELD_ALIASES.institutionalEmail).toLowerCase();
    const institutionalEmail = normalizeEmail(rawEmail);
    const rawManagerEmail = firstValue(values, FIELD_ALIASES.managerEmail).toLowerCase();
    const managerEmail = normalizeEmail(rawManagerEmail);
    const rawAdmissionDate = firstValue(values, FIELD_ALIASES.admissionDate);
    const admissionDate = normalizeDate(rawAdmissionDate);
    const unit = firstValue(values, FIELD_ALIASES.unit);
    const costCenter = firstValue(values, FIELD_ALIASES.costCenter);
    const coordination = firstValue(values, FIELD_ALIASES.coordination)
      || firstValue(values, FIELD_ALIASES.coordinationFallback);
    const status = firstValue(values, FIELD_ALIASES.status) || "ATIVO";
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!employeeNumber) errors.push("Matrícula não informada");
    if (!fullName) errors.push("Nome não informado");
    if (!rawEmail) warnings.push("E-mail institucional não informado");
    else if (!institutionalEmail) warnings.push("E-mail institucional inválido");
    if (rawManagerEmail && !managerEmail) warnings.push("E-mail do gestor inválido");
    if (rawAdmissionDate && !admissionDate) warnings.push("Data de admissão inválida");

    return {
      rowNumber: index + 2,
      status,
      detailedStatus: firstValue(values, FIELD_ALIASES.detailedStatus),
      fullName,
      employeeNumber,
      jobTitle: firstValue(values, FIELD_ALIASES.jobTitle),
      costCenter,
      directorate: firstValue(values, FIELD_ALIASES.directorate),
      unit,
      coordination,
      institutionalEmail,
      workplace: firstValue(values, FIELD_ALIASES.workplace) || unit || costCenter,
      accessProfile: firstValue(values, FIELD_ALIASES.accessProfile).toUpperCase() || "PARTICIPANTE",
      participates: parseBoolean(firstValue(values, FIELD_ALIASES.participates)),
      participantKey: firstValue(values, FIELD_ALIASES.participantKey) || employeeNumber,
      emailEligibleForAccess: false,
      admissionDate,
      managerName: firstValue(values, FIELD_ALIASES.managerName) || null,
      managerEmail,
      sourceFormat,
      valid: errors.length === 0,
      errors,
      warnings,
    };
  });

  const employeeCounts = new Map<string, number>();
  preliminary.forEach((row) => {
    if (row.employeeNumber) employeeCounts.set(row.employeeNumber, (employeeCounts.get(row.employeeNumber) ?? 0) + 1);
  });

  const emailCounts = new Map<string, number>();
  const uniqueEmployeesForEmail = new Set<string>();
  preliminary.forEach((row) => {
    if (!row.employeeNumber || uniqueEmployeesForEmail.has(row.employeeNumber)) return;
    uniqueEmployeesForEmail.add(row.employeeNumber);
    if (row.institutionalEmail) emailCounts.set(row.institutionalEmail, (emailCounts.get(row.institutionalEmail) ?? 0) + 1);
  });

  const seenEmployees = new Set<string>();
  return preliminary.map((row) => {
    const errors = [...row.errors];
    const warnings = [...row.warnings];
    if (row.employeeNumber && (employeeCounts.get(row.employeeNumber) ?? 0) > 1) {
      if (seenEmployees.has(row.employeeNumber)) errors.push("Matrícula repetida; mantenha apenas um registro");
      else warnings.push("Matrícula repetida; registros posteriores serão ignorados");
      seenEmployees.add(row.employeeNumber);
    }
    if (row.institutionalEmail
      && !errors.some((error) => error.startsWith("Matrícula repetida"))
      && (emailCounts.get(row.institutionalEmail) ?? 0) > 1) {
      warnings.push("E-mail compartilhado entre matrículas");
    }
    return {
      ...row,
      valid: errors.length === 0,
      errors,
      warnings,
      emailEligibleForAccess: Boolean(
        row.institutionalEmail
        && emailCounts.get(row.institutionalEmail) === 1
        && errors.length === 0,
      ),
    };
  });
}

export function summarizePeopleImport(rows: PeopleImportRow[]): PeopleImportSummary {
  const duplicateEmployeeValues = new Set(
    rows.filter((row) => row.warnings.some((warning) => warning.startsWith("Matrícula repetida"))
      || row.errors.some((error) => error.startsWith("Matrícula repetida")))
      .map((row) => row.employeeNumber)
      .filter(Boolean),
  );
  const duplicateEmailValues = new Set(
    rows.filter((row) => row.warnings.includes("E-mail compartilhado entre matrículas"))
      .map((row) => row.institutionalEmail)
      .filter((email): email is string => Boolean(email)),
  );

  return {
    total: rows.length,
    valid: rows.filter((row) => row.valid).length,
    invalid: rows.filter((row) => !row.valid).length,
    active: rows.filter((row) => ACTIVE_STATUSES.has(normalizeToken(row.status))).length,
    missingEmail: rows.filter((row) => row.warnings.includes("E-mail institucional não informado")).length,
    invalidEmail: rows.filter((row) => row.warnings.includes("E-mail institucional inválido")).length,
    duplicateEmailRows: rows.filter((row) => row.warnings.includes("E-mail compartilhado entre matrículas")).length,
    duplicateEmails: duplicateEmailValues.size,
    duplicateEmployeeRows: rows.filter((row) => row.warnings.some((warning) => warning.startsWith("Matrícula repetida"))
      || row.errors.some((error) => error.startsWith("Matrícula repetida"))).length,
    duplicateEmployees: duplicateEmployeeValues.size,
    accessEligible: rows.filter((row) => row.emailEligibleForAccess).length,
  };
}
