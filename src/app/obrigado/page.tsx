"use client";

import { useEffect, useRef, useState } from "react";
import { useMetaPixel } from "@/hooks/useMetaPixel";
import { useUTMParams } from "@/hooks/useUTMParams";
import { Button } from "@/components/ui/button";

const WHATSAPP_URL = process.env.NEXT_PUBLIC_WHATSAPP_GROUP_URL || "#";

export default function ThankYouPage() {
  const { fireEvent } = useMetaPixel();
  const utmParams = useUTMParams();
  const firedEvent = useRef(false);
  const [countdown, setCountdown] = useState(5);

  // Fire CompleteRegistration
  useEffect(() => {
    if (firedEvent.current) return;
    firedEvent.current = true;

    const eventId =
      typeof window !== "undefined"
        ? sessionStorage.getItem("bethel_event_id_complete") || undefined
        : undefined;

    fireEvent("CompleteRegistration", {
      eventId,
      fbclid: utmParams.fbclid,
      fbc: utmParams.fbc,
      fbp: utmParams.fbp,
    });
  }, [fireEvent, utmParams]);

  // Countdown auto-redirect
  useEffect(() => {
    if (WHATSAPP_URL === "#") return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          window.open(WHATSAPP_URL, "_blank");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-navy-dark to-navy flex items-center justify-center px-4">
      <div className="bg-white rounded-[var(--radius-xl)] p-8 sm:p-12 max-w-lg w-full text-center shadow-[var(--shadow-xl)]">
        {/* Success Icon */}
        <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-navy-dark mb-2">
          Parabéns!
        </h1>
        <p className="text-navy-50 mb-8">
          Sua inscrição foi confirmada com sucesso. Agora entre no nosso grupo
          de WhatsApp para receber todas as informações da aula ao vivo.
        </p>

        <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
          <Button variant="gold" size="lg" className="w-full gap-3">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Entrar no grupo do WhatsApp
          </Button>
        </a>

        {countdown > 0 && WHATSAPP_URL !== "#" && (
          <p className="text-sm text-navy-30 mt-4">
            Redirecionando automaticamente em {countdown}s...
          </p>
        )}

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-navy-30">
            Caso o link não abra automaticamente, clique no botão acima.
          </p>
        </div>
      </div>
    </main>
  );
}
