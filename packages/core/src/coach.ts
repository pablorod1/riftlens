/**
 * Coach: compara a un jugador con el alto elo, personaliza los matchups con su
 * historial y busca huecos en su pool. Todo con datos ya guardados: no llama a Riot.
 */
import { schema, type Benchmark, type Db } from "@riftlens/db";
import type { Region, RiotClient } from "@riftlens/riot";
import { RiotApiError } from "@riftlens/riot";
import { and, count, eq, inArray } from "drizzle-orm";
import { BRACKETS, latestScope, type BracketId, type StatsScope } from "./champions";
import { missingMatchIds, saveMatches } from "./ingest";
import { shrunkWinrate } from "./stats";

const RANKED = [420, 440];

export interface PlayerChampion {
  championId: number;
  position: string;
  games: number;
  wins: number;
  csPerMin: number;
  goldPerMin: number;
  damagePerMin: number;
  visionPerMin: number;
  deaths: number;
  killParticipation: number;
}

interface Participation {
  matchId: string;
  championId: number;
  position: string;
  win: boolean;
  teamId: number;
  opponentId: number | null;
}

/** Partidas clasificatorias guardadas del jugador, con su rival de línea. */
async function loadParticipations(db: Db, platform: string, puuid: string) {
  const mine = await db
    .select({ p: schema.matchParticipants, m: schema.matches })
    .from(schema.matchParticipants)
    .innerJoin(schema.matches, eq(schema.matches.matchId, schema.matchParticipants.matchId))
    .where(
      and(
        eq(schema.matchParticipants.puuid, puuid),
        eq(schema.matches.platform, platform),
        eq(schema.matches.remake, false),
        inArray(schema.matches.queueId, RANKED),
      ),
    );
  const ids = mine.map((r) => r.m.matchId);
  const everyone = ids.length
    ? await db
        .select({
          matchId: schema.matchParticipants.matchId,
          puuid: schema.matchParticipants.puuid,
          teamId: schema.matchParticipants.teamId,
          position: schema.matchParticipants.position,
          championId: schema.matchParticipants.championId,
          kills: schema.matchParticipants.kills,
        })
        .from(schema.matchParticipants)
        .where(inArray(schema.matchParticipants.matchId, ids))
    : [];
  const byMatch = new Map<string, typeof everyone>();
  for (const e of everyone) byMatch.set(e.matchId, [...(byMatch.get(e.matchId) ?? []), e]);
  return mine.map(({ p, m }) => {
    const all = byMatch.get(m.matchId) ?? [];
    const teamKills = all.filter((x) => x.teamId === p.teamId).reduce((s, x) => s + x.kills, 0);
    const opponent = all.find((x) => x.teamId !== p.teamId && x.position === p.position && p.position);
    return { p, m, teamKills, opponentId: opponent?.championId ?? null };
  });
}

export async function playerChampions(db: Db, platform: string, puuid: string) {
  const rows = await loadParticipations(db, platform, puuid);
  const agg = new Map<string, PlayerChampion & { minutes: number; kpSum: number }>();
  const participations: Participation[] = [];
  for (const { p, m, teamKills, opponentId } of rows) {
    if (!p.position) continue;
    participations.push({ matchId: m.matchId, championId: p.championId, position: p.position, win: p.win, teamId: p.teamId, opponentId });
    const k = `${p.championId}|${p.position}`;
    const a = agg.get(k) ?? {
      championId: p.championId, position: p.position, games: 0, wins: 0, csPerMin: 0, goldPerMin: 0,
      damagePerMin: 0, visionPerMin: 0, deaths: 0, killParticipation: 0, minutes: 0, kpSum: 0,
    };
    const mins = m.gameDuration / 60;
    a.games++;
    if (p.win) a.wins++;
    a.minutes += mins;
    // Sumamos totales y dividimos al final: ponderado por duración
    a.csPerMin += p.cs;
    a.goldPerMin += p.gold;
    a.damagePerMin += p.damage;
    a.visionPerMin += p.visionScore;
    a.deaths += p.deaths;
    a.kpSum += teamKills ? (p.kills + p.assists) / teamKills : 0;
    agg.set(k, a);
  }
  const champions = [...agg.values()]
    .map(({ minutes, kpSum, ...a }): PlayerChampion => ({
      ...a,
      csPerMin: a.csPerMin / minutes,
      goldPerMin: a.goldPerMin / minutes,
      damagePerMin: a.damagePerMin / minutes,
      visionPerMin: a.visionPerMin / minutes,
      deaths: a.deaths / a.games,
      killParticipation: kpSum / a.games,
    }))
    .sort((a, b) => b.games - a.games);
  return { champions, participations, totalRanked: rows.length };
}

