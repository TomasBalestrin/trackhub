"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { DateRangePicker } from "@/components/admin/date-range-picker";
import { extractHighestIncome, isQualifiedIncome } from "@/lib/lead/qualification";
import { filterByDateRange, presetToRange, type DateRange } from "@/lib/date-range";
import type { Lead } from "@/types/lead";

interface InsightsRow {
  campaign_name?: string;
  ad_name?: string;
  impressions?: string;
  clicks?: string;
  spend?: string;
  cpc?: string;
  ctr?: string;
  reach?: string;
  leads?: number;
  cost_per_lead?: number;
  actions?: Array<{ action_type: string; value: string }>;
  date_start?: string;
  date_stop?: string;
  hourly_stats_aggregated_by_advertiser_time_zone?: string;
  age?: string;
  gender?: string;
  publisher_platform?: string;
  platform_position?: string;
  region?: string;
}

interface InsightsResponse {
  data: InsightsRow[];
  summary?: {
    impressions: number;
    clicks: number;
    spend: number;
    reach: number;
    leads: number;
    cpc: number;
    ctr: number;
    cpm: number;
    cost_per_lead: number;
  };
}

const PERIOD_OPTIONS = [
  { value: "today", label: "Hoje" },
  { value: "last_7d", label: "7 dias" },
  { value: "last_14d", label: "14 dias" },
  { value: "last_30d", label: "30 dias" },
];

function extractLeads(row: InsightsRow): number {
  if (row.leads && row.leads > 0) return row.leads;
  const action = (row.actions || []).find((a) => a.action_type === "lead");
  return action ? parseInt(action.value, 10) : 0;
}

