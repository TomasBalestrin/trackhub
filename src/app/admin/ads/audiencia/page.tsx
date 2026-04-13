"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { useExchangeRate } from "@/hooks/useExchangeRate";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface ActionItem {
  action_type: string;
  value: string;
}

interface InsightRow {
  impressions?: string;
  clicks?: string;
  spend?: string;
  ctr?: string;
  actions?: ActionItem[];
  cost_per_action_type?: ActionItem[];
  leads: number;
  cost_per_lead: number;
  // demographics
  age?: string;
  gender?: string;
  // hourly
  hourly_stats_aggregated_by_advertiser_time_zone?: string;
  // placements
  publisher_platform?: string;
  platform_position?: string;
  // regions
  region?: string;
}

interface InsightResponse {
  data: InsightRow[];
  summary: Record<string, number>;
}

/* Aggregated types */
interface AgeGenderGroup {
  age: string;
  gender: string;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  cpl: number;
}

interface AgeAggregate {
  age: string;
  male: AgeGenderGroup | null;
  female: AgeGenderGroup | null;
  totalLeads: number;
  totalSpend: number;
}

interface HourData {
  hour: string;
  leads: number;
}

interface PlacementData {
  name: string;
  impressions: number;
  clicks: number;
  leads: number;
  spend: number;
  cpl: number;
  ctr: number;
}

