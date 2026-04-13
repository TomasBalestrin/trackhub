"use client";

import { useEffect, useRef } from "react";

/**
 * Dispara `fn` a cada `intervalMs` enquanto a aba estiver visível.
 * Pausa quando o usuário troca de aba/minimiza, e refaz uma chamada
 * imediata ao retornar (catch-up).
 */
export function useAutoRefresh(fn: () => void, intervalMs = 60_000) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    function start() {
      if (timer) return;
      timer = setInterval(() => fnRef.current(), intervalMs);
    }
    function stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    }
    function onVisibility() {
      if (document.visibilityState === "visible") {
        fnRef.current(); // catch-up imediato
        start();
      } else {
        stop();
      }
    }

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs]);
}
