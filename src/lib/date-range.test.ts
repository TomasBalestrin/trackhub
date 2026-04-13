import { describe, it, expect } from "vitest";
import {
  presetToRange,
  filterByDateRange,
  isoToDateInput,
  dateInputToIso,
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

  it("last_30d: covers 30 full days", () => {
    const r = presetToRange("last_30d", "created_at", NOW);
    expect(isoToDateInput(r.start)).toBe("2025-12-17");
    expect(isoToDateInput(r.end)).toBe("2026-01-16");
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