// ---------------------------------------------------------------------------
// Comparación con el alto elo

export type MetricKey = "csPerMin" | "goldPerMin" | "damagePerMin" | "visionPerMin" | "deaths" | "killParticipation";
const METRICS: MetricKey[] = ["csPerMin", "goldPerMin", "damagePerMin", "visionPerMin", "killParticipation", "deaths"];
/** Mínimo de partidas de referencia para fiarnos de un benchmark. */
const MIN_BENCH_GAMES = 30;

export interface MetricComparison {
  key: MetricKey;
  mine: number;
  ref: number;
  /** Diferencia relativa; positiva = mejor que la referencia (también en muertes) */
  delta: number;
}

export interface CoachBenchmark {
  bracket: BracketId;
  patch: string;
  benchmark: Benchmark;
}

/**
 * Referencia más exigente disponible para cada campeón y rol: Maestro+ si hay
 * partidas suficientes, si no Diamante+, si no Esmeralda+.
 */
export async function loadBenchmarks(db: Db, platform: string, champs: { championId: number; position: string }[]) {
  const out = new Map<string, CoachBenchmark>();
  if (!champs.length) return out;
  const ids = [...new Set(champs.map((c) => c.championId))];
  for (const bracket of [...BRACKETS].reverse()) {
    const scope = await latestScope(db, platform, bracket);
    if (!scope) continue;
    const rows = await db
      .select()
      .from(schema.championBuilds)
      .where(
        and(
          eq(schema.championBuilds.patch, scope.patch),
          eq(schema.championBuilds.platform, platform),
          eq(schema.championBuilds.bracket, bracket),
          inArray(schema.championBuilds.championId, ids),
        ),
      );
    for (const r of rows) {
      const k = `${r.championId}|${r.position}`;
      const b = r.data.benchmark;
      if (!out.has(k) && b && b.games >= MIN_BENCH_GAMES) out.set(k, { bracket, patch: scope.patch, benchmark: b });
    }
  }
  return out;
}

export function compare(mine: PlayerChampion, ref: Benchmark): MetricComparison[] {
  return METRICS.flatMap((key) => {
    const r = ref[key];
    if (r === null || r === undefined || !Number.isFinite(r) || r === 0) return [];
    const m = mine[key];
    const delta = key === "deaths" ? (r - m) / r : (m - r) / r;
    return [{ key, mine: m, ref: r, delta }];
  });
}

// ---------------------------------------------------------------------------
// Matchups personalizados y optimizador de pool

type Record2 = { games: number; wins: number };
export type RoleMatchups = Map<number, Map<number, Record2>>;

export async function loadRoleMatchups(db: Db, scope: StatsScope, position: string): Promise<RoleMatchups> {
  const rows = await db
    .select()
    .from(schema.championMatchups)
    .where(
      and(
        eq(schema.championMatchups.patch, scope.patch),
        eq(schema.championMatchups.platform, scope.platform),
        eq(schema.championMatchups.bracket, scope.bracket),
        eq(schema.championMatchups.position, position),
      ),
    );
  const out: RoleMatchups = new Map();
  for (const r of rows) {
    const m = out.get(r.championId) ?? new Map();
    m.set(r.opponentId, { games: r.games, wins: r.wins });
    out.set(r.championId, m);
  }
  return out;
}

/** Peso (en partidas equivalentes) del dato global frente al historial personal. */
const PERSONAL_PRIOR = 8;

/**
 * Winrate esperado de `champ` contra `opp` para este jugador: el winrate global
 * del matchup (corregido por muestra) como punto de partida, desplazado por su
 * propio historial en ese enfrentamiento.
 */
export function blendedWinrate(global: Record2 | undefined, personal: Record2 | undefined) {
  const prior = global ? shrunkWinrate(global.wins, global.games, 0.5, 30) : 0.5;
  const p = personal ?? { games: 0, wins: 0 };
  return (p.wins + prior * PERSONAL_PRIOR) / (p.games + PERSONAL_PRIOR);
}

export interface PersonalMatchup {
  opponentId: number;
  personal: Record2;
  global: Record2 | undefined;
  expected: number;
}

