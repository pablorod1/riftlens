import { searchSummoners } from "@riftlens/core";
import { ddragonImg, isApex, regionByPlatform, regionBySlug, type Tier } from "@riftlens/riot";
import type { NextRequest } from "next/server";
import { isLocale } from "@/i18n/config";
import { getDictionaryFor } from "@/i18n/server";
import { db } from "@/lib/server";
import { getStaticData } from "@/lib/static-data";

export interface SuggestionDto {
  gameName: string;
  tagLine: string;
  region: string;
  iconUrl: string | null;
  level: number | null;
  rank: string | null;
}

/**
 * Sugerencias de invocadores por prefijo de Riot ID, solo entre los que ya
 * conocemos (Riot no permite buscar por nombre parcial). No gasta cuota de Riot.
 *   GET /api/search?q=schwa&region=euw&lang=es
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = (params.get("q") ?? "").slice(0, 40);
  const region = regionBySlug(params.get("region") ?? "euw") ?? regionBySlug("euw")!;
  const lang = params.get("lang") ?? "en";
  if (q.trim().length < 2) return Response.json([]);

  const [rows, data, dict] = await Promise.all([
    searchSummoners(db(), q, region.platform, 8),
    getStaticData(isLocale(lang) ? lang : "en"),
    getDictionaryFor(lang),
  ]);
  const out: SuggestionDto[] = rows.map((r) => ({
    gameName: r.gameName,
    tagLine: r.tagLine,
    region: (r.platform && regionByPlatform(r.platform)?.slug) || region.slug,
    iconUrl: r.profileIconId !== null ? ddragonImg.profileIcon(data.version, r.profileIconId) : null,
    level: r.summonerLevel,
    rank: r.tier ? `${dict.tiers[r.tier as Tier] ?? r.tier}${isApex(r.tier) ? "" : ` ${r.division ?? ""}`}`.trim() : null,
  }));
  return Response.json(out, { headers: { "Cache-Control": "private, max-age=30" } });
}
