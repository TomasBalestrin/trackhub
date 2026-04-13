"use client";

import { useEffect, useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { DateRangePicker } from "@/components/admin/date-range-picker";
import { useSharedDateRange } from "@/hooks/useSharedDateRange";

interface AdInsight {
  ad_name: string;
  ad_id: string;
  adset_name: string;
  campaign_name: string;
  impressions: string;
  clicks: string;
  spend: string;
  ctr: string;
  reach: string;
  leads: number;
  cost_per_lead: number;
  quality_ranking?: string;
  engagement_rate_ranking?: string;
  conversion_rate_ranking?: string;
}

interface InsightsResponse {
  type: string;
  date_preset: string;
  data: AdInsight[];
  summary: {
    total_impressions: number;
    total_clicks: number;
    total_spend: number;
    total_leads: number;
    avg_ctr: number;
    avg_cost_per_lead: number;
  };
}

function fmt(value: number, decimals = 2): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}


export default function CriativosPage() {
  const [dateRange, setDateRange] = useSharedDateRange();
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const { formatBRL } = useExchangeRate();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const range = dateRange.start && dateRange.end
          ? `since=${encodeURIComponent(dateRange.start)}&until=${encodeURIComponent(dateRange.end)}`
          : "date_preset=last_30d";
        const res = await fetch(`/api/admin/insights?type=ads&${range}`);
        const json: InsightsResponse = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        console.error("Failed to fetch ad insights:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [dateRange.start, dateRange.end]);

  // Filter ads with at least 1 lead
  const adsWithLeads = (data?.data ?? []).filter((ad) => ad.leads > 0);

  // Sort by CPL ascending (best first)
  const ranked = [...adsWithLeads].sort(
    (a, b) => a.cost_per_lead - b.cost_per_lead
  );

  // Winner / Loser
  const bestAd = ranked.length > 0 ? ranked[0] : null;
  const worstAd = ranked.length > 1 ? ranked[ranked.length - 1] : null;

  // Average CTR across ads with leads
  const avgCtr =
    adsWithLeads.length > 0
      ? adsWithLeads.reduce((sum, ad) => sum + parseFloat(ad.ctr || "0"), 0) /
        adsWithLeads.length
      : 0;

  // Video vs Estatico grouping
  function classifyCreativeType(campaignName: string): "video" | "estatico" | "outro" {
    const upper = campaignName.toUpperCase();
    if (upper.includes("VIDEO")) return "video";
    if (upper.includes("EST")) return "estatico";
    return "outro";
  }

  function aggregateGroup(ads: AdInsight[]) {
    const totalLeads = ads.reduce((s, a) => s + a.leads, 0);
    const totalSpend = ads.reduce((s, a) => s + parseFloat(a.spend || "0"), 0);
    const avgCPL = totalLeads > 0 ? totalSpend / totalLeads : 0;
    const avgCTR =
      ads.length > 0
        ? ads.reduce((s, a) => s + parseFloat(a.ctr || "0"), 0) / ads.length
        : 0;
    return { totalLeads, totalSpend, avgCPL, avgCTR, count: ads.length };
  }

  const videoAds = adsWithLeads.filter(
    (ad) => classifyCreativeType(ad.campaign_name) === "video"
  );
  const staticAds = adsWithLeads.filter(
    (ad) => classifyCreativeType(ad.campaign_name) === "estatico"
  );

  const videoStats = aggregateGroup(videoAds);
  const staticStats = aggregateGroup(staticAds);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-dark">
            Ranking de Criativos
          </h1>
          <p className="text-sm text-navy-50">
            Compare performance dos anuncios
          </p>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-2 border-gold border-t-transparent rounded-full" />
        </div>
      )}

      {!loading && (
        <>
          {/* Section 1: Winner vs Loser */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {bestAd && (
              <Card variant="gold">
                <div className="flex items-center gap-2 mb-4">
                  <CardTitle>Melhor Anuncio</CardTitle>
                  <Badge variant="gold">TOP 1</Badge>
                </div>
                <p className="text-base font-semibold text-navy-dark truncate">
                  {bestAd.ad_name}
                </p>
                <p className="text-xs text-navy-50 truncate mb-4">
                  {bestAd.campaign_name}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-navy-50">CPL</p>
                    <p className="text-lg font-bold text-gold">
                      {formatBRL(bestAd.cost_per_lead)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-navy-50">Leads</p>
                    <p className="text-lg font-bold text-navy-dark">
                      {bestAd.leads}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-navy-50">Gasto</p>
                    <p className="text-lg font-bold text-navy-dark">
                      {formatBRL(parseFloat(bestAd.spend || "0"))}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-navy-50">CTR</p>
                    <p className="text-lg font-bold text-navy-dark">
                      {fmt(parseFloat(bestAd.ctr || "0"))}%
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {worstAd && (
              <Card variant="default">
                <div className="flex items-center gap-2 mb-4">
                  <CardTitle>Pior Anuncio</CardTitle>
                  <Badge variant="error">Pior CPL</Badge>
                </div>
                <p className="text-base font-semibold text-navy-dark truncate">
                  {worstAd.ad_name}
                </p>
                <p className="text-xs text-navy-50 truncate mb-4">
                  {worstAd.campaign_name}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-navy-50">CPL</p>
                    <p className="text-lg font-bold text-error">
                      {formatBRL(worstAd.cost_per_lead)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-navy-50">Leads</p>
                    <p className="text-lg font-bold text-navy-dark">
                      {worstAd.leads}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-navy-50">Gasto</p>
                    <p className="text-lg font-bold text-navy-dark">
                      {formatBRL(parseFloat(worstAd.spend || "0"))}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-navy-50">CTR</p>
                    <p className="text-lg font-bold text-navy-dark">
                      {fmt(parseFloat(worstAd.ctr || "0"))}%
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {!bestAd && !worstAd && (
              <Card className="col-span-full">
                <p className="text-navy-50 text-center py-8">
                  Nenhum anuncio com leads encontrado neste periodo.
                </p>
              </Card>
            )}
          </div>

          {/* Section 2: Creative Ranking Table */}
          <Card>
            <CardTitle className="mb-4">Ranking de Criativos</CardTitle>

            {ranked.length === 0 ? (
              <p className="text-navy-50 text-center py-8">
                Sem dados para exibir.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs text-navy-50">
                      <th className="pb-3 pr-4">#</th>
                      <th className="pb-3 pr-4">Anuncio</th>
                      <th className="pb-3 pr-4">Campanha</th>
                      <th className="pb-3 pr-4 text-right">Impressoes</th>
                      <th className="pb-3 pr-4 text-right">Cliques</th>
                      <th className="pb-3 pr-4 text-right">CTR</th>
                      <th className="pb-3 pr-4 text-right">Leads</th>
                      <th className="pb-3 pr-4 text-right">CPL</th>
                      <th className="pb-3 text-right">Gasto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranked.map((ad, index) => {
                      const position = index + 1;
                      const adCtr = parseFloat(ad.ctr || "0");
                      const ctrDiff = adCtr - avgCtr;

                      return (
                        <tr
                          key={ad.ad_id}
                          className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                        >
                          <td className="py-3 pr-4">
                            {position <= 3 ? (
                              <Badge variant="gold">{position}</Badge>
                            ) : (
                              <span className="text-navy-50">{position}</span>
                            )}
                          </td>
                          <td className="py-3 pr-4 font-medium text-navy-dark max-w-[200px] truncate">
                            {ad.ad_name}
                          </td>
                          <td className="py-3 pr-4 text-navy-50 max-w-[180px] truncate">
                            {ad.campaign_name}
                          </td>
                          <td className="py-3 pr-4 text-right text-navy-dark">
                            {parseInt(ad.impressions || "0").toLocaleString("pt-BR")}
                          </td>
                          <td className="py-3 pr-4 text-right text-navy-dark">
                            {parseInt(ad.clicks || "0").toLocaleString("pt-BR")}
                          </td>
                          <td className="py-3 pr-4 text-right">
                            <span className="inline-flex items-center gap-1">
                              {fmt(adCtr)}%
                              {ctrDiff > 0 ? (
                                <span className="text-success text-xs">
                                  &#9650;
                                </span>
                              ) : ctrDiff < 0 ? (
                                <span className="text-error text-xs">
                                  &#9660;
                                </span>
                              ) : null}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-right font-medium text-navy-dark">
                            {ad.leads}
                          </td>
                          <td className="py-3 pr-4 text-right font-medium text-navy-dark">
                            {formatBRL(ad.cost_per_lead)}
                          </td>
                          <td className="py-3 text-right text-navy-dark">
                            {formatBRL(parseFloat(ad.spend || "0"))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Section 3: Video vs Estatico Comparison */}
          <div>
            <h2 className="text-lg font-semibold text-navy-dark mb-4">
              Video vs Estatico
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card variant={videoStats.totalLeads >= staticStats.totalLeads ? "gold" : "default"}>
                <div className="flex items-center gap-2 mb-4">
                  <CardTitle>Video</CardTitle>
                  <Badge variant="info">{videoStats.count} anuncios</Badge>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-navy-50">Leads</p>
                    <p className="text-xl font-bold text-navy-dark">
                      {videoStats.totalLeads}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-navy-50">CPL Medio</p>
                    <p className="text-xl font-bold text-navy-dark">
                      {formatBRL(videoStats.avgCPL)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-navy-50">CTR Medio</p>
                    <p className="text-xl font-bold text-navy-dark">
                      {fmt(videoStats.avgCTR)}%
                    </p>
                  </div>
                </div>
              </Card>

              <Card variant={staticStats.totalLeads > videoStats.totalLeads ? "gold" : "default"}>
                <div className="flex items-center gap-2 mb-4">
                  <CardTitle>Estatico</CardTitle>
                  <Badge variant="info">{staticStats.count} anuncios</Badge>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-navy-50">Leads</p>
                    <p className="text-xl font-bold text-navy-dark">
                      {staticStats.totalLeads}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-navy-50">CPL Medio</p>
                    <p className="text-xl font-bold text-navy-dark">
                      {formatBRL(staticStats.avgCPL)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-navy-50">CTR Medio</p>
                    <p className="text-xl font-bold text-navy-dark">
                      {fmt(staticStats.avgCTR)}%
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
