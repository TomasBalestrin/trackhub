"use client";

import { useState } from "react";
import {
  type DateField,
  type DateRange,
  type DateRangePreset,
  PRESET_LABELS,
  DATE_FIELD_LABELS,
  presetToRange,
  isoToDateInput,
  dateInputToIso,
} from "@/lib/date-range";
import { cn } from "@/lib/utils";

interface Props {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

const PRESETS: Exclude<DateRangePreset, "custom">[] = [
  "today",
  "yesterday",
  "last_7d",
  "last_14d",
  "last_30d",
  "last_90d",
];

const FIELDS: DateField[] = ["created_at", "lead_at"];

function rangeMatchesPreset(range: DateRange, preset: Exclude<DateRangePreset, "custom">): boolean {
  const target = presetToRange(preset, range.field);
  return target.start === range.start && target.end === range.end;
}

export function DateRangePicker({ value, onChange, className }: Props) {
  const [isCustomOpen, setIsCustomOpen] = useState(false);

  const activePreset = PRESETS.find((p) => rangeMatchesPreset(value, p));
  const isCustom = !activePreset;

  function applyPreset(preset: Exclude<DateRangePreset, "custom">) {
    onChange(presetToRange(preset, value.field));
    setIsCustomOpen(false);
  }

  function setField(field: DateField) {
    onChange({ ...value, field });
  }

  function setCustomStart(input: string) {
    onChange({ ...value, start: dateInputToIso(input) });
  }

  function setCustomEnd(input: string) {
    // end é exclusivo: usuário escolhe "até 15/01", guardamos meia-noite do dia 16.
    onChange({ ...value, end: dateInputToIso(input, true) });
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {/* Field toggle */}
        <div className="inline-flex rounded-md border border-navy-10 overflow-hidden text-xs">
          {FIELDS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setField(f)}
              className={cn(
                "px-3 py-1.5 transition-colors",
                value.field === f
                  ? "bg-navy text-white"
                  : "bg-white text-navy-70 hover:bg-navy-05"
              )}
            >
              {DATE_FIELD_LABELS[f]}
            </button>
          ))}
        </div>

        <span className="text-navy-30">•</span>

        {/* Presets */}
        <div className="inline-flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => applyPreset(p)}
              className={cn(
                "px-3 py-1.5 text-xs rounded-md border transition-colors",
                activePreset === p
                  ? "bg-navy text-white border-navy"
                  : "bg-white text-navy-70 border-navy-10 hover:bg-navy-05"
              )}
            >
              {PRESET_LABELS[p]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setIsCustomOpen((v) => !v)}
            className={cn(
              "px-3 py-1.5 text-xs rounded-md border transition-colors",
              isCustom || isCustomOpen
                ? "bg-navy text-white border-navy"
                : "bg-white text-navy-70 border-navy-10 hover:bg-navy-05"
            )}
          >
            {PRESET_LABELS.custom}
          </button>
        </div>
      </div>

      {(isCustomOpen || isCustom) && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1 text-navy-70">
            De
            <input
              type="date"
              value={isoToDateInput(value.start)}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-2 py-1 border border-navy-10 rounded-md text-navy-dark"
            />
          </label>
          <label className="flex items-center gap-1 text-navy-70">
            Até
            <input
              type="date"
              // Mostrar o último dia inclusivo, embora guardemos a meia-noite seguinte.
              value={isoToDateInput(value.end ? new Date(new Date(value.end).getTime() - 1).toISOString() : null)}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-2 py-1 border border-navy-10 rounded-md text-navy-dark"
            />
          </label>
        </div>
      )}
    </div>
  );
}
