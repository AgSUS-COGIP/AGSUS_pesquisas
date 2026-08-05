import { describe, expect, it } from "vitest";
import { parsePeopleImportRows, summarizePeopleImport } from "./people-import";

describe("parsePeopleImportRows", () => {
  it("maps the AgSUS institutional semantic column prefixes", () => {
    const [row] = parsePeopleImportRows([{
      NU_MATRICULA: "123",
      NO_NOME: "Ana Souza",
      DT_ADMISSAO: "13/02/2026",
      DS_CARGO_ATUAL: "Analista",
      DS_UNIDADE_ORCAMENTARIA: "Diretoria A",
      DS_DIVISAO: "Divisão B",
      DS_SUBDIVISAO: "Unidade C",
      SG_COORDENACAO: "Coordenação D",
      DS_EMAIL_INSTUCIONAL: "ANA.SOUZA@AGENCIASUS.ORG.BR",
      NO_GESTOR: "Gestora Exemplo",
      DS_EMAIL_INSTITUCIONAL_GESTOR: "gestora@agenciasus.org.br",
    }]);

    expect(row).toMatchObject({
      employeeNumber: "123",
      fullName: "Ana Souza",
      admissionDate: "2026-02-13",
      jobTitle: "Analista",
      costCenter: "Diretoria A",
      directorate: "Divisão B",
      unit: "Unidade C",
      coordination: "Coordenação D",
      institutionalEmail: "ana.souza@agenciasus.org.br",
      managerName: "Gestora Exemplo",
      managerEmail: "gestora@agenciasus.org.br",
      sourceFormat: "CDDI_BASE_COMPILADO",
      valid: true,
      emailEligibleForAccess: true,
    });
  });

  it("accepts dates reformatted by the CSV reader", () => {
    const rows = parsePeopleImportRows([
      { NU_MATRICULA: "7", NO_NOME: "Pessoa Um", DT_ADMISSAO: "4/4/22" },
      { NU_MATRICULA: "12", NO_NOME: "Pessoa Dois", DT_ADMISSAO: "4/7/22" },
    ]);

    expect(rows.map((row) => row.admissionDate)).toEqual(["2022-04-04", "2022-04-07"]);
    expect(rows.flatMap((row) => row.warnings)).not.toContain("Data de admissão inválida");
  });

  it("keeps backward compatibility with the compiled CDDI headers without importing CPF", () => {
    const [row] = parsePeopleImportRows([{
      MATRICULA: "123",
      CPF: "00000000000",
      NOME: "Ana Souza",
      DATA_ADMISSAO: "13/02/2026",
      CARGO_ATUAL_DESC: "Analista",
      UNIDADE_ORCAMENTARIA_DESC: "Diretoria A",
      DIVISAO_DESC: "Divisão B",
      SUBDIVISAO_DESC: "Unidade C",
      "Coordenação utilizada": "Coordenação D",
      "E-MAIL_INSTUCIONAL": "ANA.SOUZA@AGENCIASUS.ORG.BR",
      "Nome Gestor/Coordenador": "Gestora Exemplo",
      "E-mail Gestor": "gestora@agenciasus.org.br",
    }]);

    expect(row).toMatchObject({
      employeeNumber: "123",
      fullName: "Ana Souza",
      admissionDate: "2026-02-13",
      jobTitle: "Analista",
      costCenter: "Diretoria A",
      directorate: "Divisão B",
      unit: "Unidade C",
      coordination: "Coordenação D",
      institutionalEmail: "ana.souza@agenciasus.org.br",
      managerName: "Gestora Exemplo",
      sourceFormat: "CDDI_BASE_COMPILADO",
      valid: true,
      emailEligibleForAccess: true,
    });
    expect(row).not.toHaveProperty("cpf");
  });

  it("keeps people without valid email but does not activate their access identity", () => {
    const rows = parsePeopleImportRows([
      { NU_MATRICULA: "1", NO_NOME: "Sem Email", DS_EMAIL_INSTUCIONAL: "" },
      { NU_MATRICULA: "2", NO_NOME: "Email Inválido", DS_EMAIL_INSTUCIONAL: "dois emails" },
    ]);

    expect(rows.every((row) => row.valid)).toBe(true);
    expect(rows.every((row) => !row.emailEligibleForAccess)).toBe(true);
    expect(summarizePeopleImport(rows)).toMatchObject({ missingEmail: 1, invalidEmail: 1, valid: 2 });
  });

  it("rejects only later duplicate employee rows and blocks shared emails from automatic access", () => {
    const rows = parsePeopleImportRows([
      { NU_MATRICULA: "1", NO_NOME: "Pessoa Um", DS_EMAIL_INSTUCIONAL: "compartilhado@agenciasus.org.br" },
      { NU_MATRICULA: "2", NO_NOME: "Pessoa Dois", DS_EMAIL_INSTUCIONAL: "compartilhado@agenciasus.org.br" },
      { NU_MATRICULA: "2", NO_NOME: "Pessoa Dois", DS_EMAIL_INSTUCIONAL: "compartilhado@agenciasus.org.br" },
    ]);

    expect(rows.map((row) => row.valid)).toEqual([true, true, false]);
    expect(rows.filter((row) => row.emailEligibleForAccess)).toHaveLength(0);
    expect(summarizePeopleImport(rows)).toMatchObject({
      duplicateEmails: 1,
      duplicateEmailRows: 2,
      duplicateEmployees: 1,
      duplicateEmployeeRows: 2,
      invalid: 1,
    });
  });
});
