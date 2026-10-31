/**
 * Calcula builds, matchups y tier list desde el lake y los publica en Turso.
 * Cada (parche, plataforma, elo) se sustituye entero, así la web nunca ve
 * datos a medio escribir.
 */
import { listValue } from "@duckdb/node-api";
import { upsertAccounts } from "@riftlens/core";
import { schema, type Benchmark, type ChampionBuild, type Db } from "@riftlens/db";
import { classifyItems, maxOrder, type StaticData } from "@riftlens/riot";
import { and, eq } from "drizzle-orm";
import { computeDetails, type DetailRow } from "./detail";
import { PUBLISHED_BRACKETS, type Lake, type PublishedBracket } from "./lake";

/** Por debajo de esta cuota de partidas en un rol lo consideramos ruido (off-role). */
const MIN_ROLE_SHARE = 0.03;

const n = (v: unknown) => Number(v ?? 0);
const key = (champ: number, pos: string) => `${champ}|${pos}`;

function pushTop<T extends { games: number }>(map: Map<string, T[]>, k: string, entry: T, limit: number) {
  const list = map.get(k) ?? [];
  list.push(entry);
  list.sort((a, b) => b.games - a.games);
  if (list.length > limit) list.length = limit;
  map.set(k, list);
}

/**
 * Sube a la web los Riot IDs que el crawler ha visto y aún no había publicado:
 * alimentan las sugerencias de búsqueda. Solo escribe jugadores nuevos.
 */
export async function publishAccounts(lake: Lake, db: Db, platform: string) {
  const rows = await lake.all<{ puuid: string; game_name: string; tag_line: string }>(
    `select p.puuid, any_value(p.game_name) as game_name, any_value(p.tag_line) as tag_line
     from participants p join matches m on m.match_id = p.match_id
     where m.platform = $1 and p.game_name is not null and p.tag_line is not null
       and p.puuid not in (select puuid from published_accounts)
     group by p.puuid`,
    [platform],
  );
  const CHUNK = 1000;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    await upsertAccounts(db, slice.map((r) => ({ puuid: r.puuid, gameName: r.game_name, tagLine: r.tag_line, platform })));
    await lake.conn.run("insert into published_accounts select unnest($1::varchar[]) on conflict do nothing", [JSON.stringify(slice.map((r) => r.puuid))]);
  }
  return rows.length;
}

export interface AggregateResult {
  bracket: PublishedBracket;
  matches: number;
  champions: number;
}

