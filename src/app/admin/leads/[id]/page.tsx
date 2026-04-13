"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import { getScoreLabel } from "@/lib/lead/qualification";
import type { Lead, LeadStatus, TrackingEvent } from "@/types/lead";

const STATUS_OPTIONS = [
  { value: "new", label: "Novo" },
  { value: "contacted", label: "Contactado" },
  { value: "qualified", label: "Qualificado" },
  { value: "converted", label: "Convertido" },
  { value: "lost", label: "Perdido" },
];

export default function LeadDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [lead, setLead] = useState<Lead | null>(null);
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/admin/leads/${id}`);
      const data = await res.json();

      setLead(data.lead as Lead | null);
      setEvents((data.events as TrackingEvent[]) || []);
      setLoading(false);
    }
    load();
  }, [id]);

  async function updateStatus(newStatus: string) {
    if (!lead) return;
    await fetch(`/api/admin/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setLead({ ...lead, status: newStatus as LeadStatus });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!lead) {
    return <p className="text-navy-50">Lead não encontrado.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/leads" className="text-sm text-navy-50 hover:text-gold transition-colors">
          &larr; Voltar
        </Link>
        <h1 className="text-2xl font-bold text-navy-dark">{lead.full_name}</h1>
        <Badge variant={lead.qualification_score >= 80 ? "success" : lead.qualification_score >= 50 ? "warning" : "default"}>
          Score {lead.qualification_score} - {getScoreLabel(lead.qualification_score)}
        </Badge>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Personal Data */}
        <Card>
          <CardTitle>Dados Pessoais</CardTitle>
          <div className="mt-4 space-y-3">
            <InfoRow label="Nome" value={lead.full_name} />
            <InfoRow label="E-mail" value={lead.email} />
            <InfoRow label="Telefone" value={lead.phone} />
            <InfoRow label="Renda" value={lead.monthly_income || "N/A"} />
            <InfoRow label="Cidade" value={lead.city || "N/A"} />
            <InfoRow label="Estado" value={lead.state || "N/A"} />
            <InfoRow label="Como conheceu" value={lead.how_found || "N/A"} />
            <InfoRow label="Origem" value={lead.source || "N/A"} />
            <InfoRow label="Cargo" value={lead.position || "N/A"} />
          </div>
        </Card>

        {/* Status + Score */}
        <Card>
          <CardTitle>Gestão</CardTitle>
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-sm font-medium text-navy-dark block mb-1">Status</label>
              <Select
                options={STATUS_OPTIONS}
                value={lead.status}
                onChange={(e) => updateStatus(e.target.value)}
              />
            </div>
            <InfoRow label="Score de Qualificação" value={`${lead.qualification_score}/100 (${getScoreLabel(lead.qualification_score)})`} />
            <InfoRow label="WhatsApp enviado" value={lead.whatsapp_group_sent ? "Sim" : "Não"} />
            <InfoRow label="Cadastrado em" value={formatDate(lead.created_at)} />
          </div>
        </Card>

        {/* Attribution */}
        <Card>
          <CardTitle>Atribuição (Meta Ads)</CardTitle>
          <div className="mt-4 space-y-3">
            <InfoRow label="Campanha" value={lead.campaign_name || "N/A"} />
            <InfoRow label="Conjunto" value={lead.adset_name || "N/A"} />
            <InfoRow label="Anúncio" value={lead.ad_name || "N/A"} />
            <InfoRow label="Tipo Criativo" value={lead.creative_type || "N/A"} />
            <InfoRow label="fbclid" value={lead.fbclid || "N/A"} />
          </div>
        </Card>

        {/* UTM Data */}
        <Card>
          <CardTitle>UTM Parameters</CardTitle>
          <div className="mt-4 space-y-3">
            <InfoRow label="Source" value={lead.utm_source || "N/A"} />
            <InfoRow label="Medium" value={lead.utm_medium || "N/A"} />
            <InfoRow label="Campaign" value={lead.utm_campaign || "N/A"} />
            <InfoRow label="Content" value={lead.utm_content || "N/A"} />
            <InfoRow label="Term" value={lead.utm_term || "N/A"} />
            <InfoRow label="Referrer" value={lead.referrer || "Direto"} />
            <InfoRow label="Landing Page" value={lead.landing_page_url || "N/A"} />
          </div>
        </Card>
      </div>

      {/* Event Timeline */}
      <Card>
        <CardTitle>Timeline de Eventos</CardTitle>
        <div className="mt-4">
          {events.length === 0 ? (
            <p className="text-sm text-navy-30">Nenhum evento registrado</p>
          ) : (
            <div className="space-y-4">
              {events.map((event) => {
                const payload = (event.payload || {}) as Record<string, unknown>;
                const buttonText = payload.button_text as string | undefined;
                const eventColors: Record<string, string> = {
                  PageView: "bg-info",
                  ViewContent: "bg-warning",
                  ButtonClick: "bg-gold",
                  Lead: "bg-success",
                  CompleteRegistration: "bg-success",
                };
                return (
                  <div key={event.id} className="flex items-start gap-4 relative pl-6">
                    <div className={`absolute left-0 top-2 w-3 h-3 rounded-full ${eventColors[event.event_name] || "bg-gold"}`} />
                    <div>
                      <p className="text-sm font-medium text-navy-dark">
                        {event.event_name}
                        {buttonText && <span className="text-navy-50 font-normal"> — &quot;{buttonText}&quot;</span>}
                      </p>
                      <p className="text-xs text-navy-50">{formatDate(event.event_time)}</p>
                      <p className="text-xs text-navy-30">
                        Fonte: {event.event_source} | CAPI: {event.capi_sent ? "Enviado" : "Pendente"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Conversion timestamps from lead record */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-xs font-medium text-navy-50 mb-2">Timestamps de Conversão</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <span className="text-navy-30">PageView:</span>
              <span className="text-navy-70">{lead.page_view_at ? formatDate(lead.page_view_at) : "—"}</span>
              <span className="text-navy-30">ViewContent:</span>
              <span className="text-navy-70">{lead.view_content_at ? formatDate(lead.view_content_at) : "—"}</span>
              <span className="text-navy-30">Lead:</span>
              <span className="text-navy-70">{lead.lead_at ? formatDate(lead.lead_at) : "—"}</span>
              <span className="text-navy-30">CompleteRegistration:</span>
              <span className="text-navy-70">{lead.complete_registration_at ? formatDate(lead.complete_registration_at) : "—"}</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-navy-50">{label}</span>
      <span className="text-sm font-medium text-navy-dark text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}
