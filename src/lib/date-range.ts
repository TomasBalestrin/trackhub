/**
 * Tipagem e utilitários de filtro por janela de data para admin pages.
 *
 * - `DateRange` carrega também o CAMPO a ser comparado (`created_at` vs
 *   `lead_at`) para o filtro saber em qual timestamp bater.
 * - `null` em start/end significa "sem limite naquele lado" (open range).
 * - Presets produzem ranges usando o horário local do browser; uma vez
 *   gerado o range, a comparação é feita via ISO (UTC).
 */

export type DateField = "created_at" | "lead_at";

export interface DateRange {
  start: string | null; // ISO 8601 (inclusive)
  end: string | null;   // ISO 8601 (exclusive)
  field: DateField;
}

export type DateRangePreset =
  | "today"
  | "yesterday"
  | "last_7d"
  | "last_14d"
  | "last_15d"
  | "last_30d"
  | "last_90d"
  | "last_180d"
  | "last_365d"
  | "custom";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

/**
 * Gera um DateRange para um preset, relativo a `now`.
 * Convenção: `end` é exclusivo (meia-noite do dia seguinte para "Hoje").
 */
export function presetToRange(
  preset: Exclude<DateRangePreset, "custom">,
  field: DateField = "created_at",
  now: Date = new Date()
): DateRange {
  const today = startOfDay(now);
  switch (preset) {
    case "today":
      return { start: today.toISOString(), end: addDays(today, 1).toISOString(), field };
    case "yesterday":
      return { start: addDays(today, -1).toISOString(), end: today.toISOString(), field };
    case "last_7d":
      return { start: addDays(today, -6).toISOString(), end: addDays(today, 1).toISOString(), field };
    case "last_14d":
      return { start: addDays(today, -13).toISOString(), end: addDays(today, 1).toISOString(), field };
    case "last_15d":
      return { start: addDays(today, -14).toISOString(), end: addDays(today, 1).toISOString(), field };
    case "last_30d":
      return { start: addDays(today, -29).toISOString(), end: addDays(today, 1).toISOString(), field };
    case "last_90d":
      return { start: addDays(today, -89).toISOString(), end: addDays(today, 1).toISOString(), field };
    case "last_180d":
      return { start: addDays(today, -179).toISOString(), end: addDays(today, 1).toISOString(), field };
    case "last_365d":
      return { start: addDays(today, -364).toISOString(), end: addDays(today, 1).toISOString(), field };
  }
}

/**
 * Filtra `items` pelo DateRange. Items cujo campo seja null/undefined são
 * excluídos se houver qualquer limite definido no range; se start/end forem
 * ambos null, nada é filtrado.
 */
export function filterByDateRange<T>(items: T[], range: DateRange): T[] {
  if (!range.start && !range.end) return items;
  return items.filter((item) => {
    const raw = (item as Record<string, unknown>)[range.field];
    if (typeof raw !== "string" || !raw) return false;
    const t = Date.parse(raw);
    if (Number.isNaN(t)) return false;
    if (range.start && t < Date.parse(range.start)) return false;
    if (range.end && t >= Date.parse(range.end)) return false;
    return true;
  });
}

/**
 * Converte ISO para `YYYY-MM-DD` no fuso local (útil para `<input type="date">`).
 */
export function isoToDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Lê `YYYY-MM-DD` (local) e devolve ISO. `endExclusive=true` retorna meia-noite
 * do dia seguinte — padrão para intervalos tipo `[start, end)`.
 */
export function dateInputToIso(input: string, endExclusive = false): string | null {
  if (!input) return null;
  const [y, m, d] = input.split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d, 0, 0, 0, 0);
  return (endExclusive ? addDays(date, 1) : date).toISOString();
}

export const DATE_FIELD_LABELS: Record<DateField, string> = {
  created_at: "Data de entrada",
  lead_at: "Data do Lead (Meta)",
};

export const PRESET_LABELS: Record<DateRangePreset, string> = {
  today: "Hoje",
  yesterday: "Ontem",
  last_7d: "Últimos 7 dias",
  last_14d: "14 dias",
  last_15d: "Últimos 15 dias",
  last_30d: "Últimos 30 dias",
  last_90d: "Trimestral",
  last_180d: "Semestral",
  last_365d: "Últimos 12 meses",
  custom: "Personalizado",
};

/**
 * Dias da semana no formato "DO, 2ª, 3ª, 4ª, 5ª, 6ª, SÁ" para header do grid.
 * Começa no Domingo (índice 0).
 */
export const WEEKDAY_SHORT_PT = ["DO", "2ª", "3ª", "4ª", "5ª", "6ª", "SÁ"];

export const MONTH_SHORT_PT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Retorna array com os 42 dias a serem renderizados no grid do mês (6 semanas),
 * começando no domingo antes ou no dia 1 do mês, até preencher 6 semanas.
 */
export function buildMonthGrid(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month, 1);
  const dayOfWeek = firstOfMonth.getDay();
  const gridStart = new Date(year, month, 1 - dayOfWeek);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  }
  return days;
}
