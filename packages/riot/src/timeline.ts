import type { TimelineDto } from "./types";

/** Lo que extraemos de la línea temporal para cada jugador. */
export interface ParticipantTimeline {
  /** CS acumulado al final de cada minuto (índice 0 = minuto 1) */
  csAt: number[];
  /** Oro total acumulado al final de cada minuto */
  goldAt: number[];
  xpAt: number[];
  /** Objetos comprados en orden (los deshechos con ITEM_UNDO no cuentan) */
  purchases: number[];
  /** Habilidades en el orden en que se subieron: "QWEQQRQ…" */
  skillOrder: string;
}

const SLOTS = ["", "Q", "W", "E", "R"];

/** Minutos que guardamos como máximo (las curvas de referencia llegan hasta aquí). */
export const TIMELINE_MINUTES = 30;

/** Procesa una línea temporal y devuelve los datos por puuid. */
export function parseTimeline(t: TimelineDto): Map<string, ParticipantTimeline> {
  const idToPuuid = new Map<number, string>();
  if (t.info.participants?.length) for (const p of t.info.participants) idToPuuid.set(p.participantId, p.puuid);
  else t.metadata.participants.forEach((puuid, i) => idToPuuid.set(i + 1, puuid));

  const out = new Map<number, ParticipantTimeline>();
  for (const id of idToPuuid.keys()) out.set(id, { csAt: [], goldAt: [], xpAt: [], purchases: [], skillOrder: "" });

  t.info.frames.forEach((frame, minute) => {
    // El frame 0 es el inicio de la partida; el frame n es el final del minuto n
    if (minute >= 1 && minute <= TIMELINE_MINUTES) {
      for (const [key, f] of Object.entries(frame.participantFrames)) {
        const p = out.get(Number(key));
        if (!p) continue;
        p.csAt.push(f.minionsKilled + f.jungleMinionsKilled);
        p.goldAt.push(f.totalGold);
        p.xpAt.push(f.xp);
      }
    }
    for (const e of frame.events) {
      const p = e.participantId ? out.get(e.participantId) : undefined;
      if (!p) continue;
      if (e.type === "ITEM_PURCHASED" && "itemId" in e) p.purchases.push(e.itemId);
      else if (e.type === "ITEM_UNDO" && "beforeId" in e && e.beforeId) {
        const i = p.purchases.lastIndexOf(e.beforeId);
        if (i >= 0) p.purchases.splice(i, 1);
      } else if (e.type === "SKILL_LEVEL_UP" && "skillSlot" in e && e.levelUpType === "NORMAL") {
        p.skillOrder += SLOTS[e.skillSlot] ?? "";
      }
    }
  });

  const byPuuid = new Map<string, ParticipantTimeline>();
  for (const [id, data] of out) byPuuid.set(idToPuuid.get(id)!, data);
  return byPuuid;
}

/** Orden de maximización de habilidades básicas: "Q>E>W" (la R no cuenta). */
export function maxOrder(skillOrder: string): string | null {
  const levels: Record<string, number> = { Q: 0, W: 0, E: 0 };
  const done: string[] = [];
  for (const s of skillOrder) {
    if (!(s in levels)) continue;
    levels[s]! += 1;
    if (levels[s] === 5) done.push(s);
  }
  // Si la partida acaba antes, completamos por nivel actual
  const rest = (["Q", "W", "E"] as const).filter((s) => !done.includes(s)).sort((a, b) => levels[b]! - levels[a]!);
  const order = [...done, ...rest];
  return skillOrder.length >= 9 ? order.join(">") : null;
}