export async function aggregate(lake: Lake, db: Db, data: StaticData, opts: { platform: string; patch: string }) {
  const { legendary, boots } = classifyItems(data);
  const legend = listValue([...legendary]);
  const bootIds = listValue([...boots.keys()]);
  const bootBase = listValue([...boots.values()]);
  const results: AggregateResult[] = [];

  for (const [bracket, members] of Object.entries(PUBLISHED_BRACKETS) as [PublishedBracket, readonly string[]][]) {
    // $1 plataforma, $2 parche, $3 grupos de elo incluidos
    const base = [opts.platform, opts.patch, listValue([...members])];
    const scope = `m.platform = $1 and m.patch = $2 and list_contains($3, m.bracket)`;
    const from = `participants p join matches m on m.match_id = p.match_id where ${scope} and p.position <> ''`;

    const [{ total } = { total: 0 }] = await lake.all<{ total: bigint }>(`select count(*) as total from matches m where ${scope}`, base);
    const matches = n(total);
    if (!matches) continue;

    const statRows = await lake.all<{ champion_id: number; position: string; games: bigint; wins: bigint }>(
      `select p.champion_id, p.position, count(*) as games, sum(p.win::int) as wins from ${from} group by all`,
      base,
    );
    const banRows = await lake.all<{ champion_id: number; bans: bigint }>(
      `select b.champion_id, count(distinct b.match_id) as bans from bans b join matches m on m.match_id = b.match_id where ${scope} group by all`,
      base,
    );
    const bans = new Map(banRows.map((r) => [r.champion_id, n(r.bans)]));
    const champGames = new Map<number, number>();
    for (const r of statRows) champGames.set(r.champion_id, (champGames.get(r.champion_id) ?? 0) + n(r.games));

    const stats = statRows
      .map((r) => ({
        championId: r.champion_id,
        position: r.position,
        games: n(r.games),
        wins: n(r.wins),
        bans: bans.get(r.champion_id) ?? 0,
        roleShare: n(r.games) / (champGames.get(r.champion_id) ?? 1),
      }))
      .filter((s) => s.roleShare >= MIN_ROLE_SHARE);
    const valid = new Set(stats.map((s) => key(s.championId, s.position)));

    const builds = new Map<string, ChampionBuild>();
    const build = (k: string) => {
      let b = builds.get(k);
      if (!b) builds.set(k, (b = { runes: [], spells: [], boots: [], items: [], core: [] }));
      return b;
    };
    /** Las N opciones más jugadas por campeón y rol de una consulta agrupada. */
    const topN = (grouped: string, limit: number) =>
      `select * from (${grouped}) qualify row_number() over (partition by champion_id, position order by games desc) <= ${limit}`;

    for (const r of await lake.all<{ champion_id: number; position: string; primary_style: number; sub_style: number; perks: number[]; shards: number[]; games: bigint; wins: bigint }>(
      `${topN(`select p.champion_id, p.position, p.primary_style, p.sub_style,
              -- El orden de las dos secundarias no importa: lo normalizamos para no duplicar páginas
              list_concat(p.perks[1:4], list_sort(p.perks[5:6])) as perks, p.shards,
              count(*) as games, sum(p.win::int) as wins
       from ${from} and len(p.perks) = 6 group by all`, 4)}`,
      base,
    )) {
      const k = key(r.champion_id, r.position);
      if (valid.has(k)) build(k).runes.push({ primaryStyle: r.primary_style, subStyle: r.sub_style, perks: [...r.perks], shards: [...r.shards], games: n(r.games), wins: n(r.wins) });
    }

    for (const r of await lake.all<{ champion_id: number; position: string; s1: number; s2: number; games: bigint; wins: bigint }>(
      `${topN(`select p.champion_id, p.position, least(p.spell1, p.spell2) as s1, greatest(p.spell1, p.spell2) as s2, count(*) as games, sum(p.win::int) as wins
       from ${from} group by all`, 3)}`,
      base,
    )) {
      const k = key(r.champion_id, r.position);
      if (valid.has(k)) build(k).spells.push({ spells: [r.s1, r.s2], games: n(r.games), wins: n(r.wins) });
    }

    for (const r of await lake.all<{ champion_id: number; position: string; item: number; games: bigint; wins: bigint }>(
      `${topN(`select champion_id, position, item, count(*) as games, sum(win::int) as wins
       from (select p.champion_id, p.position, p.win, unnest(p.items) as item from ${from})
       where list_contains($4, item) group by all`, 10)}`,
      [...base, legend],
    )) {
      const k = key(r.champion_id, r.position);
      if (valid.has(k)) build(k).items.push({ item: r.item, games: n(r.games), wins: n(r.wins) });
    }

    for (const r of await lake.all<{ champion_id: number; position: string; item: number; games: bigint; wins: bigint }>(
      `${topN(`with bm as (select unnest($4) as id, unnest($5) as base_id)
       select champion_id, position, bm.base_id as item, count(*) as games, sum(win::int) as wins
       from (select p.champion_id, p.position, p.win, unnest(p.items) as item from ${from}) x
       join bm on bm.id = x.item group by all`, 3)}`,
      [...base, bootIds, bootBase],
    )) {
      const k = key(r.champion_id, r.position);
      if (valid.has(k)) build(k).boots.push({ item: r.item, games: n(r.games), wins: n(r.wins) });
    }

    // Build core: tríos de objetos completos que aparecen juntos en el inventario final.
    const trios = new Map<string, { games: number; wins: number }>();
    for (const r of await lake.all<{ champion_id: number; position: string; win: boolean; leg: number[] }>(
      `select p.champion_id, p.position, p.win, list_sort(list_distinct(list_filter(p.items, lambda x: list_contains($4, x)))) as leg
       from ${from} and len(list_filter(p.items, lambda x: list_contains($4, x))) >= 3`,
      [...base, legend],
    )) {
      const k = key(r.champion_id, r.position);
      if (!valid.has(k)) continue;
      const leg = [...r.leg];
      for (let a = 0; a < leg.length; a++)
        for (let b = a + 1; b < leg.length; b++)
          for (let c = b + 1; c < leg.length; c++) {
            const t = `${k}|${leg[a]},${leg[b]},${leg[c]}`;
            const e = trios.get(t) ?? { games: 0, wins: 0 };
            e.games++;
            if (r.win) e.wins++;
            trios.set(t, e);
          }
    }
    const coreTop = new Map<string, ChampionBuild["core"]>();
    for (const [t, e] of trios) {
      const [champ, pos, items] = t.split("|");
      pushTop(coreTop, `${champ}|${pos}`, { items: items!.split(",").map(Number), ...e }, 3);
    }
    for (const [k, list] of coreTop) build(k).core = list;

    // --- Fase 3: orden de compra y de habilidades (solo partidas con línea temporal)
    const orders = new Map<string, { games: number; wins: number }>();
    const skills = new Map<string, { games: number; wins: number }>();
    const starts = new Map<string, { games: number; wins: number }>();
    const bump = (m: Map<string, { games: number; wins: number }>, k: string, win: boolean) => {
      const e = m.get(k) ?? { games: 0, wins: 0 };
      e.games++;
      if (win) e.wins++;
      m.set(k, e);
    };
    for (const r of await lake.all<{ champion_id: number; position: string; win: boolean; purchases: number[] | null; skill_order: string | null }>(
      `select p.champion_id, p.position, p.win, p.purchases, p.skill_order from ${from} and p.purchases is not null`,
      base,
    )) {
      const k = key(r.champion_id, r.position);
      if (!valid.has(k)) continue;
      const firstThree: number[] = [];
      for (const it of r.purchases ?? []) {
        if (legendary.has(it) && !firstThree.includes(it)) firstThree.push(it);
        if (firstThree.length === 3) break;
      }
      if (firstThree.length === 3) bump(orders, `${k}|${firstThree.join(",")}`, r.win);
      const mo = r.skill_order ? maxOrder(r.skill_order) : null;
      if (mo) bump(skills, `${k}|${mo}`, r.win);
      if (r.skill_order && r.skill_order.length >= 3) bump(starts, `${k}|${r.skill_order.slice(0, 3)}`, r.win);
    }
    const topOf = <T extends { games: number }>(m: Map<string, { games: number; wins: number }>, limit: number, make: (rest: string) => Omit<T, "games" | "wins">) => {
      const out = new Map<string, T[]>();
      for (const [t, e] of m) {
        const [champ, pos, rest] = t.split("|");
        pushTop(out, `${champ}|${pos}`, { ...make(rest!), ...e } as unknown as T, limit);
      }
      return out;
    };
    for (const [k, list] of topOf<NonNullable<ChampionBuild["order"]>[number]>(orders, 3, (rest) => ({ items: rest.split(",").map(Number) }))) build(k).order = list;
    for (const [k, list] of topOf<NonNullable<ChampionBuild["skills"]>[number]>(skills, 3, (rest) => ({ order: rest }))) build(k).skills = list;
    for (const [k, list] of topOf<NonNullable<ChampionBuild["skillStart"]>[number]>(starts, 2, (rest) => ({ start: rest }))) build(k).skillStart = list;

    // --- Fase 3: referencias para el coach (medianas por campeón y rol)
    for (const r of await lake.all<{ champion_id: number; position: string; games: bigint; cs: number; gold: number; dmg: number; vision: number | null; deaths: number; kp: number }>(
      `select champion_id, position, count(*) as games,
              quantile_cont(cs / mins, 0.5) as cs, quantile_cont(gold / mins, 0.5) as gold,
              quantile_cont(damage / mins, 0.5) as dmg, quantile_cont(vision / mins, 0.5) as vision,
              quantile_cont(deaths, 0.5) as deaths, quantile_cont(kp, 0.5) as kp
       from (
         select p.*, m.duration / 60.0 as mins,
                (p.kills + p.assists) / greatest(1, sum(p.kills) over (partition by p.match_id, p.team_id)) as kp
         from participants p join matches m on m.match_id = p.match_id
         where ${scope} and p.position <> ''
       ) group by all`,
      base,
    )) {
      const k = key(r.champion_id, r.position);
      if (!valid.has(k)) continue;
      build(k).benchmark = {
        games: n(r.games),
        csPerMin: r.cs,
        goldPerMin: r.gold,
        damagePerMin: r.dmg,
        visionPerMin: r.vision,
        deaths: r.deaths,
        killParticipation: r.kp,
        csCurve: [],
        goldCurve: [],
        curveGames: 0,
      } satisfies Benchmark;
    }
    for (const r of await lake.all<{ champion_id: number; position: string; i: bigint; cs: number; gold: number; games: bigint }>(
      `select p.champion_id, p.position, r.i, quantile_cont(p.cs_at[r.i], 0.5) as cs, quantile_cont(p.gold_at[r.i], 0.5) as gold, count(*) as games
       from participants p join matches m on m.match_id = p.match_id, range(1, 26) r(i)
       where ${scope} and p.position <> '' and p.cs_at is not null and len(p.cs_at) >= r.i
       group by all order by p.champion_id, p.position, r.i`,
      base,
    )) {
      const b = builds.get(key(r.champion_id, r.position))?.benchmark;
      if (!b) continue;
      b.csCurve.push(Math.round(r.cs));
      b.goldCurve.push(Math.round(r.gold));
      if (Number(r.i) === 1) b.curveGames = n(r.games);
    }

    // --- Ficha detallada (explorador de objetos, counters por posición, objetivos…)
    const detailRows = (
      await lake.all<DetailRow & { game_creation: bigint | number }>(
        `select p.match_id, p.puuid, p.team_id, p.champion_id, p.position, p.win, p.kills, p.deaths, p.assists,
                p.cs, p.gold, p.damage, p.physical, p.magic, p.true_damage, p.heal, p.spree, p.neutral_cs, p.taken,
                p.spell1, p.spell2, p.primary_style, p.sub_style, p.perks, p.shards, p.purchases, p.purchase_t,
                p.skill_order, p.game_name, p.tag_line, m.duration, m.game_creation, m.teams
         from participants p join matches m on m.match_id = p.match_id where ${scope}`,
        base,
      )
    ).map((r) => ({ ...r, game_creation: Number(r.game_creation), perks: [...(r.perks ?? [])], shards: [...(r.shards ?? [])] }));
    const detailBans = await lake.all<{ match_id: string; champion_id: number }>(
      `select b.match_id, b.champion_id from bans b join matches m on m.match_id = b.match_id where ${scope}`,
      base,
    );
    const tiers = new Map(
      (await lake.all<{ puuid: string; tier: string }>(`select puuid, tier from players where platform = $1`, [opts.platform])).map((r) => [r.puuid, r.tier]),
    );
    for (const [k, detail] of computeDetails(detailRows, detailBans, tiers, legendary, valid)) build(k).detail = detail;

    const matchupRows = await lake.all<{ champion_id: number; position: string; opponent_id: number; games: bigint; wins: bigint }>(
      `select a.champion_id, a.position, b.champion_id as opponent_id, count(*) as games, sum(a.win::int) as wins
       from participants a
       join participants b on b.match_id = a.match_id and b.position = a.position and b.team_id <> a.team_id
       join matches m on m.match_id = a.match_id
       where ${scope} and a.position <> '' group by all`,
      base,
    );
    const matchups = matchupRows
      .filter((r) => valid.has(key(r.champion_id, r.position)))
      .map((r) => ({ championId: r.champion_id, position: r.position, opponentId: r.opponent_id, games: n(r.games), wins: n(r.wins) }));

    await publish(db, { ...opts, bracket, matches, stats, builds, matchups });
    results.push({ bracket, matches, champions: stats.length });
  }
  return results;
}

