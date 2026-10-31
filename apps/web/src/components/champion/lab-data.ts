import type { ChampionRow, Matchup } from "@riftlens/core";
import type { ChampionDetail } from "@riftlens/db";
import type { LabRow } from "./matchup-lab";

/**
 * Filas del laboratorio de matchups: rivales de línea (lista completa, con fase
 * de líneas), enemigos en otras posiciones y aliados en todas (los 40 más
 * frecuentes de cada posición, que es lo que guarda la ficha detallada).
 */
export function buildLabRows({ position, matchups, detail, peers }: { position: string; matchups: Matchup[]; detail?: ChampionDetail; peers: ChampionRow[] }): LabRow[] {
  const peerWr = new Map(peers.map((p) => [p.championId, p.winrate]));
  const laneCounters = new Map((detail?.counters[position] ?? []).map((r) => [r.championId, r.otherWr]));
  const rows: LabRow[] = matchups.map((m) => ({
    championId: m.opponentId,
    side: "enemy",
    position,
    games: m.games,
    wins: m.wins,
    otherWr: peerWr.get(m.opponentId) ?? laneCounters.get(m.opponentId) ?? 0.5,
    lane: m.detail
      ? {
          tlGames: m.detail.tlGames,
          gold10: m.detail.gold10,
          gold15: m.detail.gold15,
          cs15: m.detail.cs15,
          xp15: m.detail.xp15,
          lead15: m.detail.lead15,
          lead15Wins: m.detail.lead15Wins,
        }
      : null,
  }));
  if (detail) {
    for (const [pos, list] of Object.entries(detail.counters)) {
      if (pos === position) continue;
      for (const r of list) rows.push({ championId: r.championId, side: "enemy", position: pos, games: r.games, wins: r.wins, otherWr: r.otherWr });
    }
    for (const [pos, list] of Object.entries(detail.synergy)) {
      for (const r of list) rows.push({ championId: r.championId, side: "ally", position: pos, games: r.games, wins: r.wins, otherWr: r.otherWr });
    }
  }
  return rows.filter((r) => r.games > 0);
}

/** Δ2: efecto propio del emparejamiento, descontando la fuerza del otro campeón. */
export const delta2 = (r: LabRow, champWr: number) =>
  r.side === "enemy" ? r.wins / r.games - (champWr + (1 - r.otherWr) - 0.5) : r.wins / r.games - (champWr + r.otherWr - 0.5);
