/**
 * Extrai o maior valor numérico de uma string de renda.
 * Ex: "Entre R$10.000 e R$30.000" → 30000
 *     "Acima de R$1.000.000" → 1000000
 *     "Até R$2.000" → 2000
 */
export function extractHighestIncome(income: string | null | undefined): number {
  if (!income) return 0;
  const numbers = income.match(/[\d.]+/g);
  if (!numbers) return 0;
  return Math.max(...numbers.map((n) => {
    // Remove dots used as thousands separator (e.g. "30.000" → "30000")
    const cleaned = n.replace(/\./g, "");
    return parseInt(cleaned, 10) || 0;
  }));
}

export function calculateQualificationScore(data: {
  monthly_income: string | null;
  how_found: string | null;
  city: string | null;
  state: string | null;
}): number {
  let score = 0;

  // Renda: considera o maior valor da faixa. Qualificado = acima de 30.000
  if (data.monthly_income) {
    const highestIncome = extractHighestIncome(data.monthly_income);
    if (highestIncome >= 1000000) {
      score += 50;
    } else if (highestIncome >= 100000) {
      score += 45;
    } else if (highestIncome >= 30000) {
      score += 35;
    } else {
      // Abaixo de 30k = não qualificado, score baixo
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
