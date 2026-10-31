import { schema, type Db } from "@riftlens/db";
import { compactTimeline, type MatchTimelineData, type Region, type RiotClient } from "@riftlens/riot";
import { eq } from "drizzle-orm";

/**
 * Línea temporal de una partida: de la base de datos si ya la pedimos antes,
 * si no de Riot (1 petición) y la guardamos para la próxima vez.
 */
export async function getMatchTimeline(db: Db, riot: RiotClient, region: Region, matchId: string): Promise<MatchTimelineData> {
  const [cached] = await db.select().from(schema.matchTimelines).where(eq(schema.matchTimelines.matchId, matchId)).limit(1);
  if (cached) return cached.data as MatchTimelineData;
  const data = compactTimeline(await riot.timeline(region.regional, matchId));
  await db.insert(schema.matchTimelines).values({ matchId, data, createdAt: new Date() }).onConflictDoNothing();
  return data;
}
