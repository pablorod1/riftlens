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
  /** Segundo de partida de cada compra (mismo orden que purchases) */
  purchaseTimes: number[];
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
  for (const id of idToPuuid.keys()) out.set(id, { csAt: [], goldAt: [], xpAt: [], purchases: [], purchaseTimes: [], skillOrder: "" });

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
      if (e.type === "ITEM_PURCHASED" && "itemId" in e) {
        p.purchases.push(e.itemId);
        p.purchaseTimes.push(Math.round(e.timestamp / 1000));
      } else if (e.type === "ITEM_UNDO" && "beforeId" in e && e.beforeId) {
        const i = p.purchases.lastIndexOf(e.beforeId);
        if (i >= 0) {
          p.purchases.splice(i, 1);
          p.purchaseTimes.splice(i, 1);
        }
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

// ---------------------------------------------------------------------------
// Línea temporal compacta para las vistas de detalle de partida

export type ObjectiveKind = "dragon" | "elder" | "baron" | "herald" | "horde" | "atakhan" | "tower" | "inhibitor";

export interface MatchTimelineData {
  /** Minutos completos de la partida */
  minutes: number;
  /** Por participantId (1–10): valores acumulados al final de cada minuto (índice 0 = minuto 0) */
  frames: Record<number, { gold: number[]; xp: number[]; cs: number[] }>;
  kills: { t: number; killer: number; victim: number; assists: number[]; x: number; y: number; firstBlood?: boolean }[];
  objectives: { t: number; team: number; kind: ObjectiveKind; sub?: string; killer: number; x?: number; y?: number }[];
  /** Compras por participante (ya descontados los ITEM_UNDO), con su instante en ms */
  items: Record<number, { t: number; item: number; sold?: boolean }[]>;
  /** Habilidades subidas: slot 1–4 (Q, W, E, R) */
  skills: Record<number, { t: number; slot: number }[]>;
}

const DRAGON_KIND = (type: string, sub?: string): ObjectiveKind | null => {
  if (type === "DRAGON") return sub === "ELDER_DRAGON" ? "elder" : "dragon";
  if (type === "BARON_NASHOR") return "baron";
  if (type === "RIFTHERALD") return "herald";
  if (type === "HORDE") return "horde";
  if (type === "ATAKHAN") return "atakhan";
  return null;
};

type AnyEvent = Record<string, unknown> & { type: string; timestamp: number };

/** Resume una línea temporal de Riot en lo que necesitan las vistas de partida. */
export function compactTimeline(t: TimelineDto): MatchTimelineData {
  const out: MatchTimelineData = { minutes: Math.max(0, t.info.frames.length - 1), frames: {}, kills: [], objectives: [], items: {}, skills: {} };
  for (let id = 1; id <= 10; id++) {
    out.frames[id] = { gold: [], xp: [], cs: [] };
    out.items[id] = [];
    out.skills[id] = [];
  }
  let firstBlood = true;
  for (const frame of t.info.frames) {
    for (const [key, f] of Object.entries(frame.participantFrames)) {
      const fr = out.frames[Number(key)];
      if (!fr) continue;
      fr.gold.push(f.totalGold);
      fr.xp.push(f.xp);
      fr.cs.push(f.minionsKilled + f.jungleMinionsKilled);
    }
    for (const raw of frame.events) {
      const e = raw as AnyEvent;
      const pid = Number(e.participantId ?? 0);
      switch (e.type) {
        case "ITEM_PURCHASED":
          out.items[pid]?.push({ t: e.timestamp, item: Number(e.itemId) });
          break;
        case "ITEM_SOLD":
          out.items[pid]?.push({ t: e.timestamp, item: Number(e.itemId), sold: true });
          break;
        case "ITEM_UNDO": {
          const list = out.items[pid];
          const before = Number(e.beforeId);
          if (list && before) {
            for (let i = list.length - 1; i >= 0; i--) {
              if (list[i]!.item === before && !list[i]!.sold) {
                list.splice(i, 1);
                break;
              }
            }
          }
          break;
        }
        case "SKILL_LEVEL_UP":
          if (e.levelUpType === "NORMAL") out.skills[pid]?.push({ t: e.timestamp, slot: Number(e.skillSlot) });
          break;
        case "CHAMPION_KILL": {
          const pos = e.position as { x: number; y: number } | undefined;
          out.kills.push({
            t: e.timestamp,
            killer: Number(e.killerId ?? 0),
            victim: Number(e.victimId ?? 0),
            assists: (e.assistingParticipantIds as number[] | undefined) ?? [],
            x: pos?.x ?? 0,
            y: pos?.y ?? 0,
            ...(firstBlood ? { firstBlood: true } : {}),
          });
          firstBlood = false;
          break;
        }
        case "ELITE_MONSTER_KILL": {
          const kind = DRAGON_KIND(String(e.monsterType), e.monsterSubType as string | undefined);
          const pos = e.position as { x: number; y: number } | undefined;
          if (kind)
            out.objectives.push({
              t: e.timestamp,
              team: Number(e.killerTeamId),
              kind,
              sub: (e.monsterSubType as string | undefined) ?? undefined,
              killer: Number(e.killerId ?? 0),
              x: pos?.x,
              y: pos?.y,
            });
          break;
        }
        case "BUILDING_KILL": {
          // teamId es el dueño de la estructura: el equipo que la destruye es el otro
          const kind = e.buildingType === "INHIBITOR_BUILDING" ? "inhibitor" : e.buildingType === "TOWER_BUILDING" ? "tower" : null;
          const pos = e.position as { x: number; y: number } | undefined;
          if (kind)
            out.objectives.push({
              t: e.timestamp,
              team: Number(e.teamId) === 100 ? 200 : 100,
              kind,
              sub: (e.laneType as string | undefined) ?? undefined,
              killer: Number(e.killerId ?? 0),
              x: pos?.x,
              y: pos?.y,
            });
          break;
        }
      }
    }
  }
  return out;
}
