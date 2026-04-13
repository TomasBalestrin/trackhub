import pino from "pino";

// Logger estruturado JSON. Vercel captura stdout automaticamente e
// parseia JSON; localmente sai JSON também (use `npm run dev | npx pino-pretty`
// se quiser leitura humana).
//
// Evitamos `transport` aqui porque Next.js + worker threads do pino-pretty
// têm conflitos de bundling em alguns cenários. JSON simples é robusto.
export const log = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
  base: { app: "bethel-track" },
  formatters: {
    level: (label) => ({ level: label }),
  },
});
