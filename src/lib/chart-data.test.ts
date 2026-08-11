import { describe, expect, it } from "vitest";
import {
  average,
  groupEventsByDay,
  radarPolygon,
  toDistributionBars,
} from "./chart-data";

describe("chart-data", () => {
  describe("average", () => {
    it("ignora valores nulos e devolve null sem números", () => {
      expect(average([])).toBeNull();
      expect(average([null, undefined])).toBeNull();
      expect(average([2, null, 4])).toBe(3);
    });
  });

  describe("groupEventsByDay", () => {
    it("devolve vazio quando não há eventos (gráfico sem dados)", () => {
      expect(groupEventsByDay([])).toEqual([]);
    });

    it("agrupa por dia, ordena e descarta datas inválidas", () => {
      const points = groupEventsByDay([
        { submittedAt: "2026-08-02T10:00:00Z" },
        { submittedAt: "2026-08-01T09:00:00Z" },
        { submittedAt: "2026-08-02T15:00:00Z" },
        { submittedAt: "data-invalida" },
      ]);
      expect(points.map((point) => point.value)).toEqual([1, 2]);
      expect(points).toHaveLength(2);
    });

    it("mantém apenas os últimos dias conforme o limite", () => {
      const events = Array.from({ length: 20 }, (_, index) => ({
        submittedAt: `2026-08-${String(index + 1).padStart(2, "0")}T12:00:00Z`,
      }));
      expect(groupEventsByDay(events, { limit: 5 })).toHaveLength(5);
    });
  });

  describe("toDistributionBars", () => {
    it("resolve percentuais como 0 quando não há respostas", () => {
      const bars = toDistributionBars([
        { id: "a", label: "Sim", count: 0 },
        { id: "b", label: "Não", count: 0 },
      ]);
      expect(bars.every((bar) => bar.percentage === 0)).toBe(true);
    });

    it("calcula percentuais preservando a ordem (avaliação diferente)", () => {
      const bars = toDistributionBars([
        { id: "a", label: "Concordo", count: 3 },
        { id: "b", label: "Discordo", count: 1 },
      ]);
      expect(bars.map((bar) => bar.percentage)).toEqual([75, 25]);
      expect(bars.map((bar) => bar.label)).toEqual(["Concordo", "Discordo"]);
    });
  });

  describe("radarPolygon", () => {
    it("não quebra com escala zero nem sem valores", () => {
      expect(radarPolygon([], { max: 0, radius: 100, center: 160 })).toBe("");
      expect(() => radarPolygon([3, 4], { max: 0, radius: 100, center: 160 })).not.toThrow();
    });

    it("gera um ponto por valor recebido", () => {
      const polygon = radarPolygon([5, 5, 5], { max: 5, radius: 100, center: 160 });
      expect(polygon.split(" ")).toHaveLength(3);
    });
  });
});
