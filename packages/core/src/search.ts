import { schema, type Db } from "@riftlens/db";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { riotIdKey } from "./keys";

export interface AccountRow {
  puuid: string;
  gameName: string;
  tagLine: string;
  platform?: string | null;
}

/**
 * Da de alta o actualiza Riot IDs en `accounts`, que sirve también de índice
 * para las sugerencias de búsqueda. Devuelve las sentencias para meterlas en un batch.
 */
export function accountUpserts(db: Db, rows: AccountRow[]) {
  const now = new Date();
  const valid = rows.filter((r) => r.gameName && r.tagLine);
  const CHUNK = 200;
  const out = [];
  for (let i = 0; i < valid.length; i += CHUNK) {
    out.push(
      db
        .insert(schema.accounts)
        .values(
          valid.slice(i, i + CHUNK).map((r) => ({
            puuid: r.puuid,
            gameName: r.gameName,
            tagLine: r.tagLine,
            riotIdKey: riotIdKey(r.gameName, r.tagLine),
            lastPlatform: r.platform ?? null,
            updatedAt: now,
          })),
        )
        .onConflictDoUpdate({
          target: schema.accounts.puuid,
          set: {
            gameName: sql`excluded.game_name`,
            tagLine: sql`excluded.tag_line`,
            riotIdKey: sql`excluded.riot_id_key`,
            lastPlatform: sql`coalesce(excluded.last_platform, ${schema.accounts.lastPlatform})`,
            updatedAt: sql`excluded.updated_at`,
          },
        }),
    );
  }
  return out;
}

export async function upsertAccounts(db: Db, rows: AccountRow[]) {
  const statements = accountUpserts(db, rows);
  if (statements.length) await db.batch(statements as [(typeof statements)[number], ...typeof statements]);
}

export interface SummonerSuggestion {
  gameName: string;
  tagLine: string;
  platform: string | null;
  profileIconId: number | null;
  summonerLevel: number | null;
  tier: string | null;
  division: string | null;
}

/**
 * Sugerencias por prefijo de Riot ID ("schwa" o "schwartzy#og"). Usa un rango
 * sobre riot_id_key (en minúsculas e indexado), así que no recorre la tabla.
 * Primero los de la región elegida y los que ya tienen perfil guardado.
 */
export async function searchSummoners(db: Db, query: string, platform: string, limit = 8): Promise<SummonerSuggestion[]> {
  const prefix = query.trim().toLowerCase();
  if (prefix.length < 2) return [];
  // El siguiente carácter tras el prefijo: rango [prefix, prefix + U+FFFF)
  const upper = `${prefix}￿`;
  const rows = await db
    .select({
      gameName: schema.accounts.gameName,
      tagLine: schema.accounts.tagLine,
      platform: sql<string | null>`coalesce(${schema.summoners.platform}, ${schema.accounts.lastPlatform})`,
      profileIconId: schema.summoners.profileIconId,
      summonerLevel: schema.summoners.summonerLevel,
      tier: schema.leagueEntries.tier,
      division: schema.leagueEntries.division,
    })
    .from(schema.accounts)
    .leftJoin(schema.summoners, and(eq(schema.summoners.puuid, schema.accounts.puuid), eq(schema.summoners.platform, platform)))
    .leftJoin(
      schema.leagueEntries,
      and(
        eq(schema.leagueEntries.puuid, schema.accounts.puuid),
        eq(schema.leagueEntries.platform, platform),
        eq(schema.leagueEntries.queueType, "RANKED_SOLO_5x5"),
      ),
    )
    .where(and(gte(schema.accounts.riotIdKey, prefix), lt(schema.accounts.riotIdKey, upper)))
    .orderBy(
      sql`case when ${schema.summoners.puuid} is not null then 0 when ${schema.accounts.lastPlatform} = ${platform} then 1 else 2 end`,
      sql`length(${schema.accounts.gameName})`,
      schema.accounts.riotIdKey,
    )
    .limit(limit);
  return rows;
}
