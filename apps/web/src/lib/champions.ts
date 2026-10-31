import type { StaticData } from "@riftlens/riot";

/** Roles en la URL (?role=mid) <-> posiciones de Riot (MIDDLE). */
export const ROLE_SLUGS = { top: "TOP", jungle: "JUNGLE", mid: "MIDDLE", bot: "BOTTOM", support: "UTILITY" } as const;
export type RoleSlug = keyof typeof ROLE_SLUGS;
export const roleFromSlug = (slug: unknown): string | undefined =>
  typeof slug === "string" ? ROLE_SLUGS[slug as RoleSlug] : undefined;
export const slugFromRole = (position: string): RoleSlug | undefined =>
  (Object.entries(ROLE_SLUGS).find(([, p]) => p === position)?.[0] as RoleSlug | undefined) ?? undefined;

/** Slug de campeón en la URL: el id de Data Dragon en minúsculas ("ahri", "monkeyking"). */
export const championSlug = (data: StaticData, championId: number) => data.champions[championId]?.id.toLowerCase();

export function championBySlug(data: StaticData, slug: string) {
  const s = slug.toLowerCase();
  return Object.values(data.champions).find((c) => c.id.toLowerCase() === s);
}

/** Primer valor de un searchParam (puede venir repetido). */
export const param = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
