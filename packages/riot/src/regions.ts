/** Rutas de la API de Riot: los endpoints de plataforma (euw1…) y los regionales (europe…). */
export type RegionalRoute = "americas" | "europe" | "asia" | "sea";

export interface Region {
  /** Slug que usamos en las URLs: /summoner/euw/... */
  slug: string;
  /** Host de plataforma: league-v4, summoner-v4, spectator-v5 */
  platform: string;
  /** Host regional para match-v5 */
  regional: RegionalRoute;
  /** Host regional para account-v1 (no admite "sea") */
  account: Exclude<RegionalRoute, "sea">;
  label: string;
  /** Tag por defecto si el usuario busca sin "#" (como hace op.gg) */
  defaultTag: string;
}

export const REGIONS = [
  { slug: "euw", platform: "euw1", regional: "europe", account: "europe", label: "Europa Oeste", defaultTag: "EUW" },
  { slug: "eune", platform: "eun1", regional: "europe", account: "europe", label: "Europa Nórdica y Este", defaultTag: "EUNE" },
  { slug: "tr", platform: "tr1", regional: "europe", account: "europe", label: "Turquía", defaultTag: "TR1" },
  { slug: "ru", platform: "ru", regional: "europe", account: "europe", label: "Rusia", defaultTag: "RU1" },
  { slug: "me", platform: "me1", regional: "europe", account: "europe", label: "Oriente Medio", defaultTag: "ME1" },
  { slug: "na", platform: "na1", regional: "americas", account: "americas", label: "Norteamérica", defaultTag: "NA1" },
  { slug: "lan", platform: "la1", regional: "americas", account: "americas", label: "Latinoamérica Norte", defaultTag: "LAN" },
  { slug: "las", platform: "la2", regional: "americas", account: "americas", label: "Latinoamérica Sur", defaultTag: "LAS" },
  { slug: "br", platform: "br1", regional: "americas", account: "americas", label: "Brasil", defaultTag: "BR1" },
  { slug: "kr", platform: "kr", regional: "asia", account: "asia", label: "Corea", defaultTag: "KR1" },
  { slug: "jp", platform: "jp1", regional: "asia", account: "asia", label: "Japón", defaultTag: "JP1" },
  { slug: "oce", platform: "oc1", regional: "sea", account: "americas", label: "Oceanía", defaultTag: "OCE" },
  { slug: "sea", platform: "sg2", regional: "sea", account: "asia", label: "Sudeste Asiático", defaultTag: "SG2" },
  { slug: "tw", platform: "tw2", regional: "sea", account: "asia", label: "Taiwán", defaultTag: "TW2" },
  { slug: "vn", platform: "vn2", regional: "sea", account: "asia", label: "Vietnam", defaultTag: "VN2" },
] as const satisfies readonly Region[];

export type RegionSlug = (typeof REGIONS)[number]["slug"];
export type Platform = (typeof REGIONS)[number]["platform"];

const bySlug = new Map<string, Region>(REGIONS.map((r) => [r.slug, r]));
const byPlatform = new Map<string, Region>(REGIONS.map((r) => [r.platform, r]));

export function regionBySlug(slug: string): Region | undefined {
  return bySlug.get(slug.toLowerCase());
}

export function regionByPlatform(platform: string): Region | undefined {
  return byPlatform.get(platform.toLowerCase());
}

/** El prefijo de un matchId ("EUW1_123") indica su plataforma. */
export function platformFromMatchId(matchId: string): string {
  return matchId.split("_")[0]!.toLowerCase();
}
