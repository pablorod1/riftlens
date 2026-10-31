import { schema, type Db } from "@riftlens/db";
import { patchFromVersion, type MatchDto, type ParticipantDto } from "@riftlens/riot";
import { and, eq, inArray, sql } from "drizzle-orm";
import { accountUpserts } from "./search";

type MatchRow = typeof schema.matches.$inferInsert;
type ParticipantRow = typeof schema.matchParticipants.$inferInsert;

function largestMultiKill(p: ParticipantDto) {
  if (p.pentaKills) return 5;
  if (p.quadraKills) return 4;
  if (p.tripleKills) return 3;
  if (p.doubleKills) return 2;
  return p.kills > 0 ? 1 : 0;
}

export function matchToRows(m: MatchDto): { match: MatchRow; participants: ParticipantRow[] } {
  const { info, metadata } = m;
  const remake = info.participants.some((p) => p.gameEndedInEarlySurrender);
  // Objetivos por equipo para el resumen de la partida
  const teams: Record<string, Record<string, number>> = {};
  for (const t of info.teams ?? []) {
    teams[String(t.teamId)] = Object.fromEntries(Object.entries(t.objectives ?? {}).map(([k, v]) => [k, v.kills]));
  }
  const match: MatchRow = {
    matchId: metadata.matchId,
    platform: info.platformId.toLowerCase(),
    queueId: info.queueId,
    gameCreation: info.gameCreation,
    gameDuration: info.gameDuration,
    patch: patchFromVersion(info.gameVersion),
    remake,
    teams,
  };
  const participants = info.participants.map((p): ParticipantRow => {
    const primary = p.perks.styles.find((s) => s.description === "primaryStyle");
    const sub = p.perks.styles.find((s) => s.description === "subStyle");
    return {
      matchId: metadata.matchId,
      puuid: p.puuid,
      participantId: p.participantId,
      teamId: p.teamId,
      gameName: p.riotIdGameName ?? null,
      tagLine: p.riotIdTagline ?? null,
      championId: p.championId,
      champLevel: p.champLevel,
      position: p.teamPosition || p.individualPosition || "",
      win: p.win,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      cs: p.totalMinionsKilled + p.neutralMinionsKilled,
      gold: p.goldEarned,
      damage: p.totalDamageDealtToChampions,
      damageTaken: p.totalDamageTaken,
      visionScore: p.visionScore,
      items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6],
      spell1: p.summoner1Id,
      spell2: p.summoner2Id,
      keystone: primary?.selections[0]?.perk ?? 0,
      primaryStyle: primary?.style ?? 0,
      subStyle: sub?.style ?? 0,
      largestMultiKill: largestMultiKill(p),
      wardsPlaced: p.wardsPlaced ?? 0,
      wardsKilled: p.wardsKilled ?? 0,
      controlWards: p.visionWardsBoughtInGame ?? 0,
      perks: [...(primary?.selections ?? []), ...(sub?.selections ?? [])].map((s) => s.perk),
      shards: p.perks.statPerks ? [p.perks.statPerks.offense, p.perks.statPerks.flex, p.perks.statPerks.defense] : [],
      queueId: info.queueId,
      gameCreation: info.gameCreation,
    };
  });
  return { match, participants };
}

/** Partidas guardadas antes de tener runas completas, guardianes y objetivos. */
export async function incompleteMatchIds(db: Db, ids: string[], puuid: string): Promise<string[]> {
  if (!ids.length) return [];
  const rows = await db
    .select({ id: schema.matchParticipants.matchId })
    .from(schema.matchParticipants)
    .where(and(inArray(schema.matchParticipants.matchId, ids), eq(schema.matchParticipants.puuid, puuid), eq(schema.matchParticipants.perks, [])));
  return rows.map((r) => r.id);
}

/** Devuelve los ids que todavía no tenemos guardados. */
export async function missingMatchIds(db: Db, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const existing = await db
    .select({ id: schema.matches.matchId })
    .from(schema.matches)
    .where(inArray(schema.matches.matchId, ids));
  const have = new Set(existing.map((r) => r.id));
  return ids.filter((id) => !have.has(id));
}

export async function saveMatches(db: Db, list: MatchDto[]) {
  if (!list.length) return;
  const statements = list.flatMap((m) => {
    const { match, participants } = matchToRows(m);
    return [
      // Si la partida ya existía (guardada antes de tener estos campos), completamos los nuevos
      db.insert(schema.matches).values(match).onConflictDoUpdate({ target: schema.matches.matchId, set: { teams: match.teams } }),
      db
        .insert(schema.matchParticipants)
        .values(participants)
        .onConflictDoUpdate({
          target: [schema.matchParticipants.matchId, schema.matchParticipants.puuid],
          set: {
            wardsPlaced: sql`excluded.wards_placed`,
            wardsKilled: sql`excluded.wards_killed`,
            controlWards: sql`excluded.control_wards`,
            perks: sql`excluded.perks`,
            shards: sql`excluded.shards`,
          },
        }),
      // Los 10 jugadores alimentan el índice de sugerencias de búsqueda
      ...accountUpserts(
        db,
        participants.map((p) => ({ puuid: p.puuid, gameName: p.gameName ?? "", tagLine: p.tagLine ?? "", platform: match.platform })),
      ),
    ];
  });
  // db.batch ejecuta todo en una única transacción (y un único viaje a Turso).
  await db.batch(statements as [(typeof statements)[number], ...typeof statements]);
}
