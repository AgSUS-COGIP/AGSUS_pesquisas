import { describe, expect, it } from "vitest";
import {
  EMAIL_SENDER,
  getEmailConfigurationStatus,
  participantSiteUrl,
  smtpCredentials,
} from "./email";

describe("configuração de e-mail", () => {
  it("informa todas as variáveis ausentes sem expor valores", () => {
    expect(getEmailConfigurationStatus({})).toEqual({
      configured: false,
      hasAppPassword: false,
      hasSiteUrl: false,
      missingVariables: ["SMTP_APP_PASSWORD", "NEXT_PUBLIC_SITE_URL"],
    });
  });

  it("considera a configuração completa quando senha e URL existem", () => {
    expect(getEmailConfigurationStatus({
      SMTP_APP_PASSWORD: "senha",
      NEXT_PUBLIC_SITE_URL: "https://pesquisas.example.org",
    }).configured).toBe(true);
  });

  it("recusa endereço público que não seja uma URL HTTP válida", () => {
    const status = getEmailConfigurationStatus({
      SMTP_APP_PASSWORD: "senha",
      NEXT_PUBLIC_SITE_URL: "agsus-pesquisas-nu.vercel.app",
    });

    expect(status.hasSiteUrl).toBe(false);
    expect(status.missingVariables).toContain("NEXT_PUBLIC_SITE_URL");
  });

  it("normaliza busca, fragmento e caracteres especiais da URL pública", () => {
    expect(participantSiteUrl({
      NEXT_PUBLIC_SITE_URL: 'https://pesquisas.example.org/base/"?origem=painel#topo',
    })).toBe("https://pesquisas.example.org/base/%22");
  });

  it("normaliza os valores copiados do painel do Google e da Vercel", () => {
    const environment = {
      SMTP_USER: "  caixa@example.org  ",
      SMTP_APP_PASSWORD: "abcd efgh ijkl mnop",
      NEXT_PUBLIC_SITE_URL: "  https://pesquisas.example.org  ",
    };

    expect(smtpCredentials(environment)).toEqual({
      user: "caixa@example.org",
      pass: "abcdefghijklmnop",
    });
    expect(participantSiteUrl(environment)).toBe("https://pesquisas.example.org");
  });

  it("usa a caixa remetente quando SMTP_USER não foi definido", () => {
    expect(smtpCredentials({ SMTP_APP_PASSWORD: "senha" }).user).toBe(EMAIL_SENDER.address);
  });
});