export default function PremiumDashboard() {
  const { formatBRL } = useExchangeRate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [overview, setOverview] = useState<InsightsResponse | null>(null);
  const [daily, setDaily] = useState<InsightsRow[]>([]);
  const [campaigns, setCampaigns] = useState<InsightsRow[]>([]);
  const [hourly, setHourly] = useState<InsightsRow[]>([]);
  const [placements, setPlacements] = useState<InsightsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("last_7d");
  const [dateRange, setDateRange] = useState<DateRange>(() =>
    presetToRange("last_30d", "created_at")
  );

  useEffect(() => {
    fetchLeads();
  }, []);

  useEffect(() => {
    fetchInsights();
  }, [period]);

  async function fetchLeads() {
    const res = await fetch("/api/admin/leads");
    const data = await res.json();
    setLeads(Array.isArray(data) ? data : []);
  }

  async function fetchInsights() {
    setLoading(true);
    try {
      const [ovRes, dailyRes, campRes, hourRes, placeRes] = await Promise.all([
        fetch(`/api/admin/insights?type=overview&date_preset=${period}`),
        fetch(`/api/admin/insights?type=daily&date_preset=${period}`),
        fetch(`/api/admin/insights?type=campaigns&date_preset=${period}`),
        fetch(`/api/admin/insights?type=hourly&date_preset=last_7d`),
        fetch(`/api/admin/insights?type=placements&date_preset=${period}`),
      ]);
      const [ovData, dailyData, campData, hourData, placeData] = await Promise.all([
        ovRes.json(),
        dailyRes.json(),
        campRes.json(),
        hourRes.json(),
        placeRes.json(),
      ]);
      setOverview(ovData);
      setDaily(dailyData.data || []);
      setCampaigns(campData.data || []);
      setHourly(hourData.data || []);
      setPlacements(placeData.data || []);
    } catch {
      /* silent */
    }
    setLoading(false);
  }

  // Lead computed stats — tudo derivado de `leads` é filtrado pelo período
  // escolhido no DateRangePicker. Os dois sub-KPIs "hoje" e "semana"
  // permanecem calculados a partir do dataset completo como visão de entrada.
  const filteredLeads = filterByDateRange(leads, dateRange);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const todayLeads = leads.filter((l) => l.created_at >= todayStart);
  const weekLeads = leads.filter((l) => l.created_at >= weekStart);
  const qualifiedLeads = filteredLeads.filter((l) => isQualifiedIncome(l.monthly_income));
  const recentLeads = filteredLeads.slice(0, 8);

  // Meta insights
  const s = overview?.summary;
  const totalSpend = s?.spend || 0;
  const totalImpressions = s?.impressions || 0;
  const totalClicks = s?.clicks || 0;
  const totalReach = s?.reach || 0;
  const metaLeads = s?.leads || 0;
  const cpl = s?.cost_per_lead || 0;
  const ctr = s?.ctr || 0;

  // Qualification rate
  const qualRate = filteredLeads.length > 0 ? Math.round((qualifiedLeads.length / filteredLeads.length) * 100) : 0;

  // Cost per qualified lead
  const cplQualified = qualifiedLeads.length > 0 ? totalSpend / qualifiedLeads.length : 0;

  // Best campaign
  const sortedCampaigns = [...campaigns]
    .map((c) => ({ ...c, leadCount: extractLeads(c) }))
    .filter((c) => c.leadCount > 0)
    .sort((a, b) => {
      const cplA = a.cost_per_lead || (parseFloat(a.spend || "0") / (a.leadCount || 1));
      const cplB = b.cost_per_lead || (parseFloat(b.spend || "0") / (b.leadCount || 1));
      return cplA - cplB;
    });
  const bestCampaign = sortedCampaigns[0];
  const worstCampaign = sortedCampaigns[sortedCampaigns.length - 1];

  // Peak hour
  const peakHour = [...hourly]
    .map((h) => ({ hour: h.hourly_stats_aggregated_by_advertiser_time_zone, leads: extractLeads(h) }))
    .sort((a, b) => b.leads - a.leads)[0];

  // Top placements
  const topPlacements = [...placements]
    .map((p) => ({ ...p, leadCount: extractLeads(p) }))
    .sort((a, b) => b.leadCount - a.leadCount)
    .slice(0, 4);

  // Daily chart max
  const dailyMaxSpend = Math.max(...daily.map((d) => parseFloat(d.spend || "0")), 1);
  const dailyMaxLeads = Math.max(...daily.map((d) => extractLeads(d)), 1);

  // Income breakdown
  const byIncome: Record<string, { total: number; qualified: number }> = {};
  filteredLeads.forEach((l) => {
    const income = l.monthly_income || "N/A";
    if (!byIncome[income]) byIncome[income] = { total: 0, qualified: 0 };
    byIncome[income].total++;
    if (isQualifiedIncome(income)) byIncome[income].qualified++;
  });

  // Status breakdown
  const byStatus: Record<string, number> = {};
  filteredLeads.forEach((l) => {
    byStatus[l.status] = (byStatus[l.status] || 0) + 1;
  });
  const statusLabels: Record<string, string> = {
    new: "Novo",
    contacted: "Contactado",
    qualified: "Qualificado",
    converted: "Convertido",
    lost: "Perdido",
  };
  const statusColors: Record<string, string> = {
    new: "bg-info",
    contacted: "bg-warning",
    qualified: "bg-gold",
    converted: "bg-success",
    lost: "bg-error",
  };

  // Source breakdown
  const bySource: Record<string, number> = {};
  filteredLeads.forEach((l) => {
    const src = l.source || "Direto";
    bySource[src] = (bySource[src] || 0) + 1;
  });

  // Campaign lead count
  const byCampaign: Record<string, number> = {};
  filteredLeads.forEach((l) => {
    const c = l.campaign_name || l.utm_campaign || "Direto";
    byCampaign[c] = (byCampaign[c] || 0) + 1;
  });

  // Hourly heatmap data
  const hourlyData = Array.from({ length: 24 }, (_, i) => {
    const h = hourly.find(
      (r) => r.hourly_stats_aggregated_by_advertiser_time_zone?.startsWith(String(i).padStart(2, "0"))
    );
    return { hour: i, leads: h ? extractLeads(h) : 0, spend: h ? parseFloat(h.spend || "0") : 0 };
  });
  const maxHourlyLeads = Math.max(...hourlyData.map((h) => h.leads), 1);

  if (loading && leads.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-dark">Dashboard</h1>
          <p className="text-sm text-navy-50">Visão geral do sistema de tracking</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <Select options={PERIOD_OPTIONS} value={period} onChange={(e) => setPeriod(e.target.value)} />
        </div>
      </div>

      {/* Row 1: Main KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <p className="text-xs text-navy-50 uppercase tracking-wider">Leads no período</p>
          <p className="text-3xl font-bold text-navy-dark mt-1">{filteredLeads.length}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-gold font-semibold">+{todayLeads.length} hoje</span>
            <span className="text-xs text-navy-30">|</span>
            <span className="text-xs text-info font-semibold">+{weekLeads.length} semana</span>
          </div>
        </Card>

        <Card>
          <p className="text-xs text-navy-50 uppercase tracking-wider">Qualificados (30k+)</p>
          <p className="text-3xl font-bold text-success mt-1">{qualifiedLeads.length}</p>
          <div className="mt-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-success rounded-full" style={{ width: `${qualRate}%` }} />
              </div>
              <span className="text-xs text-navy-50 font-semibold">{qualRate}%</span>
            </div>
          </div>
        </Card>

        <Card>
          <p className="text-xs text-navy-50 uppercase tracking-wider">Gasto Meta Ads</p>
          <p className="text-3xl font-bold text-navy-dark mt-1">{formatBRL(totalSpend)}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-navy-50">Alcance: {totalReach.toLocaleString()}</span>
          </div>
        </Card>

        <Card>
          <p className="text-xs text-navy-50 uppercase tracking-wider">Custo por Lead</p>
          <p className="text-3xl font-bold text-gold mt-1">
            {cpl > 0 ? formatBRL(cpl) : "—"}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-navy-50">
              CPL Qualificado: {cplQualified > 0 ? formatBRL(cplQualified) : "—"}
            </span>
          </div>
        </Card>
      </div>

      {/* Row 2: Funnel + Insights */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Funnel */}
        <Card className="lg:col-span-2">
          <CardTitle>Funil de Conversão</CardTitle>
          <div className="mt-4 space-y-3">
            {[
              { label: "Impressões", value: totalImpressions, color: "bg-navy-15" },
              { label: "Cliques", value: totalClicks, color: "bg-info" },
              { label: "Leads Meta", value: metaLeads, color: "bg-gold" },
              { label: "Leads no Sistema", value: leads.length, color: "bg-gold-light" },
              { label: "Qualificados (30k+)", value: qualifiedLeads.length, color: "bg-success" },
            ].map((step, i, arr) => {
              const maxVal = arr[0].value || 1;
              const pct = maxVal > 0 ? (step.value / maxVal) * 100 : 0;
              const prevVal = i > 0 ? arr[i - 1].value : 0;
              const convRate = prevVal > 0 ? ((step.value / prevVal) * 100).toFixed(1) : "—";

              return (
                <div key={step.label} className="flex items-center gap-3">
                  <span className="text-xs text-navy-50 w-36 shrink-0">{step.label}</span>
                  <div className="flex-1 h-7 bg-gray-50 rounded-md overflow-hidden relative">
                    <div
                      className={`h-full ${step.color} rounded-md transition-all duration-700`}
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                    <span className="absolute inset-0 flex items-center px-3 text-xs font-semibold text-navy-dark">
                      {step.value.toLocaleString()}
                    </span>
                  </div>
                  {i > 0 && (
                    <span className="text-xs text-navy-30 w-14 text-right shrink-0">{convRate}%</span>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Quick Insights */}
        <div className="space-y-4">
          {bestCampaign && (
            <Card variant="gold">
              <p className="text-xs text-navy-50 uppercase tracking-wider">Melhor Campanha</p>
              <p className="text-sm font-bold text-navy-dark mt-1 truncate">{bestCampaign.campaign_name}</p>
              <div className="flex items-center gap-3 mt-2">
                <Badge variant="success">{bestCampaign.leadCount} leads</Badge>
                <span className="text-xs text-navy-50">
                  CPL: {formatBRL(bestCampaign.cost_per_lead || (parseFloat(bestCampaign.spend || "0") / (bestCampaign.leadCount || 1)))}
                </span>
              </div>
            </Card>
          )}

          {peakHour && peakHour.leads > 0 && (
            <Card>
              <p className="text-xs text-navy-50 uppercase tracking-wider">Pico de Conversão</p>
              <p className="text-3xl font-bold text-gold mt-1">
                {peakHour.hour?.split(":")[0] || "—"}h
              </p>
              <p className="text-xs text-navy-50 mt-1">{peakHour.leads} leads neste horário</p>
            </Card>
          )}

          <Card>
            <p className="text-xs text-navy-50 uppercase tracking-wider">Performance</p>
            <div className="mt-2 space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-navy-50">CTR</span>
                <span className="text-sm font-semibold text-navy-dark">{ctr.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-navy-50">CPC</span>
                <span className="text-sm font-semibold text-navy-dark">{formatBRL(s?.cpc || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-navy-50">Impressões</span>
                <span className="text-sm font-semibold text-navy-dark">{totalImpressions.toLocaleString()}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Row 3: Daily Chart + Status */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Daily Chart */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <CardTitle>Gasto vs Leads por Dia</CardTitle>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-navy-15 inline-block" /> Gasto</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gold inline-block" /> Leads</span>
            </div>
          </div>
          <div className="mt-4 flex items-end gap-1 h-40">
            {daily.map((d, i) => {
              const spend = parseFloat(d.spend || "0");
              const dLeads = extractLeads(d);
              const spendH = (spend / dailyMaxSpend) * 100;
              const leadsH = (dLeads / dailyMaxLeads) * 100;
              const date = d.date_start?.split("-").slice(1).join("/") || "";

              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div className="w-full flex items-end gap-0.5" style={{ height: "120px" }}>
                    <div
                      className="flex-1 bg-navy-15 rounded-t transition-all hover:bg-navy-30"
                      style={{ height: `${Math.max(spendH, 3)}%` }}
                      title={`Gasto: ${formatBRL(spend)}`}
                    />
                    <div
                      className="flex-1 bg-gold rounded-t transition-all hover:bg-gold-light"
                      style={{ height: `${Math.max(leadsH, 3)}%` }}
                      title={`Leads: ${dLeads}`}
                    />
                  </div>
                  <span className="text-[10px] text-navy-30">{date}</span>
                  {/* Tooltip */}
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-navy-dark text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                    {formatBRL(spend)} | {dLeads} leads
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Status + Source */}
        <div className="space-y-4">
          <Card>
            <CardTitle>Status dos Leads</CardTitle>
            <div className="mt-3 space-y-2">
              {Object.entries(byStatus)
                .sort((a, b) => b[1] - a[1])
                .map(([status, count]) => (
                  <div key={status} className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${statusColors[status] || "bg-gray-300"}`} />
                    <span className="text-sm text-navy-70 flex-1">{statusLabels[status] || status}</span>
                    <span className="text-sm font-semibold text-navy-dark">{count}</span>
                  </div>
                ))}
            </div>
          </Card>

          <Card>
            <CardTitle>Por Origem</CardTitle>
            <div className="mt-3 space-y-2">
              {Object.entries(bySource)
                .sort((a, b) => b[1] - a[1])
                .map(([source, count]) => (
                  <div key={source} className="flex items-center justify-between">
                    <Badge variant="gold">{source}</Badge>
                    <span className="text-sm font-semibold text-navy-dark">{count}</span>
                  </div>
                ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Row 4: Hourly Heatmap + Placements */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Hourly Heatmap */}
        <Card>
          <CardTitle>Mapa de Calor por Horário</CardTitle>
          <p className="text-xs text-navy-30 mt-1">Leads por hora do dia (últimos 7 dias)</p>
          <div className="mt-4 grid grid-cols-12 gap-1">
            {hourlyData.map((h) => {
              const intensity = maxHourlyLeads > 0 ? h.leads / maxHourlyLeads : 0;
              const bg = intensity === 0
                ? "bg-gray-50"
                : intensity < 0.25
                  ? "bg-gold-lightest"
                  : intensity < 0.5
                    ? "bg-gold-lighter"
                    : intensity < 0.75
                      ? "bg-gold-light"
                      : "bg-gold";

              return (
                <div
                  key={h.hour}
                  className={`${bg} rounded aspect-square flex flex-col items-center justify-center relative group cursor-default`}
                  title={`${h.hour}h: ${h.leads} leads | ${formatBRL(h.spend)}`}
                >
                  <span className="text-[9px] text-navy-50">{h.hour}h</span>
                  {h.leads > 0 && (
                    <span className="text-[10px] font-bold text-navy-dark">{h.leads}</span>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Placements */}
        <Card>
          <CardTitle>Performance por Posicionamento</CardTitle>
          <div className="mt-4 space-y-3">
            {topPlacements.map((p, i) => {
              const plLeads = p.leadCount;
              const plSpend = parseFloat(p.spend || "0");
              const plCpl = plLeads > 0 ? plSpend / plLeads : 0;
              const label = `${p.publisher_platform || ""} ${(p.platform_position || "").replace("instagram_", "").replace("_", " ")}`;

              return (
                <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  {i === 0 && <Badge variant="gold">Top</Badge>}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-navy-dark capitalize">{label}</p>
                    <p className="text-xs text-navy-50">
                      {parseInt(p.impressions || "0").toLocaleString()} impressões
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-navy-dark">{plLeads} leads</p>
                    <p className="text-xs text-navy-50">
                      CPL: {plCpl > 0 ? formatBRL(plCpl) : "—"}
                    </p>
                  </div>
                </div>
              );
            })}
            {topPlacements.length === 0 && (
              <p className="text-sm text-navy-30 text-center py-4">Sem dados de posicionamento</p>
            )}
          </div>
        </Card>
      </div>

      {/* Row 5: Campaign Performance + Income Breakdown */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Top Campaigns */}
        <Card>
          <div className="flex items-center justify-between">
            <CardTitle>Leads por Campanha</CardTitle>
            <Link href="/admin/campaigns" className="text-xs text-gold hover:underline">Ver todas</Link>
          </div>
          <div className="mt-4 space-y-3">
            {Object.entries(byCampaign)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8)
              .map(([name, count]) => (
                <div key={name} className="flex items-center gap-3">
                  <span className="text-sm text-navy-70 truncate flex-1">{name}</span>
                  <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden shrink-0">
                    <div
                      className="h-full bg-gold rounded-full"
                      style={{ width: `${(count / (leads.length || 1)) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-navy-dark w-8 text-right shrink-0">{count}</span>
                </div>
              ))}
          </div>
        </Card>

        {/* Income Breakdown */}
        <Card>
          <CardTitle>Leads por Faixa de Renda</CardTitle>
          <div className="mt-4 space-y-2">
            {Object.entries(byIncome)
              .sort((a, b) => b[1].total - a[1].total)
              .map(([income, data]) => {
                const isQualified = isQualifiedIncome(income);
                return (
                  <div key={income} className={`flex items-center justify-between p-2 rounded ${isQualified ? "bg-success/5" : ""}`}>
                    <div className="flex items-center gap-2">
                      {isQualified && <span className="w-2 h-2 rounded-full bg-success shrink-0" />}
                      <span className={`text-sm ${isQualified ? "text-success font-medium" : "text-navy-70"}`}>{income}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-navy-dark">{data.total}</span>
                      {isQualified && (
                        <Badge variant="success">30k+</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </Card>
      </div>

      {/* Row 6: Recent Leads */}
      <Card>
        <div className="flex items-center justify-between">
          <CardTitle>Leads Recentes</CardTitle>
          <Link href="/admin/leads" className="text-xs text-gold hover:underline">Ver todos</Link>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-3 py-2 font-medium text-navy-70">Nome</th>
                <th className="text-left px-3 py-2 font-medium text-navy-70">Origem</th>
                <th className="text-left px-3 py-2 font-medium text-navy-70">Renda</th>
                <th className="text-left px-3 py-2 font-medium text-navy-70">Campanha</th>
                <th className="text-left px-3 py-2 font-medium text-navy-70">Score</th>
                <th className="text-left px-3 py-2 font-medium text-navy-70">Data</th>
              </tr>
            </thead>
            <tbody>
              {recentLeads.map((lead) => {
                const isQualified = isQualifiedIncome(lead.monthly_income);
                return (
                  <tr key={lead.id} className={`border-b border-gray-50 ${isQualified ? "bg-success/5" : ""}`}>
                    <td className="px-3 py-2">
                      <Link href={`/admin/leads/${lead.id}`} className="text-navy-dark font-medium hover:text-gold transition-colors">
                        {lead.full_name}
                      </Link>
                      <p className="text-xs text-navy-30">{lead.email}</p>
                    </td>
                    <td className="px-3 py-2"><Badge variant="gold">{lead.source || "N/A"}</Badge></td>
                    <td className={`px-3 py-2 text-sm ${isQualified ? "text-success font-semibold" : "text-navy-70"}`}>
                      {lead.monthly_income || "N/A"}
                    </td>
                    <td className="px-3 py-2 text-xs text-navy-50 max-w-[150px] truncate">
                      {lead.campaign_name || lead.utm_campaign || "Direto"}
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-semibold text-navy-dark">{lead.qualification_score}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-navy-50">{formatDate(lead.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Row 7: Worst Campaign Alert */}
      {worstCampaign && worstCampaign !== bestCampaign && (
        <Card>
          <div className="flex items-start gap-3">
            <span className="text-warning text-xl shrink-0">&#9888;</span>
            <div>
              <p className="text-sm font-semibold text-navy-dark">Campanha com maior CPL</p>
              <p className="text-sm text-navy-50 mt-1">
                <span className="font-medium text-navy-dark">{worstCampaign.campaign_name}</span>
                {" — "}CPL: {formatBRL(worstCampaign.cost_per_lead || (parseFloat(worstCampaign.spend || "0") / (worstCampaign.leadCount || 1)))}
                {" | "}{worstCampaign.leadCount} leads | {formatBRL(parseFloat(worstCampaign.spend || "0"))} gasto
              </p>
              <p className="text-xs text-navy-30 mt-1">Considere otimizar ou pausar esta campanha</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
