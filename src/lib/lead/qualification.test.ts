import { describe, it, expect } from "vitest";
import {
  extractHighestIncome,
  extractLowestIncome,
  isQualifiedIncome,
  calculateQualificationScore,
  getScoreLabel,
  getScoreColor,
} from "./qualification";

describe("extractHighestIncome", () => {
  it("returns 0 for null/undefined/empty", () => {
    expect(extractHighestIncome(null)).toBe(0);
    expect(extractHighestIncome(undefined)).toBe(0);
    expect(extractHighestIncome("")).toBe(0);
  });

  it("returns 0 when no digits present", () => {
    expect(extractHighestIncome("não informado")).toBe(0);
  });

  it("strips dots used as thousands separator", () => {
    expect(extractHighestIncome("R$30.000")).toBe(30000);
    expect(extractHighestIncome("R$1.000.000")).toBe(1000000);
  });

  it("returns the highest of multiple values in a range string", () => {
    expect(extractHighestIncome("Entre R$10.000 e R$30.000")).toBe(30000);
    expect(extractHighestIncome("De R$5.000 até R$15.000")).toBe(15000);
  });

  it("handles 'Acima de' style", () => {
    expect(extractHighestIncome("Acima de R$1.000.000")).toBe(1000000);
  });

  it("handles 'Até' style", () => {
    expect(extractHighestIncome("Até R$2.000")).toBe(2000);
  });
});

describe("calculateQualificationScore", () => {
  const baseLocation = { city: "São Paulo", state: "SP" };

  it("returns 0 when all fields are null", () => {
    expect(
      calculateQualificationScore({
        monthly_income: null,
        how_found: null,
        city: null,
        state: null,
      })
    ).toBe(0);
  });

  it("score 50 when floor >= 1M", () => {
    const s = calculateQualificationScore({
      monthly_income: "Acima de R$1.000.000",
      how_found: null,
      city: null,
      state: null,
    });
    expect(s).toBe(50);
  });

  it("score 45 when floor >= 100k and < 1M", () => {
    const s = calculateQualificationScore({
      monthly_income: "Entre R$100.000 e R$500.000",
      how_found: null,
      city: null,
      state: null,
    });
    expect(s).toBe(45);
  });

  it("score 35 when floor >= 30k and < 100k (qualified threshold)", () => {
    // Piso em 30k, teto em 100k → qualificado
    const s = calculateQualificationScore({
      monthly_income: "Entre R$30.000 e R$100.000",
      how_found: null,
      city: null,
      state: null,
    });
    expect(s).toBe(35);
  });

  it("score 5 for 'R$15.000 - R$30.000' (piso 15k, NÃO qualifica)", () => {
    // Regressão: antes o teto batia 30k e inflava para 35 pts falsamente.
    const s = calculateQualificationScore({
      monthly_income: "R$ 15.000 - R$ 30.000",
      how_found: null,
      city: null,
      state: null,
    });
    expect(s).toBe(5);
  });

  it("score 5 for income below 15k (not qualified)", () => {
    const s = calculateQualificationScore({
      monthly_income: "Até R$10.000",
      how_found: null,
      city: null,
      state: null,
    });
    expect(s).toBe(5);
  });

  it("source instagram adds 30", () => {
    const s = calculateQualificationScore({
      monthly_income: null,
      how_found: "instagram",
      city: null,
      state: null,
    });
    expect(s).toBe(30);
  });

  it("source unknown adds 0", () => {
    const s = calculateQualificationScore({
      monthly_income: null,
      how_found: "telegrama",
      city: null,
      state: null,
    });
    expect(s).toBe(0);
  });

  it("city + state add 10 each", () => {
    const s = calculateQualificationScore({
      monthly_income: null,
      how_found: null,
      ...baseLocation,
    });
    expect(s).toBe(20);
  });

  it("composes additively (real qualified lead)", () => {
    // 35 (piso 30k) + 30 (instagram) + 10 (city) + 10 (state) = 85
    const s = calculateQualificationScore({
      monthly_income: "Entre R$30.000 e R$100.000",
      how_found: "instagram",
      ...baseLocation,
    });
    expect(s).toBe(85);
  });

  it("max realistic score is 100 (50 + 30 + 10 + 10)", () => {
    const s = calculateQualificationScore({
      monthly_income: "Acima de R$1.000.000",
      how_found: "instagram",
      ...baseLocation,
    });
    expect(s).toBe(100);
  });
});

describe("extractLowestIncome", () => {
  it("returns 0 for null/undefined/empty", () => {
    expect(extractLowestIncome(null)).toBe(0);
    expect(extractLowestIncome(undefined)).toBe(0);
    expect(extractLowestIncome("")).toBe(0);
  });

  it("returns the MIN of a range", () => {
    expect(extractLowestIncome("R$ 15.000 - R$ 30.000")).toBe(15000);
    expect(extractLowestIncome("Entre R$30.000 e R$100.000")).toBe(30000);
    expect(extractLowestIncome("R$ 250.000 - R$ 500.000")).toBe(250000);
  });

  it("returns the only value for single-point strings", () => {
    expect(extractLowestIncome("Acima de R$1.000.000")).toBe(1000000);
    expect(extractLowestIncome("Até R$10.000")).toBe(10000);
  });
});

describe("isQualifiedIncome (regra: piso >= 30k)", () => {
  it.each([
    ["Até R$ 15.000", false],
    ["R$ 15.000 - R$ 30.000", false], // regressão crítica
    ["R$ 30.000 - R$ 100.000", true],
    ["R$ 100.000 - R$ 250.000", true],
    ["R$ 250.000 - R$ 500.000", true],
    ["R$ 500.000 - R$ 1.000.000", true],
    ["Acima de R$ 1.000.000", true],
    [null, false],
    [undefined, false],
    ["", false],
  ])("%s → %s", (input, expected) => {
    expect(isQualifiedIncome(input as string | null | undefined)).toBe(expected);
  });

  it("handles INCOME_OPTIONS value format (with underscores)", () => {
    // Se algum caller passar o VALUE bruto "15000_30000", a função lê
    // 15000 e 30000 como dois números e retorna piso = 15000 → não qualifica.
    expect(isQualifiedIncome("15000_30000")).toBe(false);
    expect(isQualifiedIncome("30000_100000")).toBe(true);
  });
});

describe("getScoreLabel", () => {
  it("Quente >= 80", () => {
    expect(getScoreLabel(80)).toBe("Quente");
    expect(getScoreLabel(100)).toBe("Quente");
  });
  it("Morno >= 50 e < 80", () => {
    expect(getScoreLabel(50)).toBe("Morno");
    expect(getScoreLabel(79)).toBe("Morno");
  });
  it("Frio < 50", () => {
    expect(getScoreLabel(49)).toBe("Frio");
    expect(getScoreLabel(0)).toBe("Frio");
  });
});

describe("getScoreColor", () => {
  it("aligns with label thresholds", () => {
    expect(getScoreColor(80)).toBe("text-success");
    expect(getScoreColor(50)).toBe("text-warning");
    expect(getScoreColor(49)).toBe("text-navy-50");
  });
});
