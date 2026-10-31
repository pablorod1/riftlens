/**
 * "Lake": partidas en bruto en DuckDB (un fichero, sin servidor). Solo lo usa el
 * worker; la web nunca lo lee. De aquí salen los agregados que se suben a Turso.
 */
import { DuckDBInstance, listValue, type DuckDBConnection } from "@duckdb/node-api";
import { patchFromVersion, type MatchDto } from "@riftlens/riot";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

/** Grupo de elo de una partida, según el jugador del que la sacamos. */
export type Bracket = "emerald" | "diamond" | "master_plus";

export const bracketOfTier = (tier: string): Bracket | null =>
  tier === "EMERALD" ? "emerald" : tier === "DIAMOND" ? "diamond" : ["MASTER", "GRANDMASTER", "CHALLENGER"].includes(tier) ? "master_plus" : null;

/** Grupos que publicamos: cada uno incluye los superiores. */
export const PUBLISHED_BRACKETS = {
  emerald_plus: ["emerald", "diamond", "master_plus"],
  diamond_plus: ["diamond", "master_plus"],
  master_plus: ["master_plus"],
} as const satisfies Record<string, Bracket[]>;
export type PublishedBracket = keyof typeof PUBLISHED_BRACKETS;

const SCHEMA = `
create table if not exists players (
  puuid varchar primary key,
  platform varchar not null,
  tier varchar not null,
  division varchar,
  lp integer,
  seeded_at timestamp not null default now(),
  crawled_at timestamp
);
create table if not exists matches (
  match_id varchar primary key,
  platform varchar not null,
  patch varchar not null,
  queue_id integer not null,
  game_creation bigint not null,
  duration integer not null,
  bracket varchar not null,
  inserted_at timestamp not null default now()
);
create table if not exists participants (
  match_id varchar not null,
  puuid varchar not null,
  team_id integer not null,
  champion_id integer not null,
  position varchar not null,
  win boolean not null,
  kills integer, deaths integer, assists integer,
  cs integer, gold integer, damage integer,
  items integer[] not null,
  spell1 integer, spell2 integer,
  primary_style integer, sub_style integer,
  perks integer[] not null,
  shards integer[] not null
);
create table if not exists bans (match_id varchar not null, team_id integer not null, champion_id integer not null);
-- Ids ya vistos que no guardamos (otro parche, remake…), para no volver a pedirlos
create table if not exists skipped (match_id varchar primary key, reason varchar);
`;

export class Lake {
  private constructor(readonly conn: DuckDBConnection) {}

  /** Abre (o crea) el fichero. Por defecto data/matches.duckdb en la raíz del repo. */
  static async open(path = process.env.LAKE_PATH ?? resolve(process.cwd(), "../../data/matches.duckdb")) {
    mkdirSync(dirname(path), { recursive: true });
    const instance = await DuckDBInstance.create(path);
    const conn = await instance.connect();
    await conn.run(SCHEMA);
    return new Lake(conn);
  }

  async all<T = Record<string, unknown>>(sql: string, params?: Record<string, unknown> | unknown[]): Promise<T[]> {
    const reader = await this.conn.runAndReadAll(sql, params as never);
    return reader.getRowObjectsJS() as T[];
  }

  async upsertPlayers(rows: { puuid: string; platform: string; tier: string; division?: string; lp?: number }[]) {
    if (!rows.length) return;
    await this.conn.run("begin");
    try {
      for (const r of rows) {
        await this.conn.run(
          `insert into players (puuid, platform, tier, division, lp) values ($1, $2, $3, $4, $5)
           on conflict (puuid) do update set tier = excluded.tier, division = excluded.division, lp = excluded.lp`,
          [r.puuid, r.platform, r.tier, r.division ?? null, r.lp ?? null],
        );
      }
      await this.conn.run("commit");
    } catch (e) {
      await this.conn.run("rollback");
      throw e;
    }
  }

