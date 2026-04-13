"use client";

import { useEffect, useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { extractHighestIncome, isQualifiedIncome } from "@/lib/lead/qualification";
import type { Lead } from "@/types/lead";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MetaAction {
  action_type: string;
  value: string;
}

interface InsightRow {
  date_start?: string;
  date_stop?: string;
  campaign_name?: string;
  campaign_id?: string;
  impressions?: string;
  clicks?: string;
  spend?: string;
  ctr?: string;
  actions?: MetaAction[];
  cost_per_action_type?: MetaAction[];
  leads?: number;
  cost_per_lead?: number;
  hourly_stats_aggregated_by_advertiser_time_zone?: string;
}

interface InsightsResponse {
  data: InsightRow[];
  summary: {
    total_spend: number;
    total_leads: number;
    avg_cost_per_lead: number;
    total_clicks: number;
    total_impressions: number;
    avg_ctr: number;
  };
}

interface Alert {
  type: "error" | "warning" | "success" | "info";
  title: string;
  description: string;
  metric: string;
  recommendation: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function extractLeadCount(actions?: MetaAction[]): number {
  if (!actions) return 0;
  const lead = actions.find((a) => a.action_type === "lead");
  return lead ? parseInt(lead.value, 10) : 0;
}

function fmt(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ------------------------------------------------------------------ */
/*  Alert generation                                                   */
/* ------------------------------------------------------------------ */

function generateAlerts(
  dailyData: InsightRow[],
  campaignData: InsightRow[],
  hourlyData: InsightRow[],
  leads: Lead[],
  formatBRL: (usd: number) => string
): Alert[] {
  const alerts: Alert[] = [];

  // Sort daily data by date ascending
  const sortedDaily = [...dailyData].sort(
    (a, b) => new Date(a.date_start || "").getTime() - new Date(b.date_start || "").getTime()
  );

  /* 1. CPL Spike — last 3 days avg vs previous 7 days avg */
  if (sortedDaily.length >= 4) {
    const last3 = sortedDaily.slice(-3);
    const previous = sortedDaily.slice(0, -3).slice(-7);

    const last3Leads = last3.reduce((s, r) => s + extractLeadCount(r.actions), 0);
    const last3Spend = last3.reduce((s, r) => s + parseFloat(r.spend || "0"), 0);
    const last3Cpl = last3Leads > 0 ? last3Spend / last3Leads : 0;

    const prevLeads = previous.reduce((s, r) => s + extractLeadCount(r.actions), 0);
    const prevSpend = previous.reduce((s, r) => s + parseFloat(r.spend || "0"), 0);
    const prevCpl = prevLeads > 0 ? prevSpend / prevLeads : 0;

    if (prevCpl > 0 && last3Cpl > prevCpl * 1.3) {
      const pct = Math.round(((last3Cpl - prevCpl) / prevCpl) * 100);
      alerts.push({
        type: "error",
        title: "CPL em Alta",
        description: `O custo por lead dos ultimos 3 dias esta ${pct}% acima da media dos 7 dias anteriores.`,
        metric: `CPL atual: ${formatBRL(last3Cpl)} | Media anterior: ${formatBRL(prevCpl)}`,
        recommendation:
          "Revise os criativos e publicos das campanhas ativas. Considere pausar anuncios com CPL acima de " +
          formatBRL(prevCpl * 1.5) +
          ".",
      });
    }
  }

  /* 2. No Leads Alert — campaign with spend > 0 but 0 leads last 3 days */
  campaignData.forEach((camp) => {
    const spend = parseFloat(camp.spend || "0");
    const leads = extractLeadCount(camp.actions);
    if (spend > 0 && leads === 0) {
      alerts.push({
        type: "warning",
        title: "Campanha sem Leads",
        description: `"${camp.campaign_name}" gastou ${formatBRL(spend)} nos ultimos 7 dias sem gerar nenhum lead.`,
        metric: `Gasto: ${formatBRL(spend)} | Leads: 0`,
        recommendation:
          "Avalie se o formulario esta funcionando corretamente e se o publico esta bem segmentado. Considere pausar se nao houver melhora em 48h.",
      });
    }
  });

  /* 3. Budget Burn — today spend > 150% of daily average */
  if (sortedDaily.length >= 2) {
    const today = sortedDaily[sortedDaily.length - 1];
    const others = sortedDaily.slice(0, -1);
    const todaySpend = parseFloat(today.spend || "0");
    const avgSpend =
      others.reduce((s, r) => s + parseFloat(r.spend || "0"), 0) / others.length;

    if (avgSpend > 0 && todaySpend > avgSpend * 1.5) {
      const pct = Math.round(((todaySpend - avgSpend) / avgSpend) * 100);
      alerts.push({
        type: "warning",
        title: "Queima de Orcamento",
        description: `O gasto de hoje esta ${pct}% acima da media diaria.`,
        metric: `Hoje: ${formatBRL(todaySpend)} | Media: ${formatBRL(avgSpend)}`,
        recommendation:
          "Verifique se alguma campanha esta com lance muito alto ou se o orcamento diario foi alterado recentemente.",
      });
    }
  }

  /* 4. CTR Drop — last 3 days CTR < 70% of previous week */
  if (sortedDaily.length >= 4) {
    const last3 = sortedDaily.slice(-3);
    const previous = sortedDaily.slice(0, -3).slice(-7);

    const last3Clicks = last3.reduce((s, r) => s + parseInt(r.clicks || "0", 10), 0);
    const last3Impr = last3.reduce((s, r) => s + parseInt(r.impressions || "0", 10), 0);
    const last3Ctr = last3Impr > 0 ? (last3Clicks / last3Impr) * 100 : 0;

    const prevClicks = previous.reduce((s, r) => s + parseInt(r.clicks || "0", 10), 0);
    const prevImpr = previous.reduce((s, r) => s + parseInt(r.impressions || "0", 10), 0);
    const prevCtr = prevImpr > 0 ? (prevClicks / prevImpr) * 100 : 0;

    if (prevCtr > 0 && last3Ctr < prevCtr * 0.7) {
      alerts.push({
        type: "warning",
        title: "Queda de CTR",
        description: `O CTR dos ultimos 3 dias caiu para ${last3Ctr.toFixed(2)}%, abaixo de 70% da media anterior (${prevCtr.toFixed(2)}%).`,
        metric: `CTR atual: ${last3Ctr.toFixed(2)}% | Media anterior: ${prevCtr.toFixed(2)}%`,
        recommendation:
          "Os criativos podem estar saturados. Teste novas copys e imagens. Verifique tambem a frequencia dos anuncios.",
      });
    }
  }

  /* 5. Best Performer — campaign with lowest CPL */
  const campaignsWithLeads = campaignData.filter(
    (c) => extractLeadCount(c.actions) > 0
  );
  if (campaignsWithLeads.length > 0) {
    const best = campaignsWithLeads.reduce((prev, curr) => {
      const prevCpl =
        parseFloat(prev.spend || "0") / extractLeadCount(prev.actions);
      const currCpl =
        parseFloat(curr.spend || "0") / extractLeadCount(curr.actions);
      return currCpl < prevCpl ? curr : prev;
    });
    const bestLeads = extractLeadCount(best.actions);
    const bestCpl = parseFloat(best.spend || "0") / bestLeads;
    alerts.push({
      type: "success",
      title: "Melhor Performance",
      description: `"${best.campaign_name}" tem o menor CPL entre todas as campanhas ativas.`,
      metric: `CPL: ${formatBRL(bestCpl)} | Leads: ${bestLeads}`,
      recommendation:
        "Considere aumentar o orcamento desta campanha e replicar o criativo/publico em novos conjuntos de anuncio.",
    });
  }

  /* 6. Lead Quality — % of leads with income >= 30k */
  if (leads.length > 0) {
    const highIncome = leads.filter(
      (l) => isQualifiedIncome(l.monthly_income)
    );
    const pct = Math.round((highIncome.length / leads.length) * 100);
    alerts.push({
      type: "info",
      title: "Qualidade dos Leads",
      description: `${pct}% dos leads informaram renda mensal acima de R$ 30.000.`,
      metric: `${highIncome.length} de ${leads.length} leads com renda alta`,
      recommendation:
        pct >= 30
          ? "Excelente taxa de leads qualificados. Mantenha a segmentacao atual."
          : "Considere refinar o publico para atrair leads com maior poder aquisitivo. Teste interesses relacionados a investimentos e patrimonio.",
    });
  }

  /* 7. Peak Hour — hour with most leads */
  if (hourlyData.length > 0) {
    const hourMap: Record<string, number> = {};
    hourlyData.forEach((row) => {
      const hour = row.hourly_stats_aggregated_by_advertiser_time_zone || "00";
      const count = extractLeadCount(row.actions);
      hourMap[hour] = (hourMap[hour] || 0) + count;
    });

    let peakHour = "00";
    let peakCount = 0;
    Object.entries(hourMap).forEach(([hour, count]) => {
      if (count > peakCount) {
        peakHour = hour;
        peakCount = count;
      }
    });

    if (peakCount > 0) {
      const h = peakHour.padStart(2, "0");
      alerts.push({
        type: "info",
        title: "Horario de Pico",
        description: `O horario com mais leads na ultima semana e entre ${h}:00 e ${h}:59.`,
        metric: `${peakCount} leads nesse horario`,
        recommendation:
          "Considere concentrar maior orcamento nos horarios de pico para maximizar conversoes.",
      });
    }
  }

  return alerts;
}

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */

function AlertIcon({ type }: { type: Alert["type"] }) {
  if (type === "error")
    return (
      <svg className="w-5 h-5 text-error flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86l-8.6 14.86A1 1 0 002.54 20h18.92a1 1 0 00.85-1.28l-8.6-14.86a1 1 0 00-1.42 0z" />
      </svg>
    );
  if (type === "warning")
    return (
      <svg className="w-5 h-5 text-warning flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86l-8.6 14.86A1 1 0 002.54 20h18.92a1 1 0 00.85-1.28l-8.6-14.86a1 1 0 00-1.42 0z" />
      </svg>
    );
  if (type === "success")
    return (
      <svg className="w-5 h-5 text-success flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  return (
    <svg className="w-5 h-5 text-info flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Border color map                                                   */
/* ------------------------------------------------------------------ */

const borderColors: Record<Alert["type"], string> = {
  error: "border-l-red-500",
  warning: "border-l-orange-500",
  success: "border-l-green-500",
  info: "border-l-blue-500",
};

const badgeVariant: Record<Alert["type"], "error" | "warning" | "success" | "info"> = {
  error: "error",
  warning: "warning",
  success: "success",
  info: "info",
};

const badgeLabels: Record<Alert["type"], string> = {
  error: "Critico",
  warning: "Atencao",
  success: "Positivo",
  info: "Insight",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function AlertasPage() {
  const { formatBRL } = useExchangeRate();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<{
    totalSpend: number;
    totalLeads: number;
    avgCpl: number;
    bestDay: string;
    bestCampaign: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [dailyRes, campaignRes, leadsRes, hourlyRes] = await Promise.all([
          fetch("/api/admin/insights?type=daily&date_preset=last_14d"),
          fetch("/api/admin/insights?type=campaigns&date_preset=last_7d"),
          fetch("/api/admin/leads"),
          fetch("/api/admin/insights?type=hourly&date_preset=last_7d"),
        ]);

        const dailyJson: InsightsResponse = await dailyRes.json();
        const campaignJson: InsightsResponse = await campaignRes.json();
        const leadsJson: Lead[] = await leadsRes.json();
        const hourlyJson: InsightsResponse = await hourlyRes.json();

        const dailyData = dailyJson.data || [];
        const campaignData = campaignJson.data || [];
        const hourlyData = hourlyJson.data || [];
        const leads = Array.isArray(leadsJson) ? leadsJson : [];

        // Generate alerts
        const generatedAlerts = generateAlerts(dailyData, campaignData, hourlyData, leads, formatBRL);
        setAlerts(generatedAlerts);

        // Weekly summary (last 7 days of daily data)
        const sortedDaily = [...dailyData].sort(
          (a, b) =>
            new Date(a.date_start || "").getTime() -
            new Date(b.date_start || "").getTime()
        );
        const last7Days = sortedDaily.slice(-7);

        const totalSpend = last7Days.reduce(
          (s, r) => s + parseFloat(r.spend || "0"),
          0
        );
        const totalLeads = last7Days.reduce(
          (s, r) => s + extractLeadCount(r.actions),
          0
        );
        const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;

        // Best day
        let bestDay = "";
        let bestDayLeads = 0;
        last7Days.forEach((row) => {
          const dayLeads = extractLeadCount(row.actions);
          if (dayLeads > bestDayLeads) {
            bestDayLeads = dayLeads;
            bestDay = row.date_start || "";
          }
        });
        const bestDayFormatted = bestDay
          ? new Date(bestDay + "T12:00:00").toLocaleDateString("pt-BR", {
              weekday: "short",
              day: "2-digit",
              month: "2-digit",
            })
          : "N/A";

        // Best campaign
        const campaignsWithLeads = campaignData.filter(
          (c) => extractLeadCount(c.actions) > 0
        );
        let bestCampaignName = "N/A";
        if (campaignsWithLeads.length > 0) {
          const best = campaignsWithLeads.reduce((prev, curr) => {
            const prevCpl =
              parseFloat(prev.spend || "0") / extractLeadCount(prev.actions);
            const currCpl =
              parseFloat(curr.spend || "0") / extractLeadCount(curr.actions);
            return currCpl < prevCpl ? curr : prev;
          });
          bestCampaignName = best.campaign_name || "Sem nome";
        }

        setWeeklySummary({
          totalSpend,
          totalLeads,
          avgCpl,
          bestDay: bestDayFormatted,
          bestCampaign: bestCampaignName,
        });
      } catch (err) {
        console.error("Erro ao carregar alertas:", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [formatBRL]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-navy-dark">
          Alertas & Insights
        </h1>
        <p className="text-sm text-navy-50">
          Monitoramento automatico de performance
        </p>
      </div>

      {/* Resumo Semanal */}
      {weeklySummary && (
        <Card variant="gold">
          <CardTitle>Resumo Semanal</CardTitle>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-4">
            <div>
              <p className="text-xs text-navy-50">Total Gasto</p>
              <p className="text-xl font-bold text-navy-dark">
                {formatBRL(weeklySummary.totalSpend)}
              </p>
            </div>
            <div>
              <p className="text-xs text-navy-50">Total Leads</p>
              <p className="text-xl font-bold text-navy-dark">
                {weeklySummary.totalLeads}
              </p>
            </div>
            <div>
              <p className="text-xs text-navy-50">CPL Medio</p>
              <p className="text-xl font-bold text-navy-dark">
                {formatBRL(weeklySummary.avgCpl)}
              </p>
            </div>
            <div>
              <p className="text-xs text-navy-50">Melhor Dia</p>
              <p className="text-sm font-bold text-navy-dark">
                {weeklySummary.bestDay}
              </p>
            </div>
            <div>
              <p className="text-xs text-navy-50">Melhor Campanha</p>
              <p className="text-sm font-bold text-navy-dark truncate">
                {weeklySummary.bestCampaign}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Alerts */}
      {alerts.length === 0 ? (
        <Card>
          <p className="text-navy-50 text-center py-8">
            Nenhum alerta gerado. Todos os indicadores estao dentro do esperado.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {alerts.map((alert, i) => (
            <Card
              key={i}
              className={`border-l-4 ${borderColors[alert.type]}`}
            >
              <div className="flex items-start gap-3">
                <AlertIcon type={alert.type} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <CardTitle>{alert.title}</CardTitle>
                    <Badge variant={badgeVariant[alert.type]}>
                      {badgeLabels[alert.type]}
                    </Badge>
                  </div>
                  <p className="text-sm text-navy-dark">{alert.description}</p>
                  <p className="text-xs text-navy-50 mt-1 font-mono">
                    {alert.metric}
                  </p>
                  <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-navy-50">
                    <strong className="text-navy-dark">Recomendacao:</strong>{" "}
                    {alert.recommendation}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
