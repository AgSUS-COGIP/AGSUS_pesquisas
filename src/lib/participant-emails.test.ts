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
    // A frase inteira, e não a palavra "até": textos configuráveis também
    // entram no corpo, e casar por palavra solta quebraria a cada ajuste deles.
    expect(withoutDeadline.text).not.toContain("Você pode responder até");
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

  it("remove quebras de linha do assunto", () => {
    const contentWithHeaderBreak = participantEmailContent(
      { ...basePayload, applicationName: "Pesquisa\r\nBcc: externo@example.org" },
      url,
    );

    expect(contentWithHeaderBreak.subject).toBe(
      "Avaliação aberta para resposta: Pesquisa Bcc: externo@example.org",
    );
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

  it("não repete a descrição da avaliação — aqui o assunto é o prazo", () => {
    const comDescricao = participantEmailContent(
      { ...payload, surveyDescription: "Instrumento anual de clima." },
      url,
    );
    expect(comDescricao.html).not.toContain("Sobre esta avaliação");
    expect(comDescricao.text).not.toContain("Instrumento anual de clima.");
  });

  it("mantém a instrução de acesso: quem não respondeu pode não saber entrar", () => {
    expect(content.text).toContain("conta institucional do Google");
  });
});

describe("participantEmailContent — lembrete dirigido", () => {
  const payload: ParticipantEmailPayload = {
    ...basePayload,
    kind: "manual_reminder",
    surveyDescription: "Instrumento anual de clima.",
  };
  const url = surveyResponseUrl("https://pesquisas.agsus.org.br", payload);
  const content = participantEmailContent(payload, url);

  it("não se anuncia como abertura nem como prazo final", () => {
    expect(content.subject).toBe("Lembrete: Clima Organizacional 2026 está aberta para resposta");
    expect(content.subject).not.toContain("24 horas");
  });

  it("repete o contexto inteiro: quem recebe pode não ter visto o primeiro e-mail", () => {
    for (const body of [content.html, content.text]) {
      expect(body).toContain("Clima Organizacional 2026");
      expect(body).toContain("Instrumento anual de clima.");
      expect(body).toContain("conta institucional do Google");
      expect(body).toContain(url);
    }
  });

  it("diz que a resposta ainda não foi registrada", () => {
    expect(content.text).toContain("ainda não foi registrada");
  });
});

describe("participantEmailContent — textos configuráveis", () => {
  const url = surveyResponseUrl("https://pesquisas.agsus.org.br", basePayload);

  it("sem configuração, identifica o sistema e explica como acessar", () => {
    const content = participantEmailContent(basePayload, url);
    for (const body of [content.html, content.text]) {
      expect(body).toContain("SIGAV");
      expect(body).toContain("AgSUS");
      expect(body).toContain("conta institucional do Google");
    }
  });

  it("usa a descrição da avaliação quando o ciclo tem uma", () => {
    const content = participantEmailContent(
      { ...basePayload, surveyDescription: "Mede o clima organizacional das equipes." },
      url,
    );
    expect(content.html).toContain("Sobre esta avaliação");
    expect(content.html).toContain("Mede o clima organizacional das equipes.");
    expect(content.text).toContain("Sobre esta avaliação: Mede o clima organizacional das equipes.");
  });

  it("omite o bloco de descrição quando o ciclo não tem uma", () => {
    expect(participantEmailContent(basePayload, url).html).not.toContain("Sobre esta avaliação");
  });

  it("respeita instrução, rodapé e nomes configurados", () => {
    const content = participantEmailContent(
      {
        ...basePayload,
        organizationName: "Agência",
        productName: "SIGAV 2",
        emailInstruction: "Entre pelo portal interno.",
        emailFooter: "Dúvidas: ramal 200.",
      },
      url,
    );
    expect(content.html).toContain("SIGAV 2 · Agência");
    expect(content.text).toContain("Entre pelo portal interno.");
    expect(content.text).toContain("Dúvidas: ramal 200.");
    expect(content.text).not.toContain("conta institucional do Google");
  });

  it("texto configurado em branco cai no padrão, e nunca deixa o e-mail sem instrução", () => {
    const content = participantEmailContent(
      { ...basePayload, emailInstruction: "   ", emailFooter: "", productName: null },
      url,
    );
    expect(content.text).toContain("conta institucional do Google");
    expect(content.text).toContain("aviso automático do SIGAV");
  });

  it("escapa HTML também nos textos configuráveis", () => {
    const content = participantEmailContent(
      {
        ...basePayload,
        surveyDescription: '<img src=x onerror="alert(1)">',
        emailFooter: "<b>rodapé</b>",
        productName: "<i>P</i>",
      },
      url,
    );
    expect(content.html).not.toContain("<img");
    expect(content.html).not.toContain("<b>rodapé</b>");
    expect(content.html).not.toContain("<i>P</i>");
    expect(content.html).toContain("&lt;img");
  });
});