async function publish(
  db: Db,
  p: {
    platform: string;
    patch: string;
    bracket: string;
    matches: number;
    stats: Omit<typeof schema.championStats.$inferInsert, "patch" | "platform" | "bracket">[];
    builds: Map<string, ChampionBuild>;
    matchups: Omit<typeof schema.championMatchups.$inferInsert, "patch" | "platform" | "bracket">[];
  },
) {
  const scope = { patch: p.patch, platform: p.platform, bracket: p.bracket };
  const where = <T extends typeof schema.championStats | typeof schema.championBuilds | typeof schema.championMatchups>(t: T) =>
    and(eq(t.patch, p.patch), eq(t.platform, p.platform), eq(t.bracket, p.bracket));

  const chunk = <T>(rows: T[], size: number) => Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => rows.slice(i * size, (i + 1) * size));
  const buildRows = [...p.builds].map(([k, data]) => {
    const [championId, position] = k.split("|");
    return { ...scope, championId: Number(championId), position: position!, data };
  });

  await db.batch([
    db.delete(schema.championStats).where(where(schema.championStats)),
    db.delete(schema.championBuilds).where(where(schema.championBuilds)),
    db.delete(schema.championMatchups).where(where(schema.championMatchups)),
    ...chunk(p.stats.map((s) => ({ ...scope, ...s })), 400).map((rows) => db.insert(schema.championStats).values(rows)),
    ...chunk(buildRows, 200).map((rows) => db.insert(schema.championBuilds).values(rows)),
    ...chunk(p.matchups.map((m) => ({ ...scope, ...m })), 400).map((rows) => db.insert(schema.championMatchups).values(rows)),
    db
      .insert(schema.statsMeta)
      .values({ ...scope, matches: p.matches, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [schema.statsMeta.patch, schema.statsMeta.platform, schema.statsMeta.bracket],
        set: { matches: p.matches, updatedAt: new Date() },
      }),
  ]);
}
