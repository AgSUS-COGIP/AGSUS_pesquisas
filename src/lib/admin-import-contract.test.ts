import { describe, expect, it } from "vitest";
import { parseAdminImportRequest } from "./admin-import-contract";

function validRow() {
  return {
    rowNumber: 2,
    status: "ATIVO",
    detailedStatus: "",
    fullName: "Pessoa Teste",
    employeeNumber: "TESTE-001",
    jobTitle: "Analista",
    costCenter: "Centro",
    directorate: "Diretoria",
    unit: "Unidade",
    coordination: "Coordenação",
    institutionalEmail: "pessoa.teste@agenciasus.org.br",
    workplace: "Unidade",
    accessProfile: "PARTICIPANTE",
    participates: true,
    participantKey: "TESTE-001",
    emailEligibleForAccess: true,
    admissionDate: "2026-01-10",
    managerName: null,
    managerEmail: null,
    sourceFormat: "STANDARD_PEOPLE_BASE" as const,
    valid: true as const,
    errors: [],
    warnings: [],
  };
}

function validRequest() {
  return {
    fileName: "base.csv",
    totalRows: 1,
    isFirstChunk: true,
    isLastChunk: true,
    rows: [validRow()],
    issueCounts: {
      missingEmail: 0,
      invalidEmail: 0,
      duplicateEmail: 0,
      duplicateEmployee: 0,
      invalidRows: 0,
    },
  };
}

describe("adminImportRequestSchema", () => {
  it("aceita um lote inicial válido", () => {
    expect(parseAdminImportRequest(validRequest()).success).toBe(true);
  });

  it("rejeita lote posterior sem batchId", () => {
    const result = parseAdminImportRequest({
      ...validRequest(),
      isFirstChunk: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejeita linhas marcadas como inválidas pelo navegador", () => {
    const result = parseAdminImportRequest({
      ...validRequest(),
      rows: [{ ...validRow(), valid: false, errors: ["Linha inválida"] }],
    });
    expect(result.success).toBe(false);
  });

  it("rejeita totais acima do limite institucional", () => {
    const result = parseAdminImportRequest({
      ...validRequest(),
      totalRows: 50_001,
    });
    expect(result.success).toBe(false);
  });

  it("rejeita propriedades inesperadas", () => {
    const result = parseAdminImportRequest({
      ...validRequest(),
      serviceRoleKey: "não deve ser aceito",
    });
    expect(result.success).toBe(false);
  });
});
