import { schema, type ChampionBuild, type Db } from "@riftlens/db";
import { and, desc, eq } from "drizzle-orm";
import { shrunkWinrate, tierOf, type Tier } from "./stats";

export const BRACKETS = ["emerald_plus", "diamond_plus", "master_plus"] as const;
export type BracketId = (typeof BRACKETS)[number];
export const isBracket = (v: unknown): v is BracketId => typeof v === "string" && (BRACKETS as readonly string[]).includes(v);

export interface StatsScope {
  platform: string;
  patch: string;
  bracket: BracketId;
  matches: number;
  updatedAt: Date;
}

/** Último cálculo publicado para una plataforma y elo (o null si aún no hay). */
export async function latestScope(db: Db, platform: string, bracket: BracketId): Promise<StatsScope | null> {
  const [row] = await db
    .select()
    .from(schema.statsMeta)
    .where(and(eq(schema.statsMeta.platform, platform), eq(schema.statsMeta.bracket, bracket)))
    .orderBy(desc(schema.statsMeta.updatedAt))
    .limit(1);
  return row ? { ...row, bracket } : null;
}

export interface ChampionRow {
  championId: number;
  position: string;
  games: number;
  wins: number;
  bans: number;
  roleShare: number;
  winrate: number;
  pickRate: number;
  banRate: number;
  /** Winrate corregido por tamaño de muestra: el que ordena la tier list */
  score: number;
  tier: Tier;
}

function enrich(r: typeof schema.championStats.$inferSelect, matches: number): ChampionRow {
  const score = shrunkWinrate(r.wins, r.games);
  return {
    championId: r.championId,
    position: r.position,
    games: r.games,
    wins: r.wins,
    bans: r.bans,
    roleShare: r.roleShare,
    winrate: r.games ? r.wins / r.games : 0,
    // Cada partida tiene 2 jugadores por rol: el pick rate es por partida
    pickRate: matches ? r.games / matches : 0,
    banRate: matches ? r.bans / matches : 0,
    score,
    tier: tierOf(score),
  };
}

const scopeWhere = <T extends typeof schema.championStats | typeof schema.championBuilds | typeof schema.championMatchups>(t: T, s: StatsScope) =>
  and(eq(t.patch, s.patch), eq(t.platform, s.platform), eq(t.bracket, s.bracket));

export async function loadTierList(db: Db, scope: StatsScope, position?: string) {
  const rows = await db
    .select()
    .from(schema.championStats)
    .where(position ? and(scopeWhere(schema.championStats, scope), eq(schema.championStats.position, position)) : scopeWhere(schema.championStats, scope));
  return rows.map((r) => enrich(r, scope.matches)).sort((a, b) => b.score - a.score);
}

export interface Matchup {
  opponentId: number;
  games: number;
  wins: number;
  winrate: number;
  score: number;
}

export async function loadChampion(db: Db, scope: StatsScope, championId: number) {
  const [stats, builds, matchups] = await Promise.all([
    db
      .select()
      .from(schema.championStats)
      .where(and(scopeWhere(schema.championStats, scope), eq(schema.championStats.championId, championId))),
    db
      .select()
      .from(schema.championBuilds)
      .where(and(scopeWhere(schema.championBuilds, scope), eq(schema.championBuilds.championId, championId))),
    db
      .select()
      .from(schema.championMatchups)
      .where(and(scopeWhere(schema.championMatchups, scope), eq(schema.championMatchups.championId, championId))),
  ]);

  const roles = stats.map((r) => enrich(r, scope.matches)).sort((a, b) => b.games - a.games);
  const buildBy = new Map<string, ChampionBuild>(builds.map((b) => [b.position, b.data]));
  const matchupsBy = new Map<string, Matchup[]>();
  for (const m of matchups) {
    const list = matchupsBy.get(m.position) ?? [];
    // Encogemos con menos fuerza: los matchups siempre tienen menos partidas
    list.push({ opponentId: m.opponentId, games: m.games, wins: m.wins, winrate: m.wins / m.games, score: shrunkWinrate(m.wins, m.games, 0.5, 30) });
    matchupsBy.set(m.position, list);
  }
  for (const list of matchupsBy.values()) list.sort((a, b) => b.games - a.games);
  return { roles, buildBy, matchupsBy };
}

export type ChampionData = Awaited<ReturnType<typeof loadChampion>>;
