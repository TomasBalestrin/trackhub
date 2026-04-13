"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { DateRangePicker } from "@/components/admin/date-range-picker";
import { extractHighestIncome, isQualifiedIncome } from "@/lib/lead/qualification";
import { filterByDateRange } from "@/lib/date-range";
import { useSharedDateRange } from "@/hooks/useSharedDateRange";
import type { Lead } from "@/types/lead";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OverviewData {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  actions?: { action_type: string; value: string }[];
}

interface DailyEntry {
  date_start: string;
  spend: number;
  impressions: number;
  clicks: number;
  actions?: { action_type: string; value: string }[];
}

interface CampaignEntry {
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  actions?: { action_type: string; value: string }[];
}

type Period = "today" | "last_7d" | "last_14d" | "last_30d";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PERIOD_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "last_7d", label: "7 dias" },
  { value: "last_14d", label: "14 dias" },
  { value: "last_30d", label: "30 dias" },
] as const;

function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR");
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function extractLeads(actions?: { action_type: string; value: string }[]): number {
  if (!actions) return 0;
  const lead = actions.find((a) => a.action_type === "lead");
  return lead ? parseInt(lead.value, 10) || 0 : 0;
}

function extractLandingPageViews(actions?: { action_type: string; value: string }[]): number {
  if (!actions) return 0;
  const lpv = actions.find((a) => a.action_type === "landing_page_view");
  return lpv ? parseInt(lpv.value, 10) || 0 : 0;
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdsPage() {
  const { formatBRL } = useExchangeRate();
  const [period, setPeriod] = useState<Period>("last_7d");
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [daily, setDaily] = useState<DailyEntry[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignEntry[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useSharedDateRange();

  const fetchData = useCallback(async (p: Period) => {
    setLoading(true);
    setError(null);

    try {
      const [overviewRes, dailyRes, campaignsRes, leadsRes] = await Promise.all([
        fetch(`/api/admin/insights?type=overview&date_preset=${p}`),
        fetch(`/api/admin/insights?type=daily&date_preset=${p}`),
        fetch(`/api/admin/insights?type=campaigns&date_preset=${p}`),
        fetch("/api/admin/leads"),
      ]);

      if (!overviewRes.ok || !dailyRes.ok || !campaignsRes.ok || !leadsRes.ok) {
        throw new Error("Falha ao carregar dados da API");
      }

      const [overviewData, dailyData, campaignsData, leadsData] = await Promise.all([
        overviewRes.json(),
        dailyRes.json(),
        campaignsRes.json(),
        leadsRes.json(),
      ]);

      const overviewRow = Array.isArray(overviewData?.data) ? overviewData.data[0] : null;
      const overviewSummary = overviewData?.summary;
      setOverview(
        overviewRow
          ? {
              spend: Number(overviewRow.spend) || 0,
              impressions: Number(overviewRow.impressions) || 0,
              clicks: Number(overviewRow.clicks) || 0,
              ctr: Number(overviewRow.ctr) || overviewSummary?.avg_ctr || 0,
              actions: overviewRow.actions,
            }
          : overviewSummary
            ? {
                spend: overviewSummary.total_spend,
                impressions: overviewSummary.total_impressions,
                clicks: overviewSummary.total_clicks,
                ctr: overviewSummary.avg_ctr,
                actions: [],
              }
            : null
      );

      const dailyRows = Array.isArray(dailyData?.data) ? dailyData.data : Array.isArray(dailyData) ? dailyData : [];
      setDaily(
        dailyRows.map((d: Record<string, unknown>) => ({
          date_start: String(d.date_start ?? ""),
          spend: Number(d.spend) || 0,
          impressions: Number(d.impressions) || 0,
          clicks: Number(d.clicks) || 0,
          actions: d.actions as DailyEntry["actions"],
        }))
      );

      const campaignRows = Array.isArray(campaignsData?.data)
        ? campaignsData.data
        : Array.isArray(campaignsData)
          ? campaignsData
          : [];
      setCampaigns(
        campaignRows.map((c: Record<string, unknown>) => ({
          campaign_name: String(c.campaign_name ?? ""),
          spend: Number(c.spend) || 0,
          impressions: Number(c.impressions) || 0,
          clicks: Number(c.clicks) || 0,
          ctr: Number(c.ctr) || 0,
          actions: c.actions as CampaignEntry["actions"],
        }))
      );

      setLeads(Array.isArray(leadsData) ? leadsData : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(period);
  }, [period, fetchData]);

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const totalSpend = overview?.spend ?? 0;
  const totalLeads = extractLeads(overview?.actions);
  const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const ctr = overview?.ctr ?? 0;

  const totalImpressions = overview?.impressions ?? 0;
  const totalClicks = overview?.clicks ?? 0;
  const totalLandingPageViews = extractLandingPageViews(overview?.actions);

  const leadsInRange = useMemo(() => filterByDateRange(leads, dateRange), [leads, dateRange]);
  const qualifiedCount = useMemo(() => {
    return leadsInRange.filter((l) => isQualifiedIncome(l.monthly_income)).length;
  }, [leadsInRange]);

  // Campaign table sorted by leads desc
  const sortedCampaigns = useMemo(() => {
    return [...campaigns].sort((a, b) => extractLeads(b.actions) - extractLeads(a.actions));
  }, [campaigns]);

  const avgCPL = useMemo(() => {
    const withLeads = sortedCampaigns.filter((c) => extractLeads(c.actions) > 0);
    if (withLeads.length === 0) return 0;
    const totalS = withLeads.reduce((sum, c) => sum + c.spend, 0);
    const totalL = withLeads.reduce((sum, c) => sum + extractLeads(c.actions), 0);
    return totalL > 0 ? totalS / totalL : 0;
  }, [sortedCampaigns]);

  // Chart scaling
  const chartMaxSpend = useMemo(() => Math.max(...daily.map((d) => d.spend), 1), [daily]);
  const chartMaxLeads = useMemo(() => Math.max(...daily.map((d) => extractLeads(d.actions)), 1), [daily]);

  // ---------------------------------------------------------------------------
  // Funnel data
  // ---------------------------------------------------------------------------

  const funnelSteps = useMemo(() => {
    const steps = [
      { label: "Impressoes", value: totalImpressions },
      { label: "Cliques", value: totalClicks },
      { label: "Landing Page Views", value: totalLandingPageViews },
      { label: "Leads", value: totalLeads },
      { label: "Qualificados (30k+)", value: qualifiedCount },
    ];

    return steps.map((step, i) => ({
      ...step,
      rate: i === 0 ? 100 : steps[i - 1].value > 0 ? (step.value / steps[i - 1].value) * 100 : 0,
    }));
  }, [totalImpressions, totalClicks, totalLandingPageViews, totalLeads, qualifiedCount]);

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-dark">Performance de Ads</h1>
          <p className="text-sm text-navy-50">Dados da Meta Marketing API</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <div className="w-44">
            <Select
              options={PERIOD_OPTIONS}
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
            />
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <Card>
          <p className="text-error text-center py-4">{error}</p>
        </Card>
      )}

      {/* Section 1: KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="gold">
          <p className="text-xs font-medium text-navy-50 uppercase tracking-wide">Total Gasto</p>
          <p className="text-2xl font-bold text-navy-dark mt-1">{formatBRL(totalSpend)}</p>
        </Card>
        <Card variant="gold">
          <p className="text-xs font-medium text-navy-50 uppercase tracking-wide">Total Leads</p>
          <p className="text-2xl font-bold text-navy-dark mt-1">{formatNumber(totalLeads)}</p>
        </Card>
        <Card variant="gold">
          <p className="text-xs font-medium text-navy-50 uppercase tracking-wide">CPL - Custo por Lead</p>
          <p className="text-2xl font-bold text-navy-dark mt-1">
            {totalLeads > 0 ? formatBRL(cpl) : "—"}
          </p>
        </Card>
        <Card variant="gold">
          <p className="text-xs font-medium text-navy-50 uppercase tracking-wide">CTR</p>
          <p className="text-2xl font-bold text-navy-dark mt-1">{formatPercent(ctr)}</p>
        </Card>
      </div>

      {/* Section 2: Spend vs Leads Chart */}
      <Card>
        <CardTitle className="text-navy-dark mb-4">Gasto vs Leads (por dia)</CardTitle>
        {daily.length === 0 ? (
          <p className="text-navy-50 text-center py-8">Nenhum dado diario disponivel</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex items-end gap-1 min-w-fit" style={{ minHeight: 220 }}>
              {daily.map((day) => {
                const dayLeads = extractLeads(day.actions);
                const spendHeight = (day.spend / chartMaxSpend) * 180;
                const leadsHeight = (dayLeads / chartMaxLeads) * 180;

                return (
                  <div key={day.date_start} className="flex flex-col items-center group" style={{ minWidth: 48 }}>
                    {/* Bars */}
                    <div className="flex items-end gap-0.5" style={{ height: 180 }}>
                      {/* Spend bar */}
                      <div className="relative flex flex-col items-center">
                        <div
                          className="w-4 rounded-t bg-navy-dark transition-all duration-300 group-hover:opacity-80"
                          style={{ height: Math.max(spendHeight, 2) }}
                        />
                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full mb-1 hidden group-hover:block bg-navy-dark text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                          {formatBRL(day.spend)}
                        </div>
                      </div>
                      {/* Leads bar */}
                      <div className="relative flex flex-col items-center">
                        <div
                          className="w-4 rounded-t bg-gold transition-all duration-300 group-hover:opacity-80"
                          style={{ height: Math.max(leadsHeight, 2) }}
                        />
                        <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gold text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                          {dayLeads} leads
                        </div>
                      </div>
                    </div>
                    {/* X label */}
                    <span className="text-[10px] text-navy-50 mt-1 rotate-[-45deg] origin-top-left whitespace-nowrap">
                      {formatDateShort(day.date_start)}
                    </span>
                  </div>
                );
              })}
            </div>
            {/* Legend */}
            <div className="flex items-center gap-4 mt-6">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-navy-dark inline-block" />
                <span className="text-xs text-navy-50">Gasto</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-gold inline-block" />
                <span className="text-xs text-navy-50">Leads</span>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Section 3: Campaign Comparison Table */}
      <Card>
        <CardTitle className="text-navy-dark mb-4">Comparativo de Campanhas</CardTitle>
        {sortedCampaigns.length === 0 ? (
          <p className="text-navy-50 text-center py-8">Nenhuma campanha encontrada</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-navy-70">Campanha</th>
                  <th className="text-right px-4 py-3 font-medium text-navy-70">Impressoes</th>
                  <th className="text-right px-4 py-3 font-medium text-navy-70">Cliques</th>
                  <th className="text-right px-4 py-3 font-medium text-navy-70">Gasto</th>
                  <th className="text-right px-4 py-3 font-medium text-navy-70">Leads</th>
                  <th className="text-right px-4 py-3 font-medium text-navy-70">CPL</th>
                  <th className="text-right px-4 py-3 font-medium text-navy-70">CTR</th>
                </tr>
              </thead>
              <tbody>
                {sortedCampaigns.map((campaign) => {
                  const campLeads = extractLeads(campaign.actions);
                  const campCPL = campLeads > 0 ? campaign.spend / campLeads : 0;
                  const isBelowAvgCPL = campLeads > 0 && campCPL < avgCPL;

                  return (
                    <tr
                      key={campaign.campaign_name}
                      className={`border-b border-gray-100 transition-colors ${
                        isBelowAvgCPL ? "bg-green-50/60" : "hover:bg-gray-50"
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-navy-dark max-w-[240px] truncate">
                        {campaign.campaign_name || "Sem nome"}
                        {isBelowAvgCPL && (
                          <Badge variant="success" className="ml-2">CPL abaixo da media</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-navy-70">
                        {formatNumber(campaign.impressions)}
                      </td>
                      <td className="px-4 py-3 text-right text-navy-70">
                        {formatNumber(campaign.clicks)}
                      </td>
                      <td className="px-4 py-3 text-right text-navy-70">
                        {formatBRL(campaign.spend)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-navy-dark">
                        {formatNumber(campLeads)}
                      </td>
                      <td className="px-4 py-3 text-right text-navy-70">
                        {campLeads > 0 ? formatBRL(campCPL) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-navy-70">
                        {formatPercent(campaign.ctr)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Section 4: Funnel Visual */}
      <Card>
        <CardTitle className="text-navy-dark mb-6">Funil de Conversao</CardTitle>
        <div className="space-y-3">
          {funnelSteps.map((step, i) => {
            // Width narrows as we go down the funnel
            const widthPercent = funnelSteps[0].value > 0
              ? Math.max((step.value / funnelSteps[0].value) * 100, 8)
              : 100 - i * 18;

            const colors = [
              "bg-navy-dark",
              "bg-navy-dark/80",
              "bg-gold/80",
              "bg-gold",
              "bg-success",
            ];

            return (
              <div key={step.label} className="flex flex-col items-center">
                <div
                  className={`${colors[i]} rounded-lg py-3 px-4 text-white text-center transition-all duration-500 relative`}
                  style={{ width: `${widthPercent}%`, minWidth: 160 }}
                >
                  <span className="font-bold text-sm">{step.label}</span>
                  <span className="block text-lg font-bold">{formatNumber(step.value)}</span>
                  {i > 0 && (
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[11px] font-semibold text-navy-50">
                      {formatPercent(step.rate)}
                    </span>
                  )}
                </div>
                {i < funnelSteps.length - 1 && (
                  <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-t-[8px] border-l-transparent border-r-transparent border-t-navy-dark/20 my-1" />
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
