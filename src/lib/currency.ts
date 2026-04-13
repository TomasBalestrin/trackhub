let cachedRate: { rate: number; timestamp: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Fetches the current USD → BRL exchange rate.
 * Caches for 1 hour to avoid excessive API calls.
 */
export async function getUSDtoBRL(): Promise<number> {
  if (cachedRate && Date.now() - cachedRate.timestamp < CACHE_TTL) {
    return cachedRate.rate;
  }

  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 3600 },
    });
    const data = await res.json();
    const rate = data.rates?.BRL || 5.5;
    cachedRate = { rate, timestamp: Date.now() };
    return rate;
  } catch {
    return cachedRate?.rate || 5.5; // fallback
  }
}

/**
 * Converts USD to BRL given a rate.
 */
export function usdToBrl(usd: number, rate: number): number {
  return usd * rate;
}

/**
 * Formats a BRL value as currency string.
 */
export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
