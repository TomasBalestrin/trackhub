import { describe, it, expect } from "vitest";
import { leadFormSchema } from "./validation";

const validBase = {
  full_name: "João Silva",
  email: "joao@example.com",
  phone: "(11) 91234-5678",
  monthly_income: "R$30.000+",
  city: "São Paulo",
  state: "SP",
  how_found: "instagram",
};

describe("leadFormSchema", () => {
  it("accepts a minimally valid lead", () => {
    const r = leadFormSchema.safeParse(validBase);
    expect(r.success).toBe(true);
  });

  describe("full_name", () => {
    it("rejects names with fewer than 3 chars", () => {
      const r = leadFormSchema.safeParse({ ...validBase, full_name: "Jo" });
      expect(r.success).toBe(false);
    });

    it("rejects single-word names (precisa nome + sobrenome)", () => {
      const r = leadFormSchema.safeParse({ ...validBase, full_name: "João" });
      expect(r.success).toBe(false);
    });

    it("accepts names with extra whitespace between words", () => {
      const r = leadFormSchema.safeParse({ ...validBase, full_name: "João   Silva" });
      expect(r.success).toBe(true);
    });
  });

  describe("email", () => {
    it("rejects missing @", () => {
      const r = leadFormSchema.safeParse({ ...validBase, email: "joao.example.com" });
      expect(r.success).toBe(false);
    });

    it("rejects empty string", () => {
      const r = leadFormSchema.safeParse({ ...validBase, email: "" });
      expect(r.success).toBe(false);
    });
  });

  describe("phone", () => {
    it.each([
      "(11) 91234-5678",
      "11912345678",
      "(11)91234-5678",
      "11 91234 5678",
    ])("accepts BR-shaped %s", (phone) => {
      const r = leadFormSchema.safeParse({ ...validBase, phone });
      expect(r.success).toBe(true);
    });

    it("rejects too short", () => {
      const r = leadFormSchema.safeParse({ ...validBase, phone: "12345" });
      expect(r.success).toBe(false);
    });

    it("rejects letters in the digits", () => {
      const r = leadFormSchema.safeParse({ ...validBase, phone: "(11) ABCDE-5678" });
      expect(r.success).toBe(false);
    });
  });

  describe("required selects", () => {
    it.each(["monthly_income", "city", "state", "how_found"] as const)(
      "rejects empty %s",
      (field) => {
        const r = leadFormSchema.safeParse({ ...validBase, [field]: "" });
        expect(r.success).toBe(false);
      }
    );
  });

  describe("optional tracking fields", () => {
    it("accepts all UTM fields as null", () => {
      const r = leadFormSchema.safeParse({
        ...validBase,
        utm_source: null,
        fbclid: null,
        ad_id: null,
      });
      expect(r.success).toBe(true);
    });

    it("accepts all UTM fields as strings", () => {
      const r = leadFormSchema.safeParse({
        ...validBase,
        utm_source: "facebook",
        fbclid: "abc123",
        ad_id: "999",
      });
      expect(r.success).toBe(true);
    });

    it("accepts UTM fields omitted entirely", () => {
      const r = leadFormSchema.safeParse(validBase);
      expect(r.success).toBe(true);
    });
  });
});
