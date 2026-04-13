"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DateRangePicker } from "@/components/admin/date-range-picker";
import { formatDate } from "@/lib/utils";
import { getScoreLabel, extractHighestIncome, isQualifiedIncome } from "@/lib/lead/qualification";
import { filterByDateRange } from "@/lib/date-range";
import { useSharedDateRange } from "@/hooks/useSharedDateRange";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import type { Lead, LeadStatus } from "@/types/lead";
import { INCOME_OPTIONS } from "@/types/lead";

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "new", label: "Novo" },
  { value: "contacted", label: "Contactado" },
  { value: "qualified", label: "Qualificado" },
  { value: "converted", label: "Convertido" },
  { value: "lost", label: "Perdido" },
];

const STATUS_BADGES: Record<LeadStatus, "default" | "info" | "warning" | "success" | "error"> = {
  new: "info",
  contacted: "warning",
  qualified: "gold" as "warning",
  converted: "success",
  lost: "error",
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Novo",
  contacted: "Contactado",
  qualified: "Qualificado",
  converted: "Convertido",
  lost: "Perdido",
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [incomeFilter, setIncomeFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [qualifiedOnly, setQualifiedOnly] = useState(false);
  const [dateRange, setDateRange] = useSharedDateRange();

  async function loadLeads() {
    const res = await fetch("/api/admin/leads");
    const data = await res.json();
    setLeads((data as Lead[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    loadLeads();
  }, []);

  useAutoRefresh(loadLeads, 60_000);

  // Build source options from data
  const sourceOptions = [
    { value: "", label: "Todas as origens" },
    ...Array.from(new Set(leads.map((l) => l.source).filter(Boolean))).map((s) => ({
      value: s as string,
      label: s as string,
    })),
  ];

  // Janela de data aplicada antes dos filtros de conteúdo: KPIs e tabela refletem o período.
  const leadsInRange = filterByDateRange(leads, dateRange);

  const qualifiedCount = leadsInRange.filter(
    (l) => isQualifiedIncome(l.monthly_income)
  ).length;

  const filteredLeads = leadsInRange.filter((lead) => {
    if (statusFilter && lead.status !== statusFilter) return false;
    if (incomeFilter) {
      if (!lead.monthly_income) return false;
      const [minStr, maxStr] = incomeFilter.split("_");
      const min = parseInt(minStr, 10);
      const max = parseInt(maxStr, 10);
      const income = extractHighestIncome(lead.monthly_income);
      if (income < min || income > max) return false;
    }
    if (sourceFilter && lead.source !== sourceFilter) return false;
    if (qualifiedOnly && !isQualifiedIncome(lead.monthly_income)) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        lead.full_name.toLowerCase().includes(q) ||
        lead.email.toLowerCase().includes(q) ||
        lead.phone.includes(q)
      );
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-dark">Leads</h1>
          <p className="text-sm text-navy-50">
            {leadsInRange.length} no período · {leads.length} no total
          </p>
        </div>
        <button
          onClick={() => setQualifiedOnly(!qualifiedOnly)}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            qualifiedOnly
              ? "bg-gold text-white"
              : "bg-white border border-gold text-gold hover:bg-gold/10"
          }`}
        >
          Qualificados 30k+ ({qualifiedCount})
        </button>
      </div>

      <DateRangePicker value={dateRange} onChange={setDateRange} align="left" />

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="w-64">
          <Input
            placeholder="Buscar por nome, email ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-40">
          <Select
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            placeholder="Status"
          />
        </div>
        <div className="w-44">
          <Select
            options={sourceOptions}
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            placeholder="Origem"
          />
        </div>
        <div className="w-48">
          <Select
            options={[{ value: "", label: "Todas as rendas" }, ...INCOME_OPTIONS]}
            value={incomeFilter}
            onChange={(e) => setIncomeFilter(e.target.value)}
            placeholder="Renda"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-navy-70">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-navy-70">Origem</th>
                <th className="text-left px-4 py-3 font-medium text-navy-70">Telefone</th>
                <th className="text-left px-4 py-3 font-medium text-navy-70">Renda</th>
                <th className="text-left px-4 py-3 font-medium text-navy-70">Campanha</th>
                <th className="text-left px-4 py-3 font-medium text-navy-70">Score</th>
                <th className="text-left px-4 py-3 font-medium text-navy-70">Status</th>
                <th className="text-left px-4 py-3 font-medium text-navy-70">Data</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => (
                <tr key={lead.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/admin/leads/${lead.id}`} className="text-navy-dark font-medium hover:text-gold transition-colors">
                      {lead.full_name}
                    </Link>
                    <p className="text-xs text-navy-30">{lead.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="gold">{lead.source || "N/A"}</Badge>
                  </td>
                  <td className="px-4 py-3 text-navy-70">{lead.phone}</td>
                  <td className="px-4 py-3">
                    <span className={`${isQualifiedIncome(lead.monthly_income) ? "text-success font-semibold" : "text-navy-70"}`}>
                      {lead.monthly_income || "N/A"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-navy-50 truncate max-w-[150px] block">
                      {lead.campaign_name || lead.utm_campaign || "Direto"}
                    </span>
                    {lead.ad_name && (
                      <span className="text-xs text-navy-30 block truncate max-w-[150px]">
                        {lead.ad_name}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-navy-dark">{lead.qualification_score}</span>
                    <span className="text-xs text-navy-30 ml-1">{getScoreLabel(lead.qualification_score)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_BADGES[lead.status]}>{STATUS_LABELS[lead.status]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-navy-50">{formatDate(lead.created_at)}</td>
                </tr>
              ))}
              {filteredLeads.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-navy-30">
                    Nenhum lead encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
