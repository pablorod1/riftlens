import type { Tier } from "./types";

export const QUEUES: Record<number, { name: string; short: string }> = {
  420: { name: "Clasificatoria Solo/Dúo", short: "Solo/Dúo" },
  440: { name: "Clasificatoria Flexible", short: "Flex" },
  400: { name: "Normal (reclutamiento)", short: "Normal" },
  430: { name: "Normal (a ciegas)", short: "Normal" },
  490: { name: "Partida rápida", short: "Rápida" },
  450: { name: "ARAM", short: "ARAM" },
  1700: { name: "Arena", short: "Arena" },
  1900: { name: "URF", short: "URF" },
  900: { name: "ARURF", short: "ARURF" },
  0: { name: "Personalizada", short: "Custom" },
};

export const queueName = (id: number) => QUEUES[id]?.short ?? "Otra";

export const RANKED_QUEUES = {
  RANKED_SOLO_5x5: { id: 420, label: "Solo/Dúo" },
  RANKED_FLEX_SR: { id: 440, label: "Flexible" },
} as const;

export const TIERS: Tier[] = [
  "IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND",
  "MASTER", "GRANDMASTER", "CHALLENGER",
];

export const APEX_TIERS: Tier[] = ["CHALLENGER", "GRANDMASTER", "MASTER"];

export const TIER_LABELS: Record<Tier, string> = {
  IRON: "Hierro",
  BRONZE: "Bronce",
  SILVER: "Plata",
  GOLD: "Oro",
  PLATINUM: "Platino",
  EMERALD: "Esmeralda",
  DIAMOND: "Diamante",
  MASTER: "Maestro",
  GRANDMASTER: "Gran Maestro",
  CHALLENGER: "Aspirante",
};

export const isApex = (tier: string) => (APEX_TIERS as string[]).includes(tier);

export const POSITIONS = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"] as const;
export type Position = (typeof POSITIONS)[number];
export const POSITION_LABELS: Record<Position, string> = {
  TOP: "Top",
  JUNGLE: "Jungla",
  MIDDLE: "Mid",
  BOTTOM: "ADC",
  UTILITY: "Support",
};

/** "15.21.712.4096" -> "15.21" */
export const patchFromVersion = (gameVersion: string) =>
  gameVersion.split(".").slice(0, 2).join(".");
