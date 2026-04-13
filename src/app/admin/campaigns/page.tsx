"use client";

import { useEffect, useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { extractHighestIncome } from "@/lib/lead/qualification";
import type { MetaCampaignCache } from "@/types/lead";

interface LeadData {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  campaign_name: string | null;
  ad_name: string | null;
  adset_name: string | null;
  qualification_score: number;
  monthly_income: string | null;
  position: string | null;
  source: string | null;
  status: string;
  created_at: string;
  utm_source: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
}

interface CampaignGroup {
  campaign_name: string;
  campaign_id: string;
  status: string;
  objective: string | null;
  daily_budget: number | null;
  ads: MetaCampaignCache[];
  leads: LeadData[];
  qualified_leads: number;
  total_leads: number;
  avg_score: number;
  top_position: string;
  top_income: string;
}

interface InsightsRow {
  campaign_name?: string;
  campaign_id?: string;
  impressions?: string;
  clicks?: string;
  spend?: string;
  cpc?: string;
  ctr?: string;
  reach?: string;
  leads?: number;
  cost_per_lead?: number;
}

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "ACTIVE", label: "Ativas" },
  { value: "PAUSED", label: "Pausadas" },
  { value: "DELETED", label: "Desativadas" },
];

const PERIOD_OPTIONS = [
  { value: "last_7d", label: "7 dias" },
  { value: "last_14d", label: "14 dias" },
  { value: "last_30d", label: "30 dias" },
];

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignGroup[]>([]);
  const [insights, setInsights] = useState<InsightsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [period, setPeriod] = useState("last_7d");
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const { formatBRL } = useExchangeRate();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadInsights();
  }, [period]);

  async function loadData() {
    const res = await fetch("/api/admin/campaigns");
    const data = await res.json();

    const campaignsData = (data.campaigns || []) as MetaCampaignCache[];
    const leadsData = (data.leads || []) as LeadData[];

    // Group by campaign_name
    const grouped: Record<string, CampaignGroup> = {};

    campaignsData.forEach((c) => {
      const name = c.campaign_name || "Sem nome";
      if (!grouped[name]) {
        grouped[name] = {
          campaign_name: name,
          campaign_id: c.campaign_id,
          status: c.status || "UNKNOWN",
          objective: c.objective,
          daily_budget: c.daily_budget,
          ads: [],
          leads: [],
          qualified_leads: 0,
          total_leads: 0,
          avg_score: 0,
          top_position: "N/A",
          top_income: "N/A",
        };
      }
      grouped[name].ads.push(c);
      // Use most relevant status (ACTIVE > PAUSED > others)
      if (c.status === "ACTIVE") grouped[name].status = "ACTIVE";
    });

    // Assign leads to campaigns
    leadsData.forEach((lead) => {
      const name = lead.campaign_name || lead.utm_campaign || "";
      if (grouped[name]) {
        grouped[name].leads.push(lead);
      }
    });

    // Compute stats
    Object.values(grouped).forEach((g) => {
      g.total_leads = g.leads.length;
      g.qualified_leads = g.leads.filter(
        (l) => l.monthly_income && extractHighestIncome(l.monthly_income) >= 30000
      ).length;

      if (g.leads.length > 0) {
        g.avg_score = Math.round(
          g.leads.reduce((sum, l) => sum + l.qualification_score, 0) / g.leads.length
        );

        // Most common position
        const positions: Record<string, number> = {};
        g.leads.forEach((l) => {
          if (l.position) positions[l.position] = (positions[l.position] || 0) + 1;
        });
        const topPos = Object.entries(positions).sort((a, b) => b[1] - a[1])[0];
        if (topPos) g.top_position = topPos[0];

        // Most common income range
        const incomes: Record<string, number> = {};
        g.leads.forEach((l) => {
          if (l.monthly_income) incomes[l.monthly_income] = (incomes[l.monthly_income] || 0) + 1;
        });
        const topInc = Object.entries(incomes).sort((a, b) => b[1] - a[1])[0];
        if (topInc) g.top_income = topInc[0];
      }
    });

    const sorted = Object.values(grouped).sort((a, b) => {
      if (a.status === "ACTIVE" && b.status !== "ACTIVE") return -1;
      if (b.status === "ACTIVE" && a.status !== "ACTIVE") return 1;
      return b.total_leads - a.total_leads;
    });

    setCampaigns(sorted);
    setLoading(false);
  }

  async function loadInsights() {
    try {
      const res = await fetch(`/api/admin/insights?type=campaigns&date_preset=${period}`);
      const data = await res.json();
      setInsights(data.data || []);
    } catch {
      setInsights([]);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/admin/campaigns", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setSyncResult(`Sincronizado: ${data.upserted}/${data.total} anúncios`);
        loadData();
      } else {
        setSyncResult("Erro: " + (data.error || "falha desconhecida"));
      }
    } catch {
      setSyncResult("Erro de conexão");
    }
    setSyncing(false);
  }

  function getInsight(campaignName: string): InsightsRow | null {
    return insights.find((i) => i.campaign_name === campaignName) || null;
  }

  const filtered = campaigns.filter((c) => {
    if (statusFilter && c.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return c.campaign_name.toLowerCase().includes(q);
    }
    return true;
  });

  // Summary KPIs
  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE").length;
  const totalLeadsAll = campaigns.reduce((s, c) => s + c.total_leads, 0);
  const totalQualified = campaigns.reduce((s, c) => s + c.qualified_leads, 0);

  // Alerts
  const noLeadCampaigns = campaigns.filter(
    (c) => c.status === "ACTIVE" && c.total_leads === 0
  );

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-dark">Campanhas</h1>
          <p className="text-sm text-navy-50">Gestão e performance das campanhas Meta Ads</p>
        </div>
        <div className="flex items-center gap-3">
          <Select options={PERIOD_OPTIONS} value={period} onChange={(e) => setPeriod(e.target.value)} />
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 bg-gold text-white text-sm font-semibold rounded-lg hover:bg-gold/90 transition-colors disabled:opacity-50"
          >
            {syncing ? "Sincronizando..." : "Sync Meta"}
          </button>
        </div>
      </div>

      {syncResult && (
        <div className="text-sm px-4 py-2 rounded-lg bg-info/10 text-info">{syncResult}</div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <p className="text-sm text-navy-50">Total Campanhas</p>
          <p className="text-3xl font-bold text-navy-dark">{totalCampaigns}</p>
        </Card>
        <Card>
          <p className="text-sm text-navy-50">Ativas</p>
          <p className="text-3xl font-bold text-success">{activeCampaigns}</p>
        </Card>
        <Card>
          <p className="text-sm text-navy-50">Leads Capturados</p>
          <p className="text-3xl font-bold text-gold">{totalLeadsAll}</p>
        </Card>
        <Card>
          <p className="text-sm text-navy-50">Qualificados (30k+)</p>
          <p className="text-3xl font-bold text-success">
            {totalQualified}
            {totalLeadsAll > 0 && (
              <span className="text-sm font-normal text-navy-50 ml-2">
                ({Math.round((totalQualified / totalLeadsAll) * 100)}%)
              </span>
            )}
          </p>
        </Card>
      </div>

      {/* Alerts */}
      {noLeadCampaigns.length > 0 && (
        <Card>
          <div className="flex items-start gap-3">
            <span className="text-warning text-xl">&#9888;</span>
            <div>
              <p className="text-sm font-semibold text-navy-dark">
                {noLeadCampaigns.length} campanha(s) ativa(s) sem leads
              </p>
              <p className="text-xs text-navy-50 mt-1">
                {noLeadCampaigns.map((c) => c.campaign_name).join(", ")}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="w-72">
          <Input
            placeholder="Buscar campanha..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-44">
          <Select
            options={STATUS_FILTER_OPTIONS}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Campaign List */}
      <div className="space-y-4">
        {filtered.map((campaign) => {
          const insight = getInsight(campaign.campaign_name);
          const isExpanded = expandedCampaign === campaign.campaign_name;

          return (
            <div key={campaign.campaign_name} className="rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] overflow-hidden bg-white">
              {/* Campaign Header */}
              <button
                onClick={() => setExpandedCampaign(isExpanded ? null : campaign.campaign_name)}
                className="w-full text-left p-5 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-base font-semibold text-navy-dark">{campaign.campaign_name}</h3>
                      <Badge variant={campaign.status === "ACTIVE" ? "success" : campaign.status === "PAUSED" ? "warning" : "default"}>
                        {campaign.status === "ACTIVE" ? "Ativa" : campaign.status === "PAUSED" ? "Pausada" : "Desativada"}
                      </Badge>
                      {campaign.qualified_leads > 0 && (
                        <Badge variant="gold">{campaign.qualified_leads} qualificados</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-navy-50">
                      <span>{campaign.ads.length} anúncio(s)</span>
                      {campaign.objective && <span>Objetivo: {campaign.objective}</span>}
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="flex items-center gap-6 text-right">
                    <div>
                      <p className="text-xs text-navy-50">Leads</p>
                      <p className="text-lg font-bold text-navy-dark">{campaign.total_leads}</p>
                    </div>
                    {insight && (
                      <>
                        <div>
                          <p className="text-xs text-navy-50">Gasto</p>
                          <p className="text-lg font-bold text-navy-dark">
                            {formatBRL(parseFloat(insight.spend || "0"))}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-navy-50">CPL</p>
                          <p className={`text-lg font-bold ${insight.cost_per_lead && insight.cost_per_lead > 0 ? "text-navy-dark" : "text-navy-30"}`}>
                            {insight.cost_per_lead && insight.cost_per_lead > 0
                              ? formatBRL(insight.cost_per_lead)
                              : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-navy-50">CTR</p>
                          <p className="text-lg font-bold text-navy-dark">
                            {parseFloat(insight.ctr || "0").toFixed(2)}%
                          </p>
                        </div>
                      </>
                    )}
                    <svg
                      className={`w-5 h-5 text-navy-30 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Performance Bar */}
                {insight && parseFloat(insight.impressions || "0") > 0 && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs text-navy-30 w-16">Impressões</span>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gold rounded-full" style={{ width: `${Math.min(parseFloat(insight.ctr || "0") * 10, 100)}%` }} />
                    </div>
                    <span className="text-xs text-navy-50 w-20 text-right">{parseInt(insight.impressions || "0").toLocaleString()}</span>
                  </div>
                )}
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="border-t border-gray-100 p-5 space-y-6">
                  {/* Campaign Intelligence */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-navy-50">Score Médio</p>
                      <p className="text-xl font-bold text-navy-dark">{campaign.avg_score}/100</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-navy-50">Cargo Mais Comum</p>
                      <p className="text-sm font-semibold text-navy-dark">{campaign.top_position}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-navy-50">Renda Mais Comum</p>
                      <p className="text-sm font-semibold text-navy-dark truncate">{campaign.top_income}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-navy-50">Taxa Qualificação</p>
                      <p className="text-xl font-bold text-success">
                        {campaign.total_leads > 0 ? Math.round((campaign.qualified_leads / campaign.total_leads) * 100) : 0}%
                      </p>
                    </div>
                  </div>

                  {/* Ads Table */}
                  <div>
                    <h4 className="text-sm font-semibold text-navy-dark mb-3">Anúncios ({campaign.ads.length})</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left px-3 py-2 font-medium text-navy-70">Anúncio</th>
                            <th className="text-left px-3 py-2 font-medium text-navy-70">Conjunto</th>
                            <th className="text-left px-3 py-2 font-medium text-navy-70">Tipo</th>
                            <th className="text-left px-3 py-2 font-medium text-navy-70">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {campaign.ads.map((ad) => (
                            <tr key={ad.id} className="border-b border-gray-50">
                              <td className="px-3 py-2 text-navy-dark font-medium">{ad.ad_name || "N/A"}</td>
                              <td className="px-3 py-2 text-navy-50">{ad.adset_name || "N/A"}</td>
                              <td className="px-3 py-2">
                                <Badge variant={ad.creative_type === "VIDEO" ? "info" : "default"}>
                                  {ad.creative_type || "N/A"}
                                </Badge>
                              </td>
                              <td className="px-3 py-2">
                                <Badge variant={ad.status === "ACTIVE" ? "success" : "default"}>
                                  {ad.status || "N/A"}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Leads Table */}
                  {campaign.leads.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-navy-dark mb-3">
                        Leads ({campaign.total_leads})
                        {campaign.qualified_leads > 0 && (
                          <span className="text-success font-normal ml-2">
                            ({campaign.qualified_leads} qualificados)
                          </span>
                        )}
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                              <th className="text-left px-3 py-2 font-medium text-navy-70">Nome</th>
                              <th className="text-left px-3 py-2 font-medium text-navy-70">Renda</th>
                              <th className="text-left px-3 py-2 font-medium text-navy-70">Cargo</th>
                              <th className="text-left px-3 py-2 font-medium text-navy-70">Score</th>
                              <th className="text-left px-3 py-2 font-medium text-navy-70">Status</th>
                              <th className="text-left px-3 py-2 font-medium text-navy-70">Anúncio</th>
                              <th className="text-left px-3 py-2 font-medium text-navy-70">Data</th>
                            </tr>
                          </thead>
                          <tbody>
                            {campaign.leads
                              .sort((a, b) => b.qualification_score - a.qualification_score)
                              .map((lead) => {
                                const isQualified = lead.monthly_income && extractHighestIncome(lead.monthly_income) >= 30000;
                                return (
                                  <tr key={lead.id} className={`border-b border-gray-50 ${isQualified ? "bg-success/5" : ""}`}>
                                    <td className="px-3 py-2">
                                      <a href={`/admin/leads/${lead.id}`} className="text-navy-dark font-medium hover:text-gold transition-colors">
                                        {lead.full_name}
                                      </a>
                                      <p className="text-xs text-navy-30">{lead.email}</p>
                                    </td>
                                    <td className={`px-3 py-2 text-sm ${isQualified ? "text-success font-semibold" : "text-navy-70"}`}>
                                      {lead.monthly_income || "N/A"}
                                    </td>
                                    <td className="px-3 py-2 text-navy-70">{lead.position || "N/A"}</td>
                                    <td className="px-3 py-2">
                                      <span className="font-semibold text-navy-dark">{lead.qualification_score}</span>
                                    </td>
                                    <td className="px-3 py-2">
                                      <Badge variant={lead.status === "converted" ? "success" : lead.status === "new" ? "info" : "default"}>
                                        {lead.status}
                                      </Badge>
                                    </td>
                                    <td className="px-3 py-2 text-xs text-navy-50 max-w-[150px] truncate">
                                      {lead.ad_name || lead.utm_content || "—"}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-navy-50">{formatDate(lead.created_at)}</td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {campaign.leads.length === 0 && (
                    <div className="text-center py-6">
                      <p className="text-sm text-navy-30">Nenhum lead capturado por esta campanha</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <Card>
            <p className="text-navy-50 text-center py-8">Nenhuma campanha encontrada.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
