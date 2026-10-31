"use client";

import { useEffect } from "react";
import { pushRecent, type RecentSummoner } from "@/lib/recent";

/** Guarda el perfil visitado en "Recientes" (solo en este navegador). */
export function RecordVisit(props: Omit<RecentSummoner, "at">) {
  const { region, gameName, tagLine, iconUrl, rank } = props;
  useEffect(() => {
    pushRecent({ region, gameName, tagLine, iconUrl, rank });
  }, [region, gameName, tagLine, iconUrl, rank]);
  return null;
}
