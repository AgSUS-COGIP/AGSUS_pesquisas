import { describe, expect, it } from "vitest";
import { calculatePreSampleStatistics } from "./pre-sample-statistics";

describe("calculatePreSampleStatistics", () => {
  it("calcula indicadores e sedimentação para itens correlacionados", () => {
    const result = calculatePreSampleStatistics({
      items: ["a", "b", "c"].map((id) => ({ id, code: id, label: id })),
      rows: Array.from({ length: 20 }, (_, index) => ({ values: {
        a: index % 5 + 1,
        b: index % 5 + 1 + (index % 2 ? 0.1 : -0.1),
        c: index % 5 + 1 + (index % 3 ? 0.05 : -0.05),
      } })),
    });
    expect(result.cronbachAlpha).toBeGreaterThan(0.9);
    expect(result.omegaTotal).toBeGreaterThan(0.9);
    expect(result.kmo).not.toBeNull();
    expect(result.bartlett?.degreesOfFreedom).toBe(3);
    expect(result.scree).toHaveLength(3);
  });

  it("explica quando ainda não há dados suficientes", () => {
    const result = calculatePreSampleStatistics({ items: [], rows: [] });
    expect(result.cronbachAlpha).toBeNull();
    expect(result.warnings[0]).toContain("3 casos completos");
  });
});
