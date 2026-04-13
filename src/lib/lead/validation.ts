import { z } from "zod/v4";

export const leadFormSchema = z.object({
  full_name: z
    .string()
    .min(3, "Nome deve ter pelo menos 3 caracteres")
    .refine((val) => val.trim().split(/\s+/).length >= 2, {
      message: "Informe nome e sobrenome",
    }),
  email: z.string().email("E-mail inválido"),
  phone: z
    .string()
    .min(10, "Telefone inválido")
    .max(15, "Telefone inválido")
    .refine((val) => /^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/.test(val.replace(/\s/g, "")), {
      message: "Formato de telefone inválido",
    }),
  monthly_income: z.string().min(1, "Selecione sua faixa de renda"),
  city: z.string().min(2, "Informe sua cidade"),
  state: z.string().min(2, "Selecione seu estado"),
  how_found: z.string().min(1, "Selecione como nos conheceu"),

  // Hidden tracking fields
  utm_source: z.string().nullable().optional(),
  utm_medium: z.string().nullable().optional(),
  utm_campaign: z.string().nullable().optional(),
  utm_content: z.string().nullable().optional(),
  utm_term: z.string().nullable().optional(),
  fbclid: z.string().nullable().optional(),
  fbc: z.string().nullable().optional(),
  fbp: z.string().nullable().optional(),
  ad_name: z.string().nullable().optional(),
  adset_name: z.string().nullable().optional(),
  campaign_name: z.string().nullable().optional(),
  creative_type: z.string().nullable().optional(),
  ad_id: z.string().nullable().optional(),
  adset_id: z.string().nullable().optional(),
  campaign_id: z.string().nullable().optional(),
  landing_page_url: z.string().nullable().optional(),
  referrer: z.string().nullable().optional(),
  user_agent: z.string().nullable().optional(),
});

export type LeadFormData = z.infer<typeof leadFormSchema>;
