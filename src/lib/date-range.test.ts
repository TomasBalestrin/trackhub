import { describe, it, expect } from "vitest";
import {
  presetToRange,
  filterByDateRange,
  isoToDateInput,
  dateInputToIso,
  buildMonthGrid,
  isSameDay,
  type DateRange,
} from "./date-range";

// Usar uma data fixa para testes determinísticos (meio-dia local de 15/jan/2026)
const NOW = new Date(2026, 0, 15, 12, 0, 0);

describe("presetToRange", () => {
  it("today: start at midnight local, end at next midnight", () => {
    const r = presetToRange("today", "created_at", NOW);
    expect(isoToDateInput(r.start)).toBe("2026-01-15");
    expect(isoToDateInput(r.end)).toBe("2026-01-16");
  });

  it("yesterday: full previous day", () => {
    const r = presetToRange("yesterday", "created_at", NOW);
    expect(isoToDateInput(r.start)).toBe("2026-01-14");
    expect(isoToDateInput(r.end)).toBe("2026-01-15");
  });

  it("last_7d: rolling window ending at next midnight", () => {
    const r = presetToRange("last_7d", "created_at", NOW);
    expect(isoToDateInput(r.start)).toBe("2026-01-09"); // 15 - 6
    expect(isoToDateInput(r.end)).toBe("2026-01-16");
  });

  it("last_15d: 15 day rolling window", () => {
    const r = presetToRange("last_15d", "created_at", NOW);
    expect(isoToDateInput(r.start)).toBe("2026-01-01"); // 15 - 14
    expect(isoToDateInput(r.end)).toBe("2026-01-16");
  });

  it("last_30d: covers 30 full days", () => {
    const r = presetToRange("last_30d", "created_at", NOW);
    expect(isoToDateInput(r.start)).toBe("2025-12-17");
    expect(isoToDateInput(r.end)).toBe("2026-01-16");
  });

  it("last_90d (trimestral): 90 day window", () => {
    const r = presetToRange("last_90d", "created_at", NOW);
    expect(isoToDateInput(r.end)).toBe("2026-01-16");
    // 90 - 1 dia antes
    expect(isoToDateInput(r.start)).toBe("2025-10-18");
  });

  it("last_180d (semestral) and last_365d (12 meses) shape check", () => {
    const r180 = presetToRange("last_180d", "created_at", NOW);
    const r365 = presetToRange("last_365d", "created_at", NOW);
    expect(isoToDateInput(r180.end)).toBe("2026-01-16");
    expect(isoToDateInput(r365.end)).toBe("2026-01-16");
    // 180 dias antes do end exclusivo (16/01 2026): 20/07 2025
    expect(isoToDateInput(r180.start)).toBe("2025-07-20");
    expect(isoToDateInput(r365.start)).toBe("2025-01-16");
  });

  it("propagates the field choice", () => {
    const r = presetToRange("today", "lead_at", NOW);
    expect(r.field).toBe("lead_at");
  });
});

describe("filterByDateRange", () => {
  const rows: Array<{ id: string; created_at: string; lead_at: string | null }> = [
    { id: "a", created_at: "2026-01-10T10:00:00Z", lead_at: "2026-01-10T10:30:00Z" },
    { id: "b", created_at: "2026-01-12T10:00:00Z", lead_at: "2026-01-12T10:30:00Z" },
    { id: "c", created_at: "2026-01-15T10:00:00Z", lead_at: null },
    { id: "d", created_at: "2026-01-20T10:00:00Z", lead_at: "2026-01-20T10:30:00Z" },
  ];

  it("open range returns everything", () => {
    const r: DateRange = { start: null, end: null, field: "created_at" };
    expect(filterByDateRange(rows, r).map((x) => x.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("filters inclusive on start, exclusive on end", () => {
    const r: DateRange = {
      start: "2026-01-10T00:00:00Z",
      end: "2026-01-15T00:00:00Z",
      field: "created_at",
    };
    expect(filterByDateRange(rows, r).map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("excludes rows with null on the chosen field when any limit is set", () => {
    const r: DateRange = {
      start: "2026-01-01T00:00:00Z",
      end: "2026-01-31T00:00:00Z",
      field: "lead_at",
    };
    expect(filterByDateRange(rows, r).map((x) => x.id)).toEqual(["a", "b", "d"]);
  });

  it("uses the field specified in the range", () => {
    const r: DateRange = {
      start: "2026-01-15T00:00:00Z",
      end: "2026-01-16T00:00:00Z",
      field: "created_at",
    };
    expect(filterByDateRange(rows, r).map((x) => x.id)).toEqual(["c"]);
  });

  it("open-ended start still excludes later rows above end", () => {
    const r: DateRange = { start: null, end: "2026-01-15T00:00:00Z", field: "created_at" };
    expect(filterByDateRange(rows, r).map((x) => x.id)).toEqual(["a", "b"]);
  });
});

describe("buildMonthGrid", () => {
  it("returns exactly 42 days (6 weeks)", () => {
    expect(buildMonthGrid(2026, 3).length).toBe(42); // abril 2026
  });

  it("starts on a Sunday", () => {
    const grid = buildMonthGrid(2026, 3); // abr/2026
    expect(grid[0].getDay()).toBe(0);
  });

  it("includes all days of the target month", () => {
    const grid = buildMonthGrid(2026, 0); // jan/2026 (31 dias)
    const inMonth = grid.filter((d) => d.getMonth() === 0);
    expect(inMonth.length).toBe(31);
  });
});

describe("isSameDay", () => {
  it("ignores time component", () => {
    const a = new Date(2026, 3, 13, 8, 0);
    const b = new Date(2026, 3, 13, 23, 59);
    expect(isSameDay(a, b)).toBe(true);
  });

  it("detects different days", () => {
    expect(isSameDay(new Date(2026, 3, 13), new Date(2026, 3, 14))).toBe(false);
  });
});

describe("isoToDateInput / dateInputToIso", () => {
  it("roundtrips a local date (inclusive end=false)", () => {
    const iso = dateInputToIso("2026-01-15");
    expect(iso).not.toBeNull();
    expect(isoToDateInput(iso)).toBe("2026-01-15");
  });

  it("dateInputToIso endExclusive bumps to next day midnight", () => {
    const iso = dateInputToIso("2026-01-15", true);
    expect(isoToDateInput(iso)).toBe("2026-01-16");
  });

  it("isoToDateInput returns empty string on null", () => {
    expect(isoToDateInput(null)).toBe("");
  });

  it("dateInputToIso returns null for invalid input", () => {
    expect(dateInputToIso("")).toBeNull();
    expect(dateInputToIso("not-a-date")).toBeNull();
  });
});
