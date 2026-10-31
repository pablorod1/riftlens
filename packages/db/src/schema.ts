import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Datos que sirve la web. Las partidas en bruto para builds y tier lists
 * (fase 2) viven en DuckDB, en el worker; aquí solo llegan los agregados.
 */

/** Cuenta de Riot (global, no depende de la región). */
export const accounts = sqliteTable(
  "accounts",
  {
    puuid: text("puuid").primaryKey(),
    gameName: text("game_name").notNull(),
    tagLine: text("tag_line").notNull(),
    /** "nombre#tag" en minúsculas para buscar sin distinguir mayúsculas */
    riotIdKey: text("riot_id_key").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("accounts_riot_id_key_idx").on(t.riotIdKey)],
);

/** Invocador en una plataforma concreta (euw1, kr…). */
export const summoners = sqliteTable(
  "summoners",
  {
    puuid: text("puuid").notNull(),
    platform: text("platform").notNull(),
    profileIconId: integer("profile_icon_id").notNull(),
    summonerLevel: integer("summoner_level").notNull(),
    /** Última actualización completa del perfil (rango + partidas) */
    refreshedAt: integer("refreshed_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.puuid, t.platform] })],
);

export const leagueEntries = sqliteTable(
  "league_entries",
  {
    puuid: text("puuid").notNull(),
    platform: text("platform").notNull(),
    queueType: text("queue_type").notNull(),
    tier: text("tier").notNull(),
    division: text("division").notNull(),
    leaguePoints: integer("league_points").notNull(),
    wins: integer("wins").notNull(),
    losses: integer("losses").notNull(),
    hotStreak: integer("hot_streak", { mode: "boolean" }).notNull().default(false),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.puuid, t.platform, t.queueType] })],
);

export const matches = sqliteTable(
  "matches",
  {
    matchId: text("match_id").primaryKey(),
    platform: text("platform").notNull(),
    queueId: integer("queue_id").notNull(),
    gameCreation: integer("game_creation").notNull(),
    gameDuration: integer("game_duration").notNull(),
    patch: text("patch").notNull(),
    /** Partida terminada por remake: no cuenta para estadísticas */
    remake: integer("remake", { mode: "boolean" }).notNull(),
  },
  (t) => [index("matches_patch_queue_idx").on(t.patch, t.queueId)],
);

export const matchParticipants = sqliteTable(
  "match_participants",
  {
    matchId: text("match_id")
      .notNull()
      .references(() => matches.matchId, { onDelete: "cascade" }),
    puuid: text("puuid").notNull(),
    participantId: integer("participant_id").notNull(),
    teamId: integer("team_id").notNull(),
    gameName: text("game_name"),
    tagLine: text("tag_line"),
    championId: integer("champion_id").notNull(),
    champLevel: integer("champ_level").notNull(),
    position: text("position").notNull(),
    win: integer("win", { mode: "boolean" }).notNull(),
    kills: integer("kills").notNull(),
    deaths: integer("deaths").notNull(),
    assists: integer("assists").notNull(),
    cs: integer("cs").notNull(),
    gold: integer("gold").notNull(),
    damage: integer("damage").notNull(),
    damageTaken: integer("damage_taken").notNull(),
    visionScore: integer("vision_score").notNull(),
    /** [item0..item6] */
    items: text("items", { mode: "json" }).$type<number[]>().notNull(),
    spell1: integer("spell1").notNull(),
    spell2: integer("spell2").notNull(),
    keystone: integer("keystone").notNull(),
    primaryStyle: integer("primary_style").notNull(),
    subStyle: integer("sub_style").notNull(),
    largestMultiKill: integer("largest_multi_kill").notNull(),
    /** Desnormalizados para listar "mis partidas" sin JOIN */
    queueId: integer("queue_id").notNull(),
    gameCreation: integer("game_creation").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.matchId, t.puuid] }),
    index("mp_puuid_creation_idx").on(t.puuid, t.gameCreation),
  ],
);

/** Clasificación de Aspirante/Gran Maestro/Maestro, la rellena el worker. */
export const ladderEntries = sqliteTable(
  "ladder_entries",
  {
    platform: text("platform").notNull(),
    queueType: text("queue_type").notNull(),
    puuid: text("puuid").notNull(),
    position: integer("position").notNull(),
    tier: text("tier").notNull(),
    leaguePoints: integer("league_points").notNull(),
    wins: integer("wins").notNull(),
    losses: integer("losses").notNull(),
    hotStreak: integer("hot_streak", { mode: "boolean" }).notNull().default(false),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.platform, t.queueType, t.puuid] }),
    index("ladder_position_idx").on(t.platform, t.queueType, t.position),
  ],
);

export type Account = typeof accounts.$inferSelect;
export type Summoner = typeof summoners.$inferSelect;
export type LeagueEntry = typeof leagueEntries.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type MatchParticipant = typeof matchParticipants.$inferSelect;
export type LadderEntry = typeof ladderEntries.$inferSelect;
