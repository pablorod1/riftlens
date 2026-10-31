import type { ChampionSummary, ProfileMatch } from "@riftlens/core";

/** Lecturas rápidas del perfil, calculadas solo con lo que ya tenemos guardado. */
export interface Insights {
  /** > 0 victorias seguidas, < 0 derrotas seguidas */
  streak: number;
  best: { championId: number; wins: number; games: number } | null;
  mainRole: { position: string; share: number } | null;
  csPerMin: number | null;
}

/** Mínimo de partidas para destacar un campeón como "el mejor". */
const BEST_MIN_GAMES = 3;

export function computeInsights(matches: ProfileMatch[], champions: ChampionSummary[]): Insights {
  const valid = matches.filter((m) => !m.match.remake);

  let streak = 0;
  for (const m of valid) {
    if (streak === 0) streak = m.me.win ? 1 : -1;
    else if (m.me.win === streak > 0) streak += streak > 0 ? 1 : -1;
    else break;
  }

  const best =
    champions
      .filter((c) => c.games >= BEST_MIN_GAMES)
      // Ordenamos por el límite inferior aproximado para no premiar muestras mínimas
      .map((c) => ({ c, score: (c.wins + 1) / (c.games + 2) }))
      .sort((a, b) => b.score - a.score)[0]?.c ?? null;

  const roles = new Map<string, number>();
  for (const m of valid) if (m.me.position) roles.set(m.me.position, (roles.get(m.me.position) ?? 0) + 1);
  const [topRole] = [...roles.entries()].sort((a, b) => b[1] - a[1]);

  const seconds = valid.reduce((s, m) => s + m.match.gameDuration, 0);
  const cs = valid.reduce((s, m) => s + m.me.cs, 0);

  return {
    streak: Math.abs(streak) >= 2 ? streak : 0,
    best: best ? { championId: best.championId, wins: best.wins, games: best.games } : null,
    mainRole: topRole && valid.length ? { position: topRole[0], share: topRole[1] / valid.length } : null,
    csPerMin: seconds ? cs / (seconds / 60) : null,
  };
}

export type QueueGroup = "solo" | "flex" | "other";
export const queueGroup = (queueId: number): QueueGroup => (queueId === 420 ? "solo" : queueId === 440 ? "flex" : "other");
