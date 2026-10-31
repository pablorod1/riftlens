import type { Tier } from "./types";

/** Colas conocidas. Los nombres visibles viven en los diccionarios de la web. */
export const KNOWN_QUEUES = [420, 440, 400, 430, 490, 450, 1700, 1900, 900, 0] as const;

export const RANKED_QUEUE_TYPES = ["RANKED_SOLO_5x5", "RANKED_FLEX_SR"] as const;

export const TIERS: Tier[] = [
  "IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND",
  "MASTER", "GRANDMASTER", "CHALLENGER",
];

export const APEX_TIERS: Tier[] = ["CHALLENGER", "GRANDMASTER", "MASTER"];

export const isApex = (tier: string) => (APEX_TIERS as string[]).includes(tier);

export const POSITIONS = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"] as const;
export type Position = (typeof POSITIONS)[number];

/** "15.21.712.4096" -> "15.21" */
export const patchFromVersion = (gameVersion: string) =>
  gameVersion.split(".").slice(0, 2).join(".");
