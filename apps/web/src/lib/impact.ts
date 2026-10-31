import type { MatchParticipant } from "@riftlens/db";

/**
 * Puntuación de impacto (0–10) relativa a la propia partida. Cada métrica se
 * divide entre el máximo de los 10 jugadores y se pondera; así no depende del
 * elo ni de la duración. Es orientativa y la explicamos en la interfaz.
 */
const WEIGHTS = { kda: 0.25, kp: 0.2, damage: 0.2, gold: 0.15, vision: 0.1, cs: 0.1 } as const;

export interface Impact {
  score: number;
  /** 1 = mejor de la partida */
  rank: number;
  badge: "mvp" | "ace" | null;
}

export function computeImpact(participants: MatchParticipant[]): Map<string, Impact> {
  const teamKills = new Map<number, number>();
  for (const p of participants) teamKills.set(p.teamId, (teamKills.get(p.teamId) ?? 0) + p.kills);
  const raw = participants.map((p) => ({
    p,
    kda: Math.min(12, (p.kills + p.assists) / Math.max(1, p.deaths)),
    kp: (p.kills + p.assists) / Math.max(1, teamKills.get(p.teamId) ?? 0),
    damage: p.damage,
    gold: p.gold,
    vision: p.visionScore,
    cs: p.cs,
  }));
  const keys = Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[];
  const max = Object.fromEntries(keys.map((k) => [k, Math.max(1e-9, ...raw.map((r) => r[k]))])) as Record<keyof typeof WEIGHTS, number>;
  const scored = raw
    .map((r) => ({ r, score: 10 * keys.reduce((s, k) => s + WEIGHTS[k] * (r[k] / max[k]), 0) }))
    .sort((a, b) => b.score - a.score);

  const out = new Map<string, Impact>();
  const bestOf = new Map<boolean, string>();
  scored.forEach(({ r, score }, i) => {
    if (!bestOf.has(r.p.win)) bestOf.set(r.p.win, r.p.puuid);
    out.set(r.p.puuid, { score, rank: i + 1, badge: null });
  });
  const mvp = bestOf.get(true);
  const ace = bestOf.get(false);
  if (mvp) out.get(mvp)!.badge = "mvp";
  if (ace) out.get(ace)!.badge = "ace";
  return out;
}
