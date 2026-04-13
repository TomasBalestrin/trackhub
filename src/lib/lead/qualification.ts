/**
 * Extrai o maior valor numérico de uma string de renda.
 * Ex: "Entre R$10.000 e R$30.000" → 30000
 *     "Acima de R$1.000.000" → 1000000
 *     "Até R$2.000" → 2000
 */
function parseIncomeNumbers(income: string): number[] {
  const matches = income.match(/[\d.]+/g);
  if (!matches) return [];
  return matches
    .map((n) => parseInt(n.replace(/\./g, ""), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export function extractHighestIncome(income: string | null | undefined): number {
  if (!income) return 0;
  const nums = parseIncomeNumbers(income);
  return nums.length > 0 ? Math.max(...nums) : 0;
}

/**
 * Retorna o MENOR valor numérico de uma string de renda — representa o piso
 * declarado pelo lead. Usado para classificação "qualificado" em vez do MAX
 * para evitar inflar a faixa (ex: "15.000 - 30.000" não é qualificada porque
 * o piso é 15k, mesmo que o teto bata 30k).
 */
export function extractLowestIncome(income: string | null | undefined): number {
  if (!income) return 0;
  const nums = parseIncomeNumbers(income);
  return nums.length > 0 ? Math.min(...nums) : 0;
}

/**
 * Regra de qualificação por renda: lead se enquadra se o PISO da faixa
 * declarada é >= R$ 30.000. Fonte única de verdade para filtros e badges
 * no admin + score em lead ingestion. Mudar aqui propaga pra tudo.
 */
export const QUALIFIED_INCOME_FLOOR = 30_000;

export function isQualifiedIncome(income: string | null | undefined): boolean {
  return extractLowestIncome(income) >= QUALIFIED_INCOME_FLOOR;
}

export function calculateQualificationScore(data: {
  monthly_income: string | null;
  how_found: string | null;
  city: string | null;
  state: string | null;
}): number {
  let score = 0;

  // Renda: usa o PISO da faixa declarada. Qualificado = piso >= R$ 30.000.
  // Usar o piso evita que "R$ 15.000 - R$ 30.000" seja contada como qualificada
  // só porque o teto bate em 30k.
  if (data.monthly_income) {
    const floor = extractLowestIncome(data.monthly_income);
    if (floor >= 1_000_000) {
      score += 50;
    } else if (floor >= 100_000) {
      score += 45;
    } else if (floor >= QUALIFIED_INCOME_FLOOR) {
      score += 35;
    } else {
      // Piso abaixo de 30k → não qualificado, score baixo.
      score += 5;
    }
  }

  const sourceScores: Record<string, number> = {
    instagram: 30,
    facebook: 30,
    google: 25,
    youtube: 20,
    indicacao: 15,
    outro: 10,
  };
  if (data.how_found) {
    score += sourceScores[data.how_found] ?? 0;
  }

  if (data.city) score += 10;
  if (data.state) score += 10;

  return score;
}

export function getScoreLabel(score: number): string {
  if (score >= 80) return "Quente";
  if (score >= 50) return "Morno";
  return "Frio";
}

export function getScoreColor(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 50) return "text-warning";
  return "text-navy-50";
}