export function personalMatchups(participations: Participation[], championId: number, position: string, global: RoleMatchups) {
  const byOpp = new Map<number, Record2>();
  for (const p of participations) {
    if (p.championId !== championId || p.position !== position || p.opponentId === null) continue;
    const r = byOpp.get(p.opponentId) ?? { games: 0, wins: 0 };
    r.games++;
    if (p.win) r.wins++;
    byOpp.set(p.opponentId, r);
  }
  return [...byOpp].map(([opponentId, personal]): PersonalMatchup => {
    const g = global.get(championId)?.get(opponentId);
    return { opponentId, personal, global: g, expected: blendedWinrate(g, personal) };
  });
}

export interface PoolPick {
  opponentId: number;
  /** Partidas del rival en el rol (para ordenar por frecuencia) */
  opponentGames: number;
  best: { championId: number; expected: number } | null;
}

export interface PoolAnalysis {
  pool: number[];
  picks: PoolPick[];
  /** Rivales frecuentes contra los que ningún campeón del pool llega al umbral */
  gaps: number[];
  /** Campeones fuera del pool que mejor cubren esos huecos */
  suggestions: { championId: number; expected: number }[];
}

const GAP_THRESHOLD = 0.485;

export function analysePool(
  participations: Participation[],
  position: string,
  global: RoleMatchups,
  roleStats: { championId: number; games: number }[],
  opts: { pool?: number; opponents?: number } = {},
): PoolAnalysis {
  const inRole = participations.filter((p) => p.position === position);
  const counts = new Map<number, number>();
  for (const p of inRole) counts.set(p.championId, (counts.get(p.championId) ?? 0) + 1);
  const pool = [...counts]
    .filter(([, g]) => g >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, opts.pool ?? 6)
    .map(([c]) => c);
  if (!pool.length) return { pool, picks: [], gaps: [], suggestions: [] };

  const personal = (champ: number, opp: number) => {
    const r = { games: 0, wins: 0 };
    for (const p of inRole) if (p.championId === champ && p.opponentId === opp) (r.games++, p.win && r.wins++);
    return r.games ? r : undefined;
  };

  const opponents = [...roleStats].sort((a, b) => b.games - a.games).slice(0, opts.opponents ?? 15);
  const picks: PoolPick[] = opponents.map((o) => {
    let best: PoolPick["best"] = null;
    for (const champ of pool) {
      if (champ === o.championId) continue;
      const expected = blendedWinrate(global.get(champ)?.get(o.championId), personal(champ, o.championId));
      if (!best || expected > best.expected) best = { championId: champ, expected };
    }
    return { opponentId: o.championId, opponentGames: o.games, best };
  });
  const gaps = picks.filter((p) => !p.best || p.best.expected < GAP_THRESHOLD).map((p) => p.opponentId);

  // Solo sugerimos con datos reales contra los huecos y si de verdad mejoran (≥ 50 %)
  const suggestions = gaps.length
    ? roleStats
        .filter((c) => !pool.includes(c.championId))
        .flatMap((c) => {
          const vs = gaps
            .filter((g) => g !== c.championId)
            .map((g) => global.get(c.championId)?.get(g))
            .filter((r): r is Record2 => !!r && r.games >= 5);
          if (!vs.length) return [];
          const expected = vs.reduce((s, r) => s + blendedWinrate(r, undefined), 0) / vs.length;
          return expected >= 0.5 ? [{ championId: c.championId, expected }] : [];
        })
        .sort((a, b) => b.expected - a.expected)
        .slice(0, 3)
    : [];
  return { pool, picks, gaps, suggestions };
}

// ---------------------------------------------------------------------------
// Más partidas para el coach

/**
 * Descarga las siguientes `count` partidas del jugador (las más antiguas que
 * aún no tenemos). Guarda sobre la marcha: si Riot corta por cuota, conserva
 * lo descargado. Devuelve cuántas partidas nuevas se han guardado.
 */
export async function fetchMoreMatches(db: Db, riot: RiotClient, region: Region, puuid: string, count_ = 20) {
  const [{ n } = { n: 0 }] = await db
    .select({ n: count() })
    .from(schema.matchParticipants)
    .innerJoin(schema.matches, eq(schema.matches.matchId, schema.matchParticipants.matchId))
    .where(and(eq(schema.matchParticipants.puuid, puuid), eq(schema.matches.platform, region.platform)));
  const ids = await riot.matchIdsByPuuid(region.regional, puuid, { start: n, count: count_ });
  let saved = 0;
  let rateLimited = false;
  for (const id of await missingMatchIds(db, ids)) {
    try {
      await saveMatches(db, [await riot.match(region.regional, id)]);
      saved++;
    } catch (err) {
      if (err instanceof RiotApiError && err.isRateLimited) {
        rateLimited = true;
        break;
      }
      throw err;
    }
  }
  return { saved, rateLimited, exhausted: ids.length < count_ };
}

