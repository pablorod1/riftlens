import { schema, type Db } from "@riftlens/db";
import { APEX_TIERS, type LeagueItemDto, type Region, type RiotClient, type Tier } from "@riftlens/riot";
import { and, asc, count, eq, isNull, lt, or, sql } from "drizzle-orm";
import { riotIdKey } from "./keys";

const TIER_ORDER: Record<string, number> = { CHALLENGER: 0, GRANDMASTER: 1, MASTER: 2 };

/**
 * Descarga Aspirante + Gran Maestro + Maestro de una cola y reemplaza la
 * clasificación guardada. Son 3 peticiones a Riot.
 */
export async function refreshApexLadder(db: Db, riot: RiotClient, region: Region, queueType = "RANKED_SOLO_5x5") {
  const lists = await Promise.all(APEX_TIERS.map((tier) => riot.apexLeague(region.platform, tier as "MASTER", queueType)));

  const players: (LeagueItemDto & { tier: Tier })[] = lists.flatMap((l) => l.entries.map((e) => ({ ...e, tier: l.tier })));
  players.sort(
    (a, b) =>
      TIER_ORDER[a.tier]! - TIER_ORDER[b.tier]! ||
      b.leaguePoints - a.leaguePoints ||
      // Desempate: más victorias primero
      b.wins - a.wins,
  );

  const now = new Date();
  const rows = players.map((p, i) => ({
    platform: region.platform,
    queueType,
    puuid: p.puuid,
    position: i + 1,
    tier: p.tier,
    leaguePoints: p.leaguePoints,
    wins: p.wins,
    losses: p.losses,
    hotStreak: p.hotStreak,
    updatedAt: now,
  }));

  const CHUNK = 500;
  const inserts = [];
  for (let i = 0; i < rows.length; i += CHUNK) {
    inserts.push(db.insert(schema.ladderEntries).values(rows.slice(i, i + CHUNK)));
  }
  await db.batch([
    db
      .delete(schema.ladderEntries)
      .where(and(eq(schema.ladderEntries.platform, region.platform), eq(schema.ladderEntries.queueType, queueType))),
    ...inserts,
  ]);
  return rows.length;
}

/** Jugadores de la clasificación cuyo Riot ID no conocemos o está desactualizado. */
export async function ladderPuuidsWithoutName(db: Db, platform: string, limit: number, staleMs = 7 * 24 * 3600 * 1000) {
  const staleBefore = new Date(Date.now() - staleMs);
  const rows = await db
    .select({ puuid: schema.ladderEntries.puuid })
    .from(schema.ladderEntries)
    .leftJoin(schema.accounts, eq(schema.accounts.puuid, schema.ladderEntries.puuid))
    .where(
      and(
        eq(schema.ladderEntries.platform, platform),
        or(isNull(schema.accounts.puuid), lt(schema.accounts.updatedAt, staleBefore)),
      ),
    )
    .orderBy(asc(schema.ladderEntries.position))
    .limit(limit);
  return rows.map((r) => r.puuid);
}

/** Resuelve Riot IDs (1 petición por jugador). Devuelve cuántos se han guardado. */
export async function resolveAccounts(db: Db, riot: RiotClient, region: Region, puuids: string[]) {
  let saved = 0;
  const results = await Promise.allSettled(puuids.map((puuid) => riot.accountByPuuid(region.account, puuid)));
  const now = new Date();
  for (const r of results) {
    if (r.status !== "fulfilled" || !r.value.gameName) continue;
    const { puuid, gameName, tagLine = "" } = r.value;
    await db
      .insert(schema.accounts)
      .values({ puuid, gameName, tagLine, riotIdKey: riotIdKey(gameName, tagLine), lastPlatform: region.platform, updatedAt: now })
      .onConflictDoUpdate({
        target: schema.accounts.puuid,
        set: { gameName, tagLine, riotIdKey: riotIdKey(gameName, tagLine), lastPlatform: region.platform, updatedAt: now },
      });
    saved++;
  }
  return saved;
}

export async function loadLadder(
  db: Db,
  platform: string,
  opts: { queueType?: string; page?: number; pageSize?: number } = {},
) {
  const queueType = opts.queueType ?? "RANKED_SOLO_5x5";
  const pageSize = opts.pageSize ?? 100;
  const page = Math.max(1, opts.page ?? 1);
  const where = and(eq(schema.ladderEntries.platform, platform), eq(schema.ladderEntries.queueType, queueType));

  const [rows, [total], [meta]] = await Promise.all([
    db
      .select({
        position: schema.ladderEntries.position,
        puuid: schema.ladderEntries.puuid,
        tier: schema.ladderEntries.tier,
        leaguePoints: schema.ladderEntries.leaguePoints,
        wins: schema.ladderEntries.wins,
        losses: schema.ladderEntries.losses,
        hotStreak: schema.ladderEntries.hotStreak,
        gameName: schema.accounts.gameName,
        tagLine: schema.accounts.tagLine,
        profileIconId: schema.summoners.profileIconId,
        summonerLevel: schema.summoners.summonerLevel,
      })
      .from(schema.ladderEntries)
      .leftJoin(schema.accounts, eq(schema.accounts.puuid, schema.ladderEntries.puuid))
      .leftJoin(
        schema.summoners,
        and(eq(schema.summoners.puuid, schema.ladderEntries.puuid), eq(schema.summoners.platform, platform)),
      )
      .where(where)
      .orderBy(asc(schema.ladderEntries.position))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ n: count() }).from(schema.ladderEntries).where(where),
    db
      .select({ updatedAt: sql<number | null>`max(${schema.ladderEntries.updatedAt})` })
      .from(schema.ladderEntries)
      .where(where),
  ]);

  return {
    rows,
    page,
    pageSize,
    total: total?.n ?? 0,
    updatedAt: meta?.updatedAt ? new Date(meta.updatedAt) : null,
  };
}
