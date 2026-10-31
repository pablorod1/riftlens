import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
    /** Última plataforma en la que lo hemos visto (para priorizar sugerencias por región) */
    lastPlatform: text("last_platform"),
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
    /** Objetivos por equipo: { "100": { baron: 1, dragon: 2, … }, "200": {…} } */
    teams: text("teams", { mode: "json" }).$type<Record<string, Record<string, number>>>(),
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
    wardsPlaced: integer("wards_placed").default(0),
    wardsKilled: integer("wards_killed").default(0),
    controlWards: integer("control_wards").default(0),
    /** Las 6 runas en orden (4 principales + 2 secundarias) */
    perks: text("perks", { mode: "json" }).$type<number[]>().notNull().default([]),
    /** Fragmentos: [ataque, flexible, defensa] */
    shards: text("shards", { mode: "json" }).$type<number[]>().notNull().default([]),
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

// ---------------------------------------------------------------------------
// Fase 2: agregados de builds, matchups y tier list. Los calcula el worker
// desde DuckDB y los sustituye en bloque por (parche, plataforma, elo).

/** Una fila por cálculo publicado: cuántas partidas lo respaldan y cuándo se hizo. */
export const statsMeta = sqliteTable(
  "stats_meta",
  {
    patch: text("patch").notNull(),
    platform: text("platform").notNull(),
    bracket: text("bracket").notNull(),
    matches: integer("matches").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.patch, t.platform, t.bracket] })],
);

export const championStats = sqliteTable(
  "champion_stats",
  {
    patch: text("patch").notNull(),
    platform: text("platform").notNull(),
    bracket: text("bracket").notNull(),
    championId: integer("champion_id").notNull(),
    position: text("position").notNull(),
    games: integer("games").notNull(),
    wins: integer("wins").notNull(),
    /** Partidas en las que fue baneado (de todas las del parche y elo) */
    bans: integer("bans").notNull(),
    /** Fracción de las partidas del campeón jugadas en este rol */
    roleShare: real("role_share").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.patch, t.platform, t.bracket, t.championId, t.position] }),
    index("champion_stats_position_idx").on(t.patch, t.platform, t.bracket, t.position),
  ],
);

export interface BuildEntry {
  games: number;
  wins: number;
}
export interface ChampionBuild {
  runes: (BuildEntry & { primaryStyle: number; subStyle: number; perks: number[]; shards: number[] })[];
  spells: (BuildEntry & { spells: [number, number] })[];
  boots: (BuildEntry & { item: number })[];
  items: (BuildEntry & { item: number })[];
  /** Tríos de objetos completos más jugados juntos (sin orden de compra) */
  core: (BuildEntry & { items: number[] })[];
  /** Fase 3 (necesita líneas temporales): 3 primeros objetos completos en orden de compra */
  order?: (BuildEntry & { items: number[] })[];
  /** Orden de maximización de habilidades: "Q>E>W" */
  skills?: (BuildEntry & { order: string })[];
  /** Habilidades de los niveles 1–3: "QEW" */
  skillStart?: (BuildEntry & { start: string })[];
  /** Referencia para el coach: medianas de este campeón y rol en este elo */
  benchmark?: Benchmark;
  /** Ficha detallada (explorador de objetos, counters, objetivos, tendencias…) */
  detail?: ChampionDetail;
}

/** Una build completa: la más jugada o la de mayor winrate (con muestra mínima). */
export interface BuildVariant {
  skills: string | null;
  /** Habilidades nivel a nivel (hasta el 15): "QWEQQRQEQEREEWW" */
  skillPath: string | null;
  spells: [number, number] | null;
  runes: { primaryStyle: number; subStyle: number; perks: number[]; shards: number[] } | null;
  starting: number[];
  core: number[];
  /** Opciones para los objetos 4, 5 y 6 (posición de compra) */
  next: (BuildEntry & { item: number })[][];
  /** Partidas que respaldan cada parte: habilidades, runas, núcleo */
  support: { skills: BuildEntry | null; runes: BuildEntry | null; core: BuildEntry | null; starting: BuildEntry | null; spells: BuildEntry | null };
}

