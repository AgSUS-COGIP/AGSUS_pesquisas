import { describe, expect, it } from "vitest";
import { participantEmailContent, surveyResponseUrl, type ParticipantEmailPayload } from "./participant-emails";

const basePayload: ParticipantEmailPayload = {
  kind: "research_opened",
  personName: "Maria da Silva",
  applicationName: "Clima Organizacional 2026",
  applicationCode: "CLIMA-2026",
  surveyCode: "CLIMA",
  closesAt: "2026-09-01T20:59:00.000Z",
};

describe("surveyResponseUrl", () => {
  it("monta o link do runtime genérico pelo código do ciclo", () => {
    expect(surveyResponseUrl("https://pesquisas.agsus.org.br", basePayload))
      .toBe("https://pesquisas.agsus.org.br/pesquisas/CLIMA-2026");
  });

  it("respeita a jornada própria do CDDI", () => {
    expect(surveyResponseUrl("https://pesquisas.agsus.org.br", { surveyCode: "CDDI", applicationCode: "CDDI-2026" }))
      .toBe("https://pesquisas.agsus.org.br/cddi");
  });

  it("não duplica a barra quando o endereço do site termina em /", () => {
    expect(surveyResponseUrl("https://pesquisas.agsus.org.br/", basePayload))
      .toBe("https://pesquisas.agsus.org.br/pesquisas/CLIMA-2026");
  });

  it("codifica código de ciclo com caracteres reservados", () => {
    expect(surveyResponseUrl("https://x.org", { surveyCode: "Q", applicationCode: "A/B 1" }))
      .toBe("https://x.org/pesquisas/A%2FB%201");
  });
});

describe("participantEmailContent — abertura", () => {
  const url = surveyResponseUrl("https://pesquisas.agsus.org.br", basePayload);
  const content = participantEmailContent(basePayload, url);

  it("nomeia a avaliação no assunto", () => {
    expect(content.subject).toBe("Avaliação aberta para resposta: Clima Organizacional 2026");
  });

  it("traz nome da pessoa, avaliação, link e prazo no corpo", () => {
    for (const body of [content.html, content.text]) {
      expect(body).toContain("Maria da Silva");
      expect(body).toContain("Clima Organizacional 2026");
      expect(body).toContain(url);
    }
    // Prazo no fuso de São Paulo, por extenso — 20:59 UTC = 17:59 locais.
    expect(content.text).toContain("17:59");
  });

  it("omite a linha de prazo quando o ciclo não tem encerramento", () => {
    const withoutDeadline = participantEmailContent({ ...basePayload, closesAt: null }, url);
    expect(withoutDeadline.text).not.toContain("até");
    expect(withoutDeadline.html).not.toContain("Você pode responder até");
  });

  it("escapa HTML vindo dos dados da pesquisa", () => {
    const hostile = participantEmailContent(
      { ...basePayload, applicationName: 'Pesquisa <script>alert("x")</script>' },
      url,
    );
    expect(hostile.html).not.toContain("<script>");
    expect(hostile.html).toContain("&lt;script&gt;");
  });
});

describe("participantEmailContent — lembrete de 24 horas", () => {
  const payload: ParticipantEmailPayload = { ...basePayload, kind: "research_expiring_24h" };
  const url = surveyResponseUrl("https://pesquisas.agsus.org.br", payload);
  const content = participantEmailContent(payload, url);

  it("avisa das 24 horas no assunto", () => {
    expect(content.subject).toBe("Últimas 24 horas para responder: Clima Organizacional 2026");
  });

  it("traz avaliação, link e o momento do encerramento", () => {
    for (const body of [content.html, content.text]) {
      expect(body).toContain("Clima Organizacional 2026");
      expect(body).toContain(url);
      expect(body).toContain("24 horas");
    }
    expect(content.text).toContain("O prazo termina em");
    expect(content.text).toContain("17:59");
  });
});
