import { describe, expect, it } from "vitest";
import { brasiliaHour, timeGreeting } from "./greeting";

/** Constrói um instante UTC. Brasília está 3 horas atrás (UTC-3). */
function utc(hora: number, minuto = 0) {
  return new Date(Date.UTC(2026, 7, 14, hora, minuto));
}

describe("brasiliaHour", () => {
  it("converte de UTC para o horário de Brasília", () => {
    expect(brasiliaHour(utc(12))).toBe(9);
    expect(brasiliaHour(utc(0))).toBe(21);
  });

  it("devolve 0 na meia-noite, não 24", () => {
    // `hour12: false` devolve "24" em algumas implementações. Sem o ajuste,
    // 00h05 cairia na faixa da noite por acidente.
    expect(brasiliaHour(utc(3))).toBe(0);
    expect(brasiliaHour(utc(3, 5))).toBe(0);
  });
});

describe("timeGreeting", () => {
  it("cumprimenta pela manhã até 11h59", () => {
    expect(timeGreeting(utc(11))).toBe("Bom dia");   // 08h
    expect(timeGreeting(utc(14, 59))).toBe("Bom dia"); // 11h59
  });

  it("vira tarde exatamente ao meio-dia", () => {
    expect(timeGreeting(utc(15))).toBe("Boa tarde"); // 12h00
    expect(timeGreeting(utc(20, 59))).toBe("Boa tarde"); // 17h59
  });

  it("vira noite exatamente às 18h", () => {
    expect(timeGreeting(utc(21))).toBe("Boa noite"); // 18h00
    expect(timeGreeting(utc(2, 59))).toBe("Boa noite"); // 23h59
  });

  it("trata a madrugada como bom dia", () => {
    // Quem entra às 2h está começando alguma coisa; "boa madrugada" não é o que
    // se diz num sistema de trabalho.
    expect(timeGreeting(utc(3))).toBe("Bom dia");  // 00h
    expect(timeGreeting(utc(8))).toBe("Bom dia");  // 05h
  });

  it("usa o fuso de Brasília, não o da máquina", () => {
    // 23h UTC é 20h em Brasília: noite nos dois casos só por coincidência.
    // O que este teste fixa é 02h UTC — 23h de Brasília, ainda noite, embora
    // já seja o dia seguinte em UTC.
    expect(timeGreeting(utc(2))).toBe("Boa noite");
  });
});