export interface ChampionDetail {
  /** Winrate que cabría esperar por los otros 9 campeones de sus partidas */
  gameAvgWr: number;
  builds: { best: BuildVariant; common: BuildVariant };
  items: {
    /** Sets de objetos iniciales (comprados en el primer minuto) */
    starting: (BuildEntry & { items: number[] })[];
    /** Objetos comprados antes del minuto 10 (sin contar los iniciales) */
    early: (BuildEntry & { item: number })[];
    /** Objetos completos según su posición de compra (1.º a 5.º), con el minuto medio */
    byPosition: (BuildEntry & { item: number; minute: number })[][];
    /** Todos los objetos completos, con el minuto medio de compra */
    all: (BuildEntry & { item: number; minute: number })[];
  };
  spells: (BuildEntry & { spells: [number, number] })[];
  /** Qué habilidad se sube en cada nivel (1–18) */
  skillLevels: { q: BuildEntry; w: BuildEntry; e: BuildEntry; r: BuildEntry }[];
  skillPriority: (BuildEntry & { order: string })[];
  /** Por id de runa (claves, secundarias y fragmentos con prefijo "s<fila>:") */
  runeStats: Record<string, BuildEntry>;
  /** Contra cada posición enemiga: campeón rival, partidas, victorias y su winrate general */
  counters: Record<string, (BuildEntry & { championId: number; otherWr: number })[]>;
  /** Con cada posición aliada */
  synergy: Record<string, (BuildEntry & { championId: number; otherWr: number })[]>;
  sides: { blue: BuildEntry; red: BuildEntry };
  /** Primeros objetivos: conseguirlo (secure) o que lo consiga el rival (yield) */
  objectives: { key: string; secure: BuildEntry; yield: BuildEntry }[];
  /** Winrate y partidas por tramo de duración */
  duration: (BuildEntry & { bucket: string })[];
  /** Medias por partida y puesto entre los campeones del mismo rol */
  stats: Record<string, { value: number; rank: number; of: number }>;
  /** Serie diaria: partidas, victorias, baneos y partidas totales del elo */
  trend: { day: string; games: number; wins: number; bans: number; matches: number }[];
  /** Popularidad (pick relativo) y profundidad (partidas por jugador), normalizadas a 1 */
  playerBase: { players: number; popularity: number; depth: number };
  /** Mejores jugadores entre las partidas rastreadas */
  bestPlayers: { gameName: string; tagLine: string; tier: string | null; games: number; wins: number }[];
}

export interface Benchmark {
  games: number;
  csPerMin: number;
  goldPerMin: number;
  damagePerMin: number;
  visionPerMin: number | null;
  deaths: number;
  killParticipation: number;
  /** Mediana del CS y del oro total al final de cada minuto (índice 0 = minuto 1) */
  csCurve: number[];
  goldCurve: number[];
  /** Partidas con línea temporal en las que se basan las curvas */
  curveGames: number;
}

export const championBuilds = sqliteTable(
  "champion_builds",
  {
    patch: text("patch").notNull(),
    platform: text("platform").notNull(),
    bracket: text("bracket").notNull(),
    championId: integer("champion_id").notNull(),
    position: text("position").notNull(),
    data: text("data", { mode: "json" }).$type<ChampionBuild>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.patch, t.platform, t.bracket, t.championId, t.position] })],
);

export const championMatchups = sqliteTable(
  "champion_matchups",
  {
    patch: text("patch").notNull(),
    platform: text("platform").notNull(),
    bracket: text("bracket").notNull(),
    championId: integer("champion_id").notNull(),
    position: text("position").notNull(),
    opponentId: integer("opponent_id").notNull(),
    games: integer("games").notNull(),
    wins: integer("wins").notNull(),
  },
  (t) => [primaryKey({ columns: [t.patch, t.platform, t.bracket, t.championId, t.position, t.opponentId] })],
);

export type StatsMeta = typeof statsMeta.$inferSelect;
export type ChampionStat = typeof championStats.$inferSelect;
export type ChampionMatchup = typeof championMatchups.$inferSelect;

/** Línea temporal compacta de una partida, guardada al pedirla por primera vez. */
export const matchTimelines = sqliteTable("match_timelines", {
  matchId: text("match_id")
    .primaryKey()
    .references(() => matches.matchId, { onDelete: "cascade" }),
  data: text("data", { mode: "json" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});
