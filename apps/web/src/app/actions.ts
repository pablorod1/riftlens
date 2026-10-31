"use server";

import { fetchMoreMatches, getMatchTimeline, loadBenchmarks, REFRESH_COOLDOWN_MS, refreshProfile } from "@riftlens/core";
import { schema } from "@riftlens/db";
import { isRateLimitError, regionBySlug, REGIONS, RiotApiError, type MatchTimelineData, type StaticData } from "@riftlens/riot";
import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { defaultLocale, isLocale, localePath, t } from "@/i18n/config";
import { getDictionaryFor } from "@/i18n/server";
import { exactChampion } from "@/lib/champion-search";
import { parseRiotIdQuery, regionFromTag, summonerPath } from "@/lib/format";
import { db, riot } from "@/lib/server";
import { getStaticData } from "@/lib/static-data";

export async function searchSummoner(formData: FormData) {
  const lang = String(formData.get("lang") ?? "");
  const locale = isLocale(lang) ? lang : defaultLocale;
  const q = String(formData.get("q") ?? "");
  const fromTag = regionFromTag(q.split("#")[1]?.trim(), REGIONS);
  const region = regionBySlug(fromTag ?? String(formData.get("region") ?? "euw")) ?? regionBySlug("euw")!;
  const parsed = parseRiotIdQuery(q, region.defaultTag);
  if (!parsed) redirect(localePath(locale, "/"));
  // Sin JS: si lo escrito es el nombre exacto de un campeón, vamos a su ficha
  const data = await getStaticData(locale);
  const champ = exactChampion(
    Object.values(data.champions).map((c) => ({ slug: c.id.toLowerCase(), name: c.name, icon: "" })),
    q,
  );
  if (champ) redirect(localePath(locale, `/champions/${champ.slug}`));
  redirect(summonerPath(locale, region.slug, parsed.gameName, parsed.tagLine));
}

export type UpdateState = { status: "idle" | "ok" | "error"; message?: string };

export async function updateProfile(_prev: UpdateState, formData: FormData): Promise<UpdateState> {
  const dict = (await getDictionaryFor(formData.get("lang"))).refreshResult;
  const region = regionBySlug(String(formData.get("region") ?? ""));
  const puuid = String(formData.get("puuid") ?? "");
  if (!region || !puuid) return { status: "error", message: dict.invalid };

  const [current] = await db()
    .select({ refreshedAt: schema.summoners.refreshedAt })
    .from(schema.summoners)
    .where(and(eq(schema.summoners.puuid, puuid), eq(schema.summoners.platform, region.platform)))
    .limit(1);
  if (current && Date.now() - current.refreshedAt.getTime() < REFRESH_COOLDOWN_MS) {
    return { status: "error", message: dict.cooldown };
  }

  try {
    const { newMatches } = await refreshProfile(db(), riot(), region, { puuid });
    refresh();
    return { status: "ok", message: newMatches ? t(dict.newMatches, { n: newMatches }) : dict.noNew };
  } catch (err) {
    if (err instanceof RiotApiError && err.isAuth) return { status: "error", message: dict.auth };
    if (isRateLimitError(err)) return { status: "error", message: dict.rateLimited };
    console.error(err);
    return { status: "error", message: dict.failed };
  }
}

/** Coach: descarga 20 partidas más antiguas del jugador para ampliar la muestra. */
export async function loadMoreMatches(_prev: UpdateState, formData: FormData): Promise<UpdateState> {
  const full = await getDictionaryFor(formData.get("lang"));
  const region = regionBySlug(String(formData.get("region") ?? ""));
  const puuid = String(formData.get("puuid") ?? "");
  if (!region || !puuid) return { status: "error", message: full.refreshResult.invalid };
  try {
    const { saved, rateLimited, exhausted } = await fetchMoreMatches(db(), riot(), region, puuid, 20);
    if (saved) refresh();
    if (rateLimited && !saved) return { status: "error", message: full.refreshResult.rateLimited };
    if (!saved && exhausted) return { status: "ok", message: full.coach.noMore };
    return { status: "ok", message: t(full.coach.loadedMore, { n: saved }) };
  } catch (err) {
    if (err instanceof RiotApiError && err.isAuth) return { status: "error", message: full.refreshResult.auth };
    if (isRateLimitError(err)) return { status: "error", message: full.refreshResult.rateLimited };
    console.error(err);
    return { status: "error", message: full.refreshResult.failed };
  }
}

export interface MatchTimelinePayload {
  ok: boolean;
  message?: string;
  timeline?: MatchTimelineData;
  version?: string;
  /** Nombres de los objetos comprados en la partida */
  items?: Record<number, string>;
  runeTrees?: StaticData["runeTrees"];
  runes?: StaticData["runes"];
  /** Curvas medianas de alto elo para el campeón y rol del jugador */
  reference?: { cs: number[]; gold: number[]; bracket: string };
}

/**
 * Línea temporal de una partida para las pestañas Timeline, Build y Gráficas.
 * Se pide a Riot una sola vez (1 petición) y queda guardada.
 */
export async function loadMatchTimeline(input: { matchId: string; puuid: string; region: string; lang: string }): Promise<MatchTimelinePayload> {
  const dict = await getDictionaryFor(input.lang);
  const region = regionBySlug(input.region);
  if (!region || !/^[A-Z0-9]+_\d+$/.test(input.matchId)) return { ok: false, message: dict.refreshResult.invalid };
  try {
    const timeline = await getMatchTimeline(db(), riot(), region, input.matchId);
    const data = await getStaticData(isLocale(input.lang) ? input.lang : defaultLocale);
    const bought = new Set(Object.values(timeline.items).flatMap((list) => list.map((i) => i.item)));
    const items = Object.fromEntries([...bought].map((id) => [id, data.items[id]?.name ?? String(id)]));

    const [me] = await db()
      .select({ championId: schema.matchParticipants.championId, position: schema.matchParticipants.position })
      .from(schema.matchParticipants)
      .where(and(eq(schema.matchParticipants.matchId, input.matchId), eq(schema.matchParticipants.puuid, input.puuid)))
      .limit(1);
    const bench = me?.position ? (await loadBenchmarks(db(), region.platform, [me])).get(`${me.championId}|${me.position}`) : undefined;
    const curve = bench?.benchmark;

    return {
      ok: true,
      timeline,
      version: data.version,
      items,
      runeTrees: data.runeTrees,
      runes: data.runes,
      reference: curve && curve.csCurve.length && bench ? { cs: curve.csCurve, gold: curve.goldCurve, bracket: dict.champions.brackets[bench.bracket] } : undefined,
    };
  } catch (err) {
    if (isRateLimitError(err)) return { ok: false, message: dict.refreshResult.rateLimited };
    if (err instanceof RiotApiError && err.isAuth) return { ok: false, message: dict.refreshResult.auth };
    if (err instanceof RiotApiError && err.isNotFound) return { ok: false, message: dict.matchDetails.noTimeline };
    console.error(err);
    return { ok: false, message: dict.analysis.failed };
  }
}
