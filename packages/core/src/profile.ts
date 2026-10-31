import { schema, type Db } from "@riftlens/db";
import type { Region, RiotClient } from "@riftlens/riot";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { missingMatchIds, saveMatches } from "./ingest";

/** Tiempo mínimo entre dos actualizaciones del mismo perfil. */
export const REFRESH_COOLDOWN_MS = 2 * 60 * 1000;

export const riotIdKey = (gameName: string, tagLine: string) =>
  `${gameName.trim()}#${tagLine.trim()}`.toLowerCase();

export type ProfileRef = { puuid: string } | { gameName: string; tagLine: string };

export interface RefreshOptions {
  /** Cuántas partidas recientes pedir a Riot (máx. 100) */
  matchCount?: number;
}

/**
 * Descarga de Riot cuenta, invocador, rango y últimas partidas, y lo guarda.
 * Solo pide las partidas que no tenemos ya. Lanza RiotApiError (404 si no existe).
 */
export async function refreshProfile(
  db: Db,
  riot: RiotClient,
  region: Region,
  ref: ProfileRef,
  opts: RefreshOptions = {},
): Promise<{ puuid: string; newMatches: number }> {
  const account =
    "puuid" in ref
      ? await riot.accountByPuuid(region.account, ref.puuid)
      : await riot.accountByRiotId(region.account, ref.gameName, ref.tagLine);
  const { puuid } = account;

  const [summoner, entries, matchIds] = await Promise.all([
    riot.summonerByPuuid(region.platform, puuid),
    riot.leagueEntriesByPuuid(region.platform, puuid),
    riot.matchIdsByPuuid(region.regional, puuid, { count: opts.matchCount ?? 20 }),
  ]);

  const missing = await missingMatchIds(db, matchIds);
  const fetched = await Promise.all(missing.map((id) => riot.match(region.regional, id)));

  const now = new Date();
  const gameName = account.gameName ?? "";
  const tagLine = account.tagLine ?? "";

  await db.batch([
    db
      .insert(schema.accounts)
      .values({ puuid, gameName, tagLine, riotIdKey: riotIdKey(gameName, tagLine), updatedAt: now })
      .onConflictDoUpdate({
        target: schema.accounts.puuid,
        set: { gameName, tagLine, riotIdKey: riotIdKey(gameName, tagLine), updatedAt: now },
      }),
    db
      .insert(schema.summoners)
      .values({
        puuid,
        platform: region.platform,
        profileIconId: summoner.profileIconId,
        summonerLevel: summoner.summonerLevel,
        refreshedAt: now,
      })
      .onConflictDoUpdate({
        target: [schema.summoners.puuid, schema.summoners.platform],
        set: { profileIconId: summoner.profileIconId, summonerLevel: summoner.summonerLevel, refreshedAt: now },
      }),
    // Reemplazamos las entradas: si deja de jugar una cola, desaparece.
    db
      .delete(schema.leagueEntries)
      .where(and(eq(schema.leagueEntries.puuid, puuid), eq(schema.leagueEntries.platform, region.platform))),
    ...entries.map((e) =>
      db.insert(schema.leagueEntries).values({
        puuid,
        platform: region.platform,
        queueType: e.queueType,
        tier: e.tier,
        division: e.rank,
        leaguePoints: e.leaguePoints,
        wins: e.wins,
        losses: e.losses,
        hotStreak: e.hotStreak,
        updatedAt: now,
      }),
    ),
  ]);
  await saveMatches(db, fetched);

  return { puuid, newMatches: fetched.length };
}

/** Busca en la base de datos (sin llamar a Riot) un invocador por Riot ID. */
export async function findCachedSummoner(db: Db, platform: string, gameName: string, tagLine: string) {
  const rows = await db
    .select({ puuid: schema.accounts.puuid, refreshedAt: schema.summoners.refreshedAt })
    .from(schema.accounts)
    .innerJoin(
      schema.summoners,
      and(eq(schema.summoners.puuid, schema.accounts.puuid), eq(schema.summoners.platform, platform)),
    )
    .where(eq(schema.accounts.riotIdKey, riotIdKey(gameName, tagLine)))
    .limit(1);
  return rows[0] ?? null;
}

export interface ChampionSummary {
  championId: number;
  games: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  /** Duración total en segundos, para calcular CS/min */
  seconds: number;
}

/** Perfil completo listo para pintar, leído solo de la base de datos. */
export async function loadProfile(db: Db, platform: string, puuid: string, opts: { matches?: number } = {}) {
  const [account] = await db.select().from(schema.accounts).where(eq(schema.accounts.puuid, puuid)).limit(1);
  const [summoner] = await db
    .select()
    .from(schema.summoners)
    .where(and(eq(schema.summoners.puuid, puuid), eq(schema.summoners.platform, platform)))
    .limit(1);
  if (!account || !summoner) return null;

  const [entries, recent, champions] = await Promise.all([
    db
      .select()
      .from(schema.leagueEntries)
      .where(and(eq(schema.leagueEntries.puuid, puuid), eq(schema.leagueEntries.platform, platform))),
    db
      .select({ p: schema.matchParticipants, m: schema.matches })
      .from(schema.matchParticipants)
      .innerJoin(schema.matches, eq(schema.matches.matchId, schema.matchParticipants.matchId))
      .where(and(eq(schema.matchParticipants.puuid, puuid), eq(schema.matches.platform, platform)))
      .orderBy(desc(schema.matchParticipants.gameCreation))
      .limit(opts.matches ?? 20),
    // Rendimiento por campeón en clasificatorias (sin remakes).
    db
      .select({
        championId: schema.matchParticipants.championId,
        games: sql<number>`count(*)`,
        wins: sql<number>`sum(${schema.matchParticipants.win})`,
        kills: sql<number>`sum(${schema.matchParticipants.kills})`,
        deaths: sql<number>`sum(${schema.matchParticipants.deaths})`,
        assists: sql<number>`sum(${schema.matchParticipants.assists})`,
        cs: sql<number>`sum(${schema.matchParticipants.cs})`,
        seconds: sql<number>`sum(${schema.matches.gameDuration})`,
      })
      .from(schema.matchParticipants)
      .innerJoin(schema.matches, eq(schema.matches.matchId, schema.matchParticipants.matchId))
      .where(
        and(
          eq(schema.matchParticipants.puuid, puuid),
          eq(schema.matches.platform, platform),
          eq(schema.matches.remake, false),
          inArray(schema.matches.queueId, [420, 440]),
        ),
      )
      .groupBy(schema.matchParticipants.championId)
      .orderBy(desc(sql`count(*)`)),
  ]);

  // Los 10 jugadores de cada partida reciente, para el desplegable de la partida.
  const ids = recent.map((r) => r.m.matchId);
  const everyone = ids.length
    ? await db.select().from(schema.matchParticipants).where(inArray(schema.matchParticipants.matchId, ids))
    : [];
  const byMatch = new Map<string, (typeof everyone)[number][]>();
  for (const p of everyone) {
    const list = byMatch.get(p.matchId) ?? [];
    list.push(p);
    byMatch.set(p.matchId, list);
  }

  return {
    account,
    summoner,
    entries,
    champions: champions as ChampionSummary[],
    matches: recent.map(({ p, m }) => ({
      match: m,
      me: p,
      participants: (byMatch.get(m.matchId) ?? []).sort((a, b) => a.participantId - b.participantId),
    })),
  };
}

export type Profile = NonNullable<Awaited<ReturnType<typeof loadProfile>>>;
export type ProfileMatch = Profile["matches"][number];
