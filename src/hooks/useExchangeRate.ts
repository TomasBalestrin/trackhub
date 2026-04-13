"use client";

import { useEffect, useState } from "react";

let globalRate: number | null = null;
let fetching = false;
const listeners: Array<(rate: number) => void> = [];

export function useExchangeRate() {
  const [rate, setRate] = useState<number>(globalRate || 5.5);

  useEffect(() => {
    if (globalRate) {
      setRate(globalRate);
      return;
    }

    listeners.push(setRate);

    if (!fetching) {
      fetching = true;
      fetch("/api/admin/exchange-rate")
        .then((res) => res.json())
        .then((data) => {
          globalRate = data.rate || 5.5;
          listeners.forEach((fn) => fn(globalRate!));
        })
        .catch(() => {
          globalRate = 5.5;
          listeners.forEach((fn) => fn(5.5));
        });
    }

    return () => {
      const idx = listeners.indexOf(setRate);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  }, []);

  function toBRL(usd: number): number {
    return usd * rate;
  }

  function formatBRL(usd: number): string {
    const brl = usd * rate;
    return brl.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return { rate, toBRL, formatBRL };
}
