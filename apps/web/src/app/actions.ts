"use server";

import { fetchMoreMatches, loadBenchmarks, REFRESH_COOLDOWN_MS, refreshProfile } from "@riftlens/core";
import { schema } from "@riftlens/db";
import { isRateLimitError, parseTimeline, regionBySlug, REGIONS, RiotApiError } from "@riftlens/riot";
import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { defaultLocale, isLocale, localePath, t } from "@/i18n/config";
import { getDictionaryFor } from "@/i18n/server";
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

export interface MatchAnalysis {
  ok: boolean;
  message?: string;
  championId?: number;
  opponentChampionId?: number;
  opponentName?: string;
  bracket?: string;
  you?: { cs: number[]; gold: number[] };
  opponent?: { cs: number[]; gold: number[] };
  reference?: { cs: number[]; gold: number[] };
}

/**
 * Descarga la línea temporal de una partida (1 petición) y la compara con el
 * rival de línea y con la curva mediana de alto elo de ese campeón y rol.
 */
export async function analyzeMatch(input: { matchId: string; puuid: string; region: string; lang: string }): Promise<MatchAnalysis> {
  const dict = await getDictionaryFor(input.lang);
  const region = regionBySlug(input.region);
  if (!region || !/^[A-Z0-9]+_\d+$/.test(input.matchId)) return { ok: false, message: dict.refreshResult.invalid };
  try {
    const players = await db()
      .select({ puuid: schema.matchParticipants.puuid, teamId: schema.matchParticipants.teamId, position: schema.matchParticipants.position, championId: schema.matchParticipants.championId })
      .from(schema.matchParticipants)
      .where(eq(schema.matchParticipants.matchId, input.matchId));
    const me = players.find((p) => p.puuid === input.puuid);
    if (!me) return { ok: false, message: dict.refreshResult.invalid };
    const opp = players.find((p) => p.teamId !== me.teamId && p.position === me.position && me.position);

    const timeline = parseTimeline(await riot().timeline(region.regional, input.matchId));
    const mine = timeline.get(me.puuid);
    const theirs = opp ? timeline.get(opp.puuid) : undefined;
    const bench = me.position ? (await loadBenchmarks(db(), region.platform, [me])).get(`${me.championId}|${me.position}`) : undefined;
    const curve = bench?.benchmark;
    const names = await getStaticData(isLocale(input.lang) ? input.lang : defaultLocale);
    return {
      opponentName: opp ? names.champions[opp.championId]?.name : undefined,
      ok: true,
      championId: me.championId,
      opponentChampionId: opp?.championId,
      bracket: bench ? dict.champions.brackets[bench.bracket] : undefined,
      you: mine ? { cs: mine.csAt, gold: mine.goldAt } : undefined,
      opponent: theirs ? { cs: theirs.csAt, gold: theirs.goldAt } : undefined,
      reference: curve && curve.csCurve.length ? { cs: curve.csCurve, gold: curve.goldCurve } : undefined,
    };
  } catch (err) {
    if (isRateLimitError(err)) return { ok: false, message: dict.refreshResult.rateLimited };
    if (err instanceof RiotApiError && err.isAuth) return { ok: false, message: dict.refreshResult.auth };
    console.error(err);
    return { ok: false, message: dict.analysis.failed };
  }
}
