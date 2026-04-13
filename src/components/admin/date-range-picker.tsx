"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  type DateField,
  type DateRange,
  type DateRangePreset,
  PRESET_LABELS,
  DATE_FIELD_LABELS,
  WEEKDAY_SHORT_PT,
  MONTH_SHORT_PT,
  presetToRange,
  buildMonthGrid,
  isSameDay,
} from "@/lib/date-range";
import { cn } from "@/lib/utils";

interface Props {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

// Presets exibidos no sidebar, nesta ordem (espelha o modelo escolhido pelo usuário).
const SIDEBAR_PRESETS: Exclude<DateRangePreset, "custom" | "today" | "yesterday" | "last_14d">[] = [
  "last_7d",
  "last_15d",
  "last_30d",
  "last_90d",
  "last_180d",
  "last_365d",
];

const FIELDS: DateField[] = ["created_at", "lead_at"];

function formatDateShort(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, "0")} ${MONTH_SHORT_PT[d.getMonth()]} ${d.getFullYear()}`;
}

function rangeMatchesPreset(range: DateRange, preset: Exclude<DateRangePreset, "custom">): boolean {
  const target = presetToRange(preset, range.field);
  return target.start === range.start && target.end === range.end;
}

function dateFromRangeStart(start: string | null): Date | null {
  return start ? new Date(start) : null;
}
// end é exclusivo → o último dia do range visual é end - 1ms.
function dateFromRangeEndInclusive(end: string | null): Date | null {
  return end ? new Date(new Date(end).getTime() - 1) : null;
}

export function DateRangePicker({ value, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const today = useMemo(() => new Date(), []);
  const initialMonth = dateFromRangeStart(value.start) ?? today;
  const [displayMonth, setDisplayMonth] = useState<Date>(
    new Date(initialMonth.getFullYear(), initialMonth.getMonth(), 1)
  );

  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const activePreset = SIDEBAR_PRESETS.find((p) => rangeMatchesPreset(value, p));
  const startDate = dateFromRangeStart(value.start);
  const endDate = dateFromRangeEndInclusive(value.end);

  function applyPreset(preset: Exclude<DateRangePreset, "custom">) {
    onChange(presetToRange(preset, value.field));
  }

  function setField(field: DateField) {
    onChange({ ...value, field });
  }

  function navigateMonth(delta: number) {
    setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + delta, 1));
  }

  function navigateYear(delta: number) {
    setDisplayMonth(new Date(displayMonth.getFullYear() + delta, displayMonth.getMonth(), 1));
  }

  // Seleção por clique: primeiro clique = start novo (end null); segundo = end
  // (se depois de start), senão reseta.
  function onDayClick(day: Date) {
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
    const nextMidnight = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    if (!startDate || endDate) {
      onChange({ ...value, start: dayStart.toISOString(), end: nextMidnight.toISOString() });
      return;
    }
    // start set, end null → ou estamos num range em construção (quando presets aplicam start+end)
    // então sempre começar novo range quando clicar no segundo dia.
    if (dayStart < startDate) {
      onChange({ ...value, start: dayStart.toISOString(), end: new Date(startDate.getTime() + 24 * 60 * 60 * 1000).toISOString() });
    } else {
      onChange({ ...value, end: nextMidnight.toISOString() });
    }
  }

  const days = buildMonthGrid(displayMonth.getFullYear(), displayMonth.getMonth());
  const displayMonthIdx = displayMonth.getMonth();

  const label =
    startDate && endDate
      ? `${formatDateShort(startDate.toISOString())} — ${formatDateShort(endDate.toISOString())}`
      : "Selecionar período";

  return (
    <div ref={rootRef} className={cn("relative inline-block", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-2 px-4 py-2 rounded-md border text-sm transition-colors",
          "bg-navy-dark text-white border-navy-dark hover:bg-navy"
        )}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="16" y1="2" x2="16" y2="6" />
        </svg>
        {label}
        <span className="text-gold">▾</span>
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-50 mt-2 flex rounded-lg overflow-hidden shadow-xl",
            "bg-navy-dark text-white border border-navy"
          )}
          style={{ minWidth: 540 }}
        >
          {/* Sidebar de presets */}
          <div className="flex flex-col py-2 border-r border-navy" style={{ minWidth: 170 }}>
            {/* Field toggle no topo */}
            <div className="px-3 pb-2 mb-2 border-b border-navy">
              <div className="text-xs text-white/50 mb-1.5">Campo</div>
              <div className="inline-flex rounded-md overflow-hidden text-xs border border-navy">
                {FIELDS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setField(f)}
                    className={cn(
                      "px-2 py-1 transition-colors",
                      value.field === f
                        ? "bg-gold text-navy-dark font-semibold"
                        : "text-white/70 hover:bg-navy"
                    )}
                  >
                    {DATE_FIELD_LABELS[f]}
                  </button>
                ))}
              </div>
            </div>

            {SIDEBAR_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => applyPreset(p)}
                className={cn(
                  "px-4 py-2 text-sm text-left transition-colors",
                  activePreset === p
                    ? "bg-gold text-navy-dark font-semibold"
                    : "text-white/80 hover:bg-navy"
                )}
              >
                {PRESET_LABELS[p]}
              </button>
            ))}
          </div>

          {/* Grid do calendário */}
          <div className="p-4" style={{ minWidth: 360 }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => navigateYear(-1)}
                  className="w-7 h-7 flex items-center justify-center rounded-md text-white/60 hover:bg-navy"
                  aria-label="Ano anterior"
                >
                  «
                </button>
                <button
                  type="button"
                  onClick={() => navigateMonth(-1)}
                  className="w-7 h-7 flex items-center justify-center rounded-md text-white/60 hover:bg-navy"
                  aria-label="Mês anterior"
                >
                  ‹
                </button>
              </div>
              <div className="font-semibold">
                {MONTH_SHORT_PT[displayMonthIdx]} {displayMonth.getFullYear()}
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => navigateMonth(1)}
                  className="w-7 h-7 flex items-center justify-center rounded-md text-white/60 hover:bg-navy"
                  aria-label="Mês seguinte"
                >
                  ›
                </button>
                <button
                  type="button"
                  onClick={() => navigateYear(1)}
                  className="w-7 h-7 flex items-center justify-center rounded-md text-white/60 hover:bg-navy"
                  aria-label="Ano seguinte"
                >
                  »
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-xs text-white/50 mb-2">
              {WEEKDAY_SHORT_PT.map((w) => (
                <div key={w} className="h-8 flex items-center justify-center font-medium">
                  {w}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {days.map((d, i) => {
                const isOtherMonth = d.getMonth() !== displayMonthIdx;
                const isToday = isSameDay(d, today);
                const isStart = startDate && isSameDay(d, startDate);
                const isEnd = endDate && isSameDay(d, endDate);
                const isInRange =
                  startDate && endDate && d > startDate && d < endDate;

                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onDayClick(d)}
                    className={cn(
                      "h-9 flex items-center justify-center text-sm rounded-md transition-colors",
                      isOtherMonth && !isInRange && !isStart && !isEnd
                        ? "text-white/25"
                        : "text-white/85",
                      isToday && !isStart && !isEnd && "text-gold font-bold",
                      isInRange && "bg-gold/20",
                      (isStart || isEnd) && "bg-gold text-navy-dark font-bold",
                      !isStart && !isEnd && "hover:bg-navy"
                    )}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
