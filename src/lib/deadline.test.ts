import { describe, expect, it } from "vitest";
import { deadlineLabel, deadlineStatus } from "./deadline";

const now = new Date("2026-08-11T13:00:00Z");

describe("deadline", () => {
  it("não conta quando não há prazo", () => {
    expect(deadlineStatus(null, now)).toEqual({ state: "none" });
    expect(deadlineStatus("data-invalida", now)).toEqual({ state: "none" });
    expect(deadlineLabel({ state: "none" })).toBeNull();
  });

  it("marca como encerrada quando o instante já passou", () => {
    expect(deadlineStatus("2026-08-10T13:00:00Z", now)).toEqual({ state: "expired" });
    expect(deadlineLabel({ state: "expired" })).toBe("Encerrada");
  });

  it("marca 'encerra hoje' quando fecha no mesmo dia", () => {
    expect(deadlineStatus("2026-08-11T20:00:00Z", now)).toEqual({ state: "today" });
    expect(deadlineLabel({ state: "today" })).toBe("Encerra hoje");
  });

  it("conta os dias restantes por dia de calendário", () => {
    expect(deadlineStatus("2026-08-12T20:00:00Z", now)).toEqual({ state: "counting", days: 1 });
    expect(deadlineStatus("2026-08-29T20:00:00Z", now)).toEqual({ state: "counting", days: 18 });
  });

  it("usa singular para um dia", () => {
    expect(deadlineLabel({ state: "counting", days: 1 })).toBe("Falta 1 dia");
    expect(deadlineLabel({ state: "counting", days: 18 })).toBe("Faltam 18 dias");
  });
});
