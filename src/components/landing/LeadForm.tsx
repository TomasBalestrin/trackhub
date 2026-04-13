"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { INCOME_OPTIONS, HOW_FOUND_OPTIONS, BRAZILIAN_STATES } from "@/types/lead";
import { useUTMParams } from "@/hooks/useUTMParams";
import { useMetaPixel } from "@/hooks/useMetaPixel";
import { formatPhone } from "@/lib/utils";

const STATE_OPTIONS = BRAZILIAN_STATES.map((s) => ({ value: s, label: s }));

export function LeadForm() {
  const utmParams = useUTMParams();
  const { fireEvent, generateEventId } = useMetaPixel();

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    monthly_income: "",
    city: "",
    state: "",
    how_found: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  function handleChange(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function handlePhoneChange(value: string) {
    handleChange("phone", formatPhone(value));
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};

    if (!formData.full_name || formData.full_name.trim().split(/\s+/).length < 2) {
      errs.full_name = "Informe nome e sobrenome";
    }
    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errs.email = "E-mail inválido";
    }
    const phoneDigits = formData.phone.replace(/\D/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      errs.phone = "Telefone inválido";
    }
    if (!formData.monthly_income) errs.monthly_income = "Selecione sua faixa de renda";
    if (!formData.city || formData.city.length < 2) errs.city = "Informe sua cidade";
    if (!formData.state) errs.state = "Selecione seu estado";
    if (!formData.how_found) errs.how_found = "Selecione como nos conheceu";

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);

    const eventIdLead = generateEventId();
    const eventIdComplete = generateEventId();

    try {
      const response = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          ...utmParams,
          landing_page_url: window.location.href,
          referrer: document.referrer || null,
          user_agent: navigator.userAgent,
          event_id_lead: eventIdLead,
          event_id_complete_registration: eventIdComplete,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Fire Lead event via Pixel + CAPI
        fireEvent("Lead", {
          eventId: eventIdLead,
          fbclid: utmParams.fbclid,
          fbc: utmParams.fbc,
          fbp: utmParams.fbp,
          userData: {
            em: formData.email,
            ph: formData.phone,
            fn: formData.full_name.split(" ")[0],
            ln: formData.full_name.split(" ").slice(1).join(" "),
          },
        });

        // Store eventId for thank-you page
        sessionStorage.setItem("bethel_event_id_complete", eventIdComplete);

        window.location.href = "/obrigado";
      } else {
        setErrors({ form: data.error || "Erro ao enviar. Tente novamente." });
      }
    } catch {
      setErrors({ form: "Erro de conexão. Tente novamente." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        id="full_name"
        label="Nome completo"
        placeholder="Seu nome completo"
        value={formData.full_name}
        onChange={(e) => handleChange("full_name", e.target.value)}
        error={errors.full_name}
      />

      <Input
        id="email"
        label="E-mail"
        type="email"
        placeholder="seu@email.com"
        value={formData.email}
        onChange={(e) => handleChange("email", e.target.value)}
        error={errors.email}
      />

      <Input
        id="phone"
        label="WhatsApp"
        type="tel"
        placeholder="(00) 00000-0000"
        value={formData.phone}
        onChange={(e) => handlePhoneChange(e.target.value)}
        error={errors.phone}
      />

      <Select
        id="monthly_income"
        label="Qual sua renda mensal?"
        placeholder="Selecione"
        options={[...INCOME_OPTIONS]}
        value={formData.monthly_income}
        onChange={(e) => handleChange("monthly_income", e.target.value)}
        error={errors.monthly_income}
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          id="city"
          label="Cidade"
          placeholder="Sua cidade"
          value={formData.city}
          onChange={(e) => handleChange("city", e.target.value)}
          error={errors.city}
        />
        <Select
          id="state"
          label="Estado"
          placeholder="UF"
          options={[...STATE_OPTIONS]}
          value={formData.state}
          onChange={(e) => handleChange("state", e.target.value)}
          error={errors.state}
        />
      </div>

      <Select
        id="how_found"
        label="Como nos conheceu?"
        placeholder="Selecione"
        options={[...HOW_FOUND_OPTIONS]}
        value={formData.how_found}
        onChange={(e) => handleChange("how_found", e.target.value)}
        error={errors.how_found}
      />

      {errors.form && (
        <p className="text-sm text-error text-center bg-red-50 p-3 rounded-[var(--radius-md)]">
          {errors.form}
        </p>
      )}

      <Button type="submit" variant="gold" size="lg" loading={loading} className="w-full mt-2">
        Quero participar da aula ao vivo
      </Button>

      <p className="text-xs text-navy-30 text-center">
        Seus dados estão seguros e não serão compartilhados.
      </p>
    </form>
  );
}