  /**
   * Jugadores a rastrear, repartidos a partes iguales entre grupos de elo (hay
   * 10 veces más Maestros que Esmeraldas en la semilla). Dentro de cada grupo,
   * primero los nunca visitados y luego los más antiguos.
   */
  async nextPlayers(platform: string, limit: number) {
    return this.all<{ puuid: string; tier: string }>(
      `select puuid, tier from (
         select puuid, tier, row_number() over (
           partition by case when tier = 'EMERALD' then 0 when tier = 'DIAMOND' then 1 else 2 end
           order by crawled_at asc nulls first, random()
         ) as rn
         from players where platform = $1
       ) where rn <= ceil($2 / 3) order by rn`,
      [platform, limit],
    );
  }

  async markCrawled(puuid: string) {
    await this.conn.run("update players set crawled_at = now() where puuid = $1", [puuid]);
  }

  async unknownMatchIds(ids: string[]) {
    if (!ids.length) return [];
    const known = await this.all<{ id: string }>(
      `select match_id as id from matches where list_contains($1, match_id)
       union all select match_id from skipped where list_contains($1, match_id)`,
      [listValue(ids)],
    );
    const set = new Set(known.map((k) => k.id));
    return ids.filter((id) => !set.has(id));
  }

  async skip(matchId: string, reason: string) {
    await this.conn.run("insert into skipped values ($1, $2) on conflict do nothing", [matchId, reason]);
  }

  async insertMatch(m: MatchDto, bracket: Bracket) {
    const { info, metadata } = m;
    await this.conn.run("begin");
    try {
      await this.conn.run(
        `insert into matches (match_id, platform, patch, queue_id, game_creation, duration, bracket)
         values ($1, $2, $3, $4, $5, $6, $7) on conflict do nothing`,
        [metadata.matchId, info.platformId.toLowerCase(), patchFromVersion(info.gameVersion), info.queueId, info.gameCreation, info.gameDuration, bracket],
      );
      for (const p of info.participants) {
        const primary = p.perks.styles.find((s) => s.description === "primaryStyle");
        const sub = p.perks.styles.find((s) => s.description === "subStyle");
        const perks = [...(primary?.selections ?? []), ...(sub?.selections ?? [])].map((s) => s.perk);
        const shards = p.perks.statPerks ? [p.perks.statPerks.offense, p.perks.statPerks.flex, p.perks.statPerks.defense] : [];
        await this.conn.run(
          `insert into participants values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
          [
            metadata.matchId, p.puuid, p.teamId, p.championId, p.teamPosition || "", p.win,
            p.kills, p.deaths, p.assists, p.totalMinionsKilled + p.neutralMinionsKilled, p.goldEarned, p.totalDamageDealtToChampions,
            listValue([p.item0, p.item1, p.item2, p.item3, p.item4, p.item5].filter(Boolean)),
            p.summoner1Id, p.summoner2Id, primary?.style ?? 0, sub?.style ?? 0, listValue(perks), listValue(shards),
          ],
        );
      }
      for (const t of info.teams) {
        for (const b of t.bans) if (b.championId > 0) await this.conn.run("insert into bans values ($1, $2, $3)", [metadata.matchId, t.teamId, b.championId]);
      }
      await this.conn.run("commit");
    } catch (e) {
      await this.conn.run("rollback");
      throw e;
    }
  }

  async stats(platform: string) {
    const [r] = await this.all<{ players: bigint; matches: bigint; patch: string | null }>(
      `select (select count(*) from players where platform = $1) as players,
              (select count(*) from matches where platform = $1) as matches,
              (select patch from matches where platform = $1 order by game_creation desc limit 1) as patch`,
      [platform],
    );
    return { players: Number(r?.players ?? 0), matches: Number(r?.matches ?? 0), patch: r?.patch ?? null };
  }

  close() {
    this.conn.closeSync();
  }
}