interface RegionData {
  region: string;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function extractLeads(row: InsightRow): number {
  if (row.leads) return row.leads;
  if (!row.actions) return 0;
  const a = row.actions.find((x) => x.action_type === "lead");
  return a ? parseInt(a.value, 10) : 0;
}

function extractCPL(row: InsightRow): number {
  if (row.cost_per_lead) return row.cost_per_lead;
  if (!row.cost_per_action_type) return 0;
  const a = row.cost_per_action_type.find((x) => x.action_type === "lead");
  return a ? parseFloat(a.value) : 0;
}

function n(val: string | undefined): number {
  return parseInt(val || "0", 10);
}

function f(val: string | undefined): number {
  return parseFloat(val || "0");
}

function fmt(value: number): string {
  return value.toLocaleString("pt-BR");
}

function money(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const PERIOD_OPTIONS = [
  { value: "last_7d", label: "Ultimos 7 dias" },
  { value: "last_14d", label: "Ultimos 14 dias" },
  { value: "last_30d", label: "Ultimos 30 dias" },
  { value: "today", label: "Hoje" },
] as const;

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function AudienciaPage() {
  const { formatBRL } = useExchangeRate();
  const [period, setPeriod] = useState("last_7d");
  const [loading, setLoading] = useState(true);

  const [demographics, setDemographics] = useState<InsightRow[]>([]);
  const [placements, setPlacements] = useState<InsightRow[]>([]);
  const [hourly, setHourly] = useState<InsightRow[]>([]);
  const [regions, setRegions] = useState<InsightRow[]>([]);

  const load = useCallback(async (p: string) => {
    setLoading(true);
    try {
      const [demRes, plcRes, hrRes, regRes] = await Promise.all([
        fetch(`/api/admin/insights?type=demographics&date_preset=${p}`),
        fetch(`/api/admin/insights?type=placements&date_preset=${p}`),
        fetch(`/api/admin/insights?type=hourly&date_preset=last_7d`),
        fetch(`/api/admin/insights?type=regions&date_preset=${p}`),
      ]);

      const [demJson, plcJson, hrJson, regJson]: InsightResponse[] = await Promise.all([
        demRes.json(),
        plcRes.json(),
        hrRes.json(),
        regRes.json(),
      ]);

      setDemographics(demJson.data || []);
      setPlacements(plcJson.data || []);
      setHourly(hrJson.data || []);
      setRegions(regJson.data || []);
    } catch (err) {
      console.error("Failed to load audience data", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(period);
  }, [period, load]);

  /* ---------- derived data ---------- */

  // Demographics: aggregate by age
  const ageMap = new Map<string, AgeAggregate>();
  demographics.forEach((row) => {
    const age = row.age || "unknown";
    const gender = row.gender || "unknown";
    if (!ageMap.has(age)) {
      ageMap.set(age, { age, male: null, female: null, totalLeads: 0, totalSpend: 0 });
    }
    const agg = ageMap.get(age)!;
    const entry: AgeGenderGroup = {
      age,
      gender,
      impressions: n(row.impressions),
      clicks: n(row.clicks),
      spend: f(row.spend),
      leads: extractLeads(row),
      cpl: extractCPL(row),
    };
    if (gender === "male") agg.male = entry;
    else if (gender === "female") agg.female = entry;
    agg.totalLeads += entry.leads;
    agg.totalSpend += entry.spend;
  });
  const ageGroups = Array.from(ageMap.values()).sort((a, b) => a.age.localeCompare(b.age));
  const maxAgeLeads = Math.max(1, ...ageGroups.map((g) => g.totalLeads));

  // Best demographic segment
  let bestSegment = { age: "-", gender: "-", cpl: 0 };
  demographics.forEach((row) => {
    const leads = extractLeads(row);
    const cpl = extractCPL(row);
    if (leads > 0 && (bestSegment.cpl === 0 || (cpl > 0 && cpl < bestSegment.cpl))) {
      bestSegment = { age: row.age || "-", gender: row.gender === "male" ? "Masculino" : "Feminino", cpl };
    }
  });

  // Hourly heatmap
  const hourMap = new Map<string, number>();
  hourly.forEach((row) => {
    const hour = row.hourly_stats_aggregated_by_advertiser_time_zone || "0";
    const leads = extractLeads(row);
    hourMap.set(hour, (hourMap.get(hour) || 0) + leads);
  });
  const hours: HourData[] = Array.from({ length: 24 }, (_, i) => ({
    hour: String(i),
    leads: hourMap.get(String(i)) || 0,
  }));
  const maxHourLeads = Math.max(1, ...hours.map((h) => h.leads));
  const peakHour = hours.reduce((a, b) => (b.leads > a.leads ? b : a), hours[0]);

  // Placements
  const placementMap = new Map<string, PlacementData>();
  placements.forEach((row) => {
    const platform = row.publisher_platform || "unknown";
    const position = row.platform_position || "";
    const name = position ? `${platform} - ${position}` : platform;
    const simpleName = platform.charAt(0).toUpperCase() + platform.slice(1);
    const key = simpleName;

    if (!placementMap.has(key)) {
      placementMap.set(key, { name: key, impressions: 0, clicks: 0, leads: 0, spend: 0, cpl: 0, ctr: 0 });
    }
    const p = placementMap.get(key)!;
    p.impressions += n(row.impressions);
    p.clicks += n(row.clicks);
    p.leads += extractLeads(row);
    p.spend += f(row.spend);
  });
  const placementList = Array.from(placementMap.values()).map((p) => ({
    ...p,
    cpl: p.leads > 0 ? p.spend / p.leads : 0,
    ctr: p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0,
  }));
  placementList.sort((a, b) => b.leads - a.leads);
  const bestPlacement = placementList[0]?.name || "-";

  // Regions: top 10
  const regionMap = new Map<string, RegionData>();
  regions.forEach((row) => {
    const region = row.region || "unknown";
    if (!regionMap.has(region)) {
      regionMap.set(region, { region, impressions: 0, clicks: 0, spend: 0, leads: 0 });
    }
    const r = regionMap.get(region)!;
    r.impressions += n(row.impressions);
    r.clicks += n(row.clicks);
    r.spend += f(row.spend);
    r.leads += extractLeads(row);
  });
  const regionList = Array.from(regionMap.values())
    .sort((a, b) => b.leads - a.leads)
    .slice(0, 10);
  const maxRegionLeads = Math.max(1, ...regionList.map((r) => r.leads));

  /* ---------- heatmap color ---------- */
  function heatColor(leads: number): string {
    if (leads === 0) return "bg-white";
    const ratio = leads / maxHourLeads;
    if (ratio < 0.25) return "bg-amber-100";
    if (ratio < 0.5) return "bg-amber-200";
    if (ratio < 0.75) return "bg-amber-300";
    return "bg-gold";
  }

  /* ------------------------------------------------------------------ */
  /* Render                                                              */
  /* ------------------------------------------------------------------ */

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-dark">Analise de Audiencia</h1>
          <p className="text-sm text-navy-50">Demografia, posicionamento e horarios</p>
        </div>
        <div className="w-48">
          <Select
            options={PERIOD_OPTIONS as unknown as { value: string; label: string }[]}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
        </div>
      </div>

      {/* Section 1: Demographics */}
      <section className="space-y-4">
        <CardTitle className="text-navy-dark">Demografico (Idade + Genero)</CardTitle>

        {ageGroups.length === 0 ? (
          <Card>
            <p className="text-navy-50 text-center py-6">Sem dados demograficos para o periodo.</p>
          </Card>
        ) : (
          <>
            <div className="space-y-3">
              {ageGroups.map((group) => {
                const maleLeads = group.male?.leads || 0;
                const femaleLeads = group.female?.leads || 0;
                const totalLeads = maleLeads + femaleLeads;
                const barWidth = (totalLeads / maxAgeLeads) * 100;
                const maleWidth = totalLeads > 0 ? (maleLeads / totalLeads) * barWidth : 0;
                const femaleWidth = totalLeads > 0 ? (femaleLeads / totalLeads) * barWidth : 0;

                return (
                  <Card key={group.age} className="py-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-navy-dark">{group.age}</span>
                      <div className="flex items-center gap-3 text-xs text-navy-70">
                        <span>{fmt(totalLeads)} leads</span>
                        {group.totalLeads > 0 && (
                          <span>CPL {formatBRL(group.totalSpend / group.totalLeads)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex h-5 rounded overflow-hidden bg-gray-100">
                      {maleWidth > 0 && (
                        <div
                          className="bg-navy-dark transition-all duration-300"
                          style={{ width: `${maleWidth}%` }}
                          title={`Masculino: ${maleLeads} leads`}
                        />
                      )}
                      {femaleWidth > 0 && (
                        <div
                          className="bg-gold transition-all duration-300"
                          style={{ width: `${femaleWidth}%` }}
                          title={`Feminino: ${femaleLeads} leads`}
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-navy-50">
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-navy-dark inline-block" />
                        Masc: {fmt(maleLeads)}
                        {group.male?.cpl ? ` (${formatBRL(group.male.cpl)})` : ""}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-gold inline-block" />
                        Fem: {fmt(femaleLeads)}
                        {group.female?.cpl ? ` (${formatBRL(group.female.cpl)})` : ""}
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>

            {bestSegment.cpl > 0 && (
              <Card variant="gold">
                <p className="text-sm text-navy-dark">
                  <span className="font-semibold">Seu melhor publico:</span>{" "}
                  {bestSegment.age} {bestSegment.gender} com CPL de{" "}
                  <span className="font-bold text-success">{formatBRL(bestSegment.cpl)}</span>
                </p>
              </Card>
            )}
          </>
        )}
      </section>

      {/* Section 2: Hourly Heatmap */}
      <section className="space-y-4">
        <CardTitle className="text-navy-dark">Heatmap por Horario</CardTitle>

        <Card>
          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-1.5">
            {hours.map((h) => (
              <div
                key={h.hour}
                className={`${heatColor(h.leads)} rounded-md flex flex-col items-center justify-center p-2 border border-gray-100 transition-colors`}
              >
                <span className="text-[10px] text-navy-50 font-medium">{h.hour}h</span>
                <span className="text-sm font-bold text-navy-dark">{h.leads}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs text-navy-50">
            <span>Menos</span>
            <span className="w-4 h-4 rounded bg-white border border-gray-200" />
            <span className="w-4 h-4 rounded bg-amber-100" />
            <span className="w-4 h-4 rounded bg-amber-200" />
            <span className="w-4 h-4 rounded bg-amber-300" />
            <span className="w-4 h-4 rounded bg-gold" />
            <span>Mais</span>
          </div>
        </Card>

        {peakHour && peakHour.leads > 0 && (
          <Card variant="gold">
            <p className="text-sm text-navy-dark">
              <span className="font-semibold">Pico de conversao:</span> {peakHour.hour}h com{" "}
              <span className="font-bold text-success">{fmt(peakHour.leads)} leads</span>
            </p>
          </Card>
        )}
      </section>

      {/* Section 3: Placements */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <CardTitle className="text-navy-dark">Performance por Posicionamento</CardTitle>
          {bestPlacement !== "-" && <Badge variant="gold">Melhor: {bestPlacement}</Badge>}
        </div>

        {placementList.length === 0 ? (
          <Card>
            <p className="text-navy-50 text-center py-6">Sem dados de posicionamento.</p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {placementList.map((p) => {
              const isBest = p.name === bestPlacement;
              return (
                <Card key={p.name} variant={isBest ? "gold" : "default"}>
                  <div className="flex items-center justify-between mb-3">
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    {isBest && <Badge variant="success">Top</Badge>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-navy-50">Impressoes</p>
                      <p className="text-lg font-bold text-navy-dark">{fmt(p.impressions)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-navy-50">Cliques</p>
                      <p className="text-lg font-bold text-navy-dark">{fmt(p.clicks)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-navy-50">Leads</p>
                      <p className="text-lg font-bold text-navy-dark">{fmt(p.leads)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-navy-50">CPL</p>
                      <p className="text-lg font-bold text-navy-dark">{formatBRL(p.cpl)}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-navy-50">CTR</p>
                      <p className="text-lg font-bold text-navy-dark">{p.ctr.toFixed(2)}%</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Section 4: Top Regions */}
      <section className="space-y-4">
        <CardTitle className="text-navy-dark">Top Estados</CardTitle>

        {regionList.length === 0 ? (
          <Card>
            <p className="text-navy-50 text-center py-6">Sem dados de regiao.</p>
          </Card>
        ) : (
          <Card>
            <div className="space-y-3">
              {regionList.map((r, i) => {
                const barWidth = (r.leads / maxRegionLeads) * 100;
                return (
                  <div key={r.region} className="flex items-center gap-3">
                    <span className="w-6 text-xs font-bold text-navy-70 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-navy-dark truncate">
                          {r.region}
                        </span>
                        <div className="flex items-center gap-3 text-xs text-navy-50 flex-shrink-0">
                          <span>{fmt(r.impressions)} imp</span>
                          <span>{fmt(r.clicks)} cliq</span>
                          <span>{formatBRL(r.spend)}</span>
                          <span className="font-bold text-navy-dark">{fmt(r.leads)} leads</span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full bg-gold rounded-full transition-all duration-300"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
