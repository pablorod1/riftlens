import { schema, type Db } from "@riftlens/db";
import { patchFromVersion, type MatchDto, type ParticipantDto } from "@riftlens/riot";
import { inArray } from "drizzle-orm";

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
  const match: MatchRow = {
    matchId: metadata.matchId,
    platform: info.platformId.toLowerCase(),
    queueId: info.queueId,
    gameCreation: info.gameCreation,
    gameDuration: info.gameDuration,
    patch: patchFromVersion(info.gameVersion),
    remake,
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
      queueId: info.queueId,
      gameCreation: info.gameCreation,
    };
  });
  return { match, participants };
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
      db.insert(schema.matches).values(match).onConflictDoNothing(),
      db.insert(schema.matchParticipants).values(participants).onConflictDoNothing(),
    ];
  });
  // db.batch ejecuta todo en una única transacción (y un único viaje a Turso).
  await db.batch(statements as [(typeof statements)[number], ...typeof statements]);
}
