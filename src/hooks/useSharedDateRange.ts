"use client";

import { useEffect, useState } from "react";
import { presetToRange, type DateField, type DateRange } from "@/lib/date-range";

const STORAGE_KEY = "admin.dateRange.v1";

function readStored(): DateRange | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DateRange;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.field !== "created_at" && parsed.field !== "lead_at") return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Persiste o DateRange escolhido em localStorage para que a seleção
 * sobreviva à navegação entre menus do admin.
 */
export function useSharedDateRange(defaultField: DateField = "created_at") {
  const [range, setRange] = useState<DateRange>(() => presetToRange("last_30d", defaultField));

  // Hidrata do localStorage no mount (evita mismatch SSR/CSR)
  useEffect(() => {
    const stored = readStored();
    if (stored) setRange(stored);
  }, []);

  // Persiste a cada mudança
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(range));
    } catch {
      /* quota / private mode — ignora */
    }
    window.dispatchEvent(new CustomEvent("admin-date-range-change", { detail: range }));
  }, [range]);

  // Sincroniza entre abas e entre páginas/components que usem o hook
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const next = JSON.parse(e.newValue) as DateRange;
        setRange(next);
      } catch { /* ignore */ }
    }
    function onCustom(e: Event) {
      const next = (e as CustomEvent<DateRange>).detail;
      if (next) setRange(next);
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener("admin-date-range-change", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("admin-date-range-change", onCustom);
    };
  }, []);

  return [range, setRange] as const;
}
