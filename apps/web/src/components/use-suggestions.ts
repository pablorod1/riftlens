"use client";

import { useEffect, useState } from "react";
import type { SuggestionDto } from "@/app/api/search/route";

/**
 * Sugerencias de invocadores mientras se escribe (con pausa de 150 ms y
 * cancelando la petición anterior). Solo cuando aún no se ha escrito el tag.
 */
export function useSuggestions(query: string, region: string, lang: string) {
  const [items, setItems] = useState<SuggestionDto[]>([]);
  const q = query.trim();
  const active = q.length >= 2 && !q.includes("#");

  useEffect(() => {
    if (!active) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?${new URLSearchParams({ q, region, lang })}`, { signal: ctrl.signal });
        if (res.ok) setItems((await res.json()) as SuggestionDto[]);
      } catch {
        /* cancelada o sin red: nos quedamos con lo que había */
      }
    }, 150);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q, region, lang, active]);

  // Mientras llega la respuesta nueva, no mostramos resultados de un texto anterior
  const lower = q.toLowerCase();
  return active ? items.filter((i) => i.gameName.toLowerCase().startsWith(lower)) : [];
}
