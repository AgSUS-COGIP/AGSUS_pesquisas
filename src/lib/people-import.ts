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
  employeeNumber: ["NU_MATRICULA", "MATRICULA", "MATRÍCULA"],
  fullName: ["NO_NOME", "NOME"],
  status: ["ST_STATUS", "STATUS"],
  detailedStatus: ["DS_SITUACAO_DETALHADA", "SITUACAO DETALHADA", "SITUAÇÃO DETALHADA"],
  jobTitle: ["DS_CARGO_ATUAL", "CARGO ATUAL", "CARGO ATUAL DESC", "CARGO_ATUAL_DESC"],
  costCenter: [
    "DS_UNIDADE_ORCAMENTARIA",
    "CENTRO DE CUSTO",
    "UNIDADE ORCAMENTARIA DESC",
    "UNIDADE_ORCAMENTARIA_DESC",
  ],
  directorate: ["DS_DIVISAO", "DIRETORIA", "DIVISAO DESC", "DIVISAO_DESC"],
  unit: ["DS_SUBDIVISAO", "UNIDADE", "SUBDIVISAO DESC", "SUBDIVISAO_DESC"],
  coordination: [
    "SG_COORDENACAO",
    "NO_COORDENACAO",
    "COORDENACAO",
    "COORDENAÇÃO",
    "COORDENACAO UTILIZADA",
    "COORDENAÇÃO UTILIZADA",
  ],
  coordinationFallback: ["PLANILHA FELIPE", "DIMENSIONAMENTO"],
  institutionalEmail: [
    "DS_EMAIL_INSTITUCIONAL",
    "DS_EMAIL_INSTUCIONAL",
    "E MAIL INSTITUCIONAL",
    "EMAIL INSTITUCIONAL",
    "E-MAIL INSTITUCIONAL",
    "E-MAIL_INSTUCIONAL",
    "E MAIL INSTUCIONAL",
    "EMAIL INSTUCIONAL",
  ],
  workplace: ["DS_LOCAL_TRABALHO", "LOCAL DE TRABALHO"],
  accessProfile: ["TP_PERFIL_ACESSO", "PERFIL DE ACESSO"],
  participates: ["ST_PARTICIPA_CICLO", "PARTICIPA DO CICLO"],
  participantKey: ["CO_CHAVE_PARTICIPANTE", "CHAVE PARTICIPANTE"],
  admissionDate: ["DT_ADMISSAO", "DATA ADMISSAO", "DATA ADMISSÃO", "DATA_ADMISSAO"],
  managerName: [
    "NO_GESTOR",
    "NO_GESTOR_COORDENADOR",
    "NOME GESTOR COORDENADOR",
    "NOME GESTOR/COORDENADOR",
  ],
  managerEmail: [
    "DS_EMAIL_INSTITUCIONAL_GESTOR",
    "DS_EMAIL_GESTOR",
    "E MAIL GESTOR",
    "EMAIL GESTOR",
    "E-MAIL GESTOR",
  ],
} as const;

function text(value: unknown) {
  return String(value ?? "").trim();
}

// Reduz um cabeçalho a uma chave comparável: remove acentos, força maiúsculas e
// colapsa qualquer separador em espaço. Assim "Matrícula", "MATRICULA" e
// "NU_MATRICULA" colidem no mesmo token e um único alias atende às três grafias
// encontradas nas planilhas oficiais.
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

function validIsoDate(year: string, month: string, day: string) {
  const iso = `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso ? null : iso;
}

function normalizeDate(value: string) {
  const raw = value.trim();
  if (!raw) return null;

  const brazilian = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  if (brazilian) {
    const [, day, month, year] = brazilian;
    return validIsoDate(year, month, day);
  }

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) {
    const [, year, month, day] = iso;
    return validIsoDate(year, month, day);
  }

  // SheetJS pode reinterpretar datas ambíguas de CSV como formato norte-americano
  // e devolvê-las sem zeros à esquerda e com ano de dois dígitos (ex.: 4/7/22).
  const sheetJsShort = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/.exec(raw);
  if (sheetJsShort) {
    const [, month, day, shortYear] = sheetJsShort;
    const numericYear = Number(shortYear);
    const year = String(numericYear >= 70 ? 1900 + numericYear : 2000 + numericYear);
    return validIsoDate(year, month, day);
  }

  const sheetJsLong = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (sheetJsLong) {
    const [, month, day, year] = sheetJsLong;
    return validIsoDate(year, month, day);
  }

  return null;
}

function detectSourceFormat(headers: string[]): PeopleImportRow["sourceFormat"] {
  const normalizedHeaders = new Set(headers.map(normalizeToken));
  return normalizedHeaders.has(normalizeToken("NU_MATRICULA"))
    || normalizedHeaders.has(normalizeToken("NO_NOME"))
    || normalizedHeaders.has(normalizeToken("DS_CARGO_ATUAL"))
    || normalizedHeaders.has(normalizeToken("DS_EMAIL_INSTUCIONAL"))
    || normalizedHeaders.has(normalizeToken("CARGO_ATUAL_DESC"))
    || normalizedHeaders.has(normalizeToken("E-MAIL_INSTUCIONAL"))
    ? "CDDI_BASE_COMPILADO"
    : "STANDARD_PEOPLE_BASE";
}

/**
 * Converte as linhas cruas de uma planilha institucional em registros validados.
 *
 * Executa duas passagens porque as regras de duplicidade são relacionais:
 *
 * 1. **Por linha** — resolve aliases de cabeçalho, normaliza e-mail e data, e
 *    separa problemas em *erro* (bloqueia a linha: matrícula ou nome ausentes) e
 *    *aviso* (preserva a pessoa: e-mail ausente, inválido, data inválida).
 * 2. **Entre linhas** — detecta matrícula repetida e e-mail compartilhado, e
 *    decide quem fica elegível a identidade de acesso automática.
 *
 * Nenhuma linha é descartada: quem chama decide o que enviar usando `valid`.
 */
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
      // +2 porque a linha 1 da planilha é o cabeçalho e o operador precisa
      // localizar a linha exata na ferramenta que usou.
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

  // Conta e-mails por matrícula distinta, não por linha: uma matrícula repetida
  // duas vezes não deve fazer o e-mail dela parecer compartilhado.
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
    // Matrícula repetida: a primeira ocorrência recebe aviso e é importada; as
    // seguintes recebem erro e são rejeitadas. Assim a pessoa entra na base uma
    // única vez, sem exigir que o operador limpe a planilha antes.
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
      // Regra institucional: e-mail só se torna identidade de acesso quando é
      // válido, exclusivo de uma matrícula e a linha não tem erro. A base oficial
      // contém endereços compartilhados entre matrículas distintas, e ativá-los
      // daria a uma pessoa acesso ao cadastro de outra.
      // Ver docs/auditoria-base-cddi-2026.md.
      emailEligibleForAccess: Boolean(
        row.institutionalEmail
        && emailCounts.get(row.institutionalEmail) === 1
        && errors.length === 0,
      ),
    };
  });
}

/**
 * Agrega o retrato da planilha exibido antes da confirmação da carga.
 *
 * As categorias são identificadas pelo texto exato dos avisos produzidos por
 * {@link parsePeopleImportRows}; alterar uma dessas mensagens exige atualizar
 * também `src/app/api/admin/import-participants/route.ts`, que deriva os códigos
 * de `data_import_issues` a partir dos mesmos literais.
 */
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
