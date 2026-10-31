/**
 * Ficha detallada por campeón y rol: builds (más jugada y de mayor winrate),
 * explorador de objetos, habilidades por nivel, runas, counters y sinergias por
 * posición, objetivos, duración, estadísticas medias, tendencia diaria, base de
 * jugadores y mejores jugadores. Se calcula en memoria a partir del lake.
 */
import type { BuildEntry, BuildVariant, ChampionDetail } from "@riftlens/db";
import { maxOrder } from "@riftlens/riot";

export interface DetailRow {
  match_id: string;
  puuid: string;
  team_id: number;
  champion_id: number;
  position: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold: number;
  damage: number;
  physical: number | null;
  magic: number | null;
  true_damage: number | null;
  heal: number | null;
  spree: number | null;
  neutral_cs: number | null;
  taken: number | null;
  spell1: number;
  spell2: number;
  primary_style: number;
  sub_style: number;
  perks: number[];
  shards: number[];
  purchases: number[] | null;
  purchase_t: number[] | null;
  skill_order: string | null;
  game_name: string | null;
  tag_line: string | null;
  duration: number;
  game_creation: number;
  teams: string | null;
}

type Acc = { games: number; wins: number };
const acc = (): Acc => ({ games: 0, wins: 0 });
const add = (m: Map<string, Acc>, k: string, win: boolean) => {
  const a = m.get(k) ?? acc();
  a.games++;
  if (win) a.wins++;
  m.set(k, a);
};
const entries = (m: Map<string, Acc>) => [...m].map(([k, v]) => ({ k, ...v }));
const top = <T extends { games: number }>(list: T[], n: number) => [...list].sort((a, b) => b.games - a.games).slice(0, n);

const TRINKETS = new Set([3340, 3363, 3364, 3330, 3513, 2052]);
/** Objetivos de la partida que analizamos (clave de Riot -> clave nuestra). */
const OBJECTIVES: [string, string][] = [
  ["champion", "firstBlood"],
  ["tower", "firstTower"],
  ["inhibitor", "firstInhibitor"],
  ["horde", "firstHorde"],
  ["riftHerald", "firstHerald"],
  ["dragon", "firstDragon"],
  ["baron", "firstBaron"],
  ["atakhan", "firstAtakhan"],
];
const BUCKETS: [number, string][] = [
  [20, "0–20"],
  [25, "20–25"],
  [30, "25–30"],
  [35, "30–35"],
  [40, "35–40"],
  [Infinity, "40+"],
];
const STAT_KEYS = ["damage", "physical", "magic", "true", "taken", "heal", "kills", "deaths", "assists", "spree", "gold", "minions", "neutral"] as const;

interface Work {
  rows: DetailRow[];
  counters: Map<string, Map<number, Acc>>;
  synergy: Map<string, Map<number, Acc>>;
  sides: { blue: Acc; red: Acc };
  objectives: Map<string, { secure: Acc; yield: Acc }>;
  duration: Map<string, Acc>;
  stats: Record<(typeof STAT_KEYS)[number], { sum: number; n: number }>;
  spells: Map<string, Acc>;
  levels: Map<string, Acc>[];
  priority: Map<string, Acc>;
  paths: Map<string, Acc>;
  runes: Map<string, Acc>;
  pages: Map<string, Acc>;
  starting: Map<string, Acc>;
  early: Map<string, Acc>;
  positions: { acc: Map<string, Acc>; minutes: Map<string, number> }[];
  all: { acc: Map<string, Acc>; minutes: Map<string, number> };
  cores: Map<string, Acc>;
  trend: Map<string, Acc>;
  players: Map<string, Acc & { name: string; tag: string }>;
  gameAvg: { sum: number; n: number };
}

const newWork = (): Work => ({
  rows: [],
  counters: new Map(),
  synergy: new Map(),
  sides: { blue: acc(), red: acc() },
  objectives: new Map(),
  duration: new Map(),
  stats: Object.fromEntries(STAT_KEYS.map((k) => [k, { sum: 0, n: 0 }])) as Work["stats"],
  spells: new Map(),
  levels: Array.from({ length: 18 }, () => new Map()),
  priority: new Map(),
  paths: new Map(),
  runes: new Map(),
  pages: new Map(),
  starting: new Map(),
  early: new Map(),
  positions: Array.from({ length: 6 }, () => ({ acc: new Map(), minutes: new Map() })),
  all: { acc: new Map(), minutes: new Map() },
  cores: new Map(),
  trend: new Map(),
  players: new Map(),
  gameAvg: { sum: 0, n: 0 },
});

export function computeDetails(
  rows: DetailRow[],
  bans: { match_id: string; champion_id: number }[],
  tiers: Map<string, string>,
  legendary: Set<number>,
  valid: Set<string>,
): Map<string, ChampionDetail> {
  const key = (r: { champion_id: number; position: string }) => `${r.champion_id}|${r.position}`;

  // Winrate general de cada campeón-rol (para las expectativas y los deltas)
  const overall = new Map<string, Acc>();
  for (const r of rows) if (r.position) add(overall, key(r), r.win);
  const wr = (k: string) => {
    const a = overall.get(k);
    return a && a.games ? a.wins / a.games : 0.5;
  };

  const byMatch = new Map<string, DetailRow[]>();
  for (const r of rows) byMatch.set(r.match_id, [...(byMatch.get(r.match_id) ?? []), r]);
  const teamsOf = new Map<string, Record<string, Record<string, { first?: boolean; kills?: number }>>>();
  const matchDay = new Map<string, string>();
  for (const [id, list] of byMatch) {
    const first = list[0]!;
    matchDay.set(id, new Date(first.game_creation).toISOString().slice(0, 10));
    try {
      if (first.teams) teamsOf.set(id, JSON.parse(first.teams));
    } catch {
      /* partida sin objetivos */
    }
  }
  const matchesPerDay = new Map<string, number>();
  for (const day of matchDay.values()) matchesPerDay.set(day, (matchesPerDay.get(day) ?? 0) + 1);
  const bansPerDay = new Map<string, Map<number, number>>();
  for (const b of bans) {
    const day = matchDay.get(b.match_id);
    if (!day) continue;
    const m = bansPerDay.get(day) ?? new Map();
    m.set(b.champion_id, (m.get(b.champion_id) ?? 0) + 1);
    bansPerDay.set(day, m);
  }

  const work = new Map<string, Work>();
  for (const r of rows) {
    if (!r.position) continue;
    const k = key(r);
    if (!valid.has(k)) continue;
    const w = work.get(k) ?? newWork();
    work.set(k, w);
    w.rows.push(r);
    const others = (byMatch.get(r.match_id) ?? []).filter((o) => o.puuid !== r.puuid);

    // Expectativa por los otros 9 campeones y counters/sinergias por posición
    let exp = 0;
    let n = 0;
    for (const o of others) {
      const ok = key(o);
      const target = o.team_id === r.team_id ? w.synergy : w.counters;
      if (o.position) {
        const byChamp = target.get(o.position) ?? new Map<number, Acc>();
        const a = byChamp.get(o.champion_id) ?? acc();
        a.games++;
        if (r.win) a.wins++;
        byChamp.set(o.champion_id, a);
        target.set(o.position, byChamp);
      }
      exp += o.team_id === r.team_id ? wr(ok) : 1 - wr(ok);
      n++;
    }
    if (n) {
      w.gameAvg.sum += exp / n;
      w.gameAvg.n++;
    }

    const side = r.team_id === 100 ? w.sides.blue : w.sides.red;
    side.games++;
    if (r.win) side.wins++;

    const teams = teamsOf.get(r.match_id);
    if (teams) {
      const mine = teams[String(r.team_id)] ?? {};
      const theirs = teams[String(r.team_id === 100 ? 200 : 100)] ?? {};
      const objective = (name: string, secured: boolean | undefined, yielded: boolean | undefined) => {
        const o = w.objectives.get(name) ?? { secure: acc(), yield: acc() };
        if (secured) (o.secure.games++, r.win && o.secure.wins++);
        else if (yielded) (o.yield.games++, r.win && o.yield.wins++);
        w.objectives.set(name, o);
      };
      for (const [riot, ours] of OBJECTIVES) if (riot in mine || riot in theirs) objective(ours, mine[riot]?.first, theirs[riot]?.first);
      // Alma de dragón: el equipo que llega a 4 dragones
      objective("dragonSoul", (mine.dragon?.kills ?? 0) >= 4, (theirs.dragon?.kills ?? 0) >= 4);
    }

    const minutes = r.duration / 60;
    add(w.duration, BUCKETS.find(([max]) => minutes < max)![1], r.win);

    const st = w.stats;
    const push = (k: (typeof STAT_KEYS)[number], v: number | null) => {
      if (v === null || v === undefined) return;
      st[k].sum += v;
      st[k].n++;
    };
    push("damage", r.damage);
    push("physical", r.physical);
    push("magic", r.magic);
    push("true", r.true_damage);
    push("taken", r.taken);
    push("heal", r.heal);
    push("kills", r.kills);
    push("deaths", r.deaths);
    push("assists", r.assists);
    push("spree", r.spree);
    push("gold", r.gold);
    push("minions", r.neutral_cs === null ? null : r.cs - r.neutral_cs);
    push("neutral", r.neutral_cs);

    add(w.spells, [Math.min(r.spell1, r.spell2), Math.max(r.spell1, r.spell2)].join(","), r.win);

    if (r.skill_order) {
      [...r.skill_order.slice(0, 18)].forEach((s, i) => add(w.levels[i]!, s, r.win));
      const mo = maxOrder(r.skill_order);
      if (mo) add(w.priority, mo, r.win);
      if (r.skill_order.length >= 15) add(w.paths, r.skill_order.slice(0, 15), r.win);
    }

    if (r.perks.length === 6) {
      for (const p of r.perks) add(w.runes, String(p), r.win);
      r.shards.forEach((s, i) => add(w.runes, `s${i}:${s}`, r.win));
      const perks = [...r.perks.slice(0, 4), ...r.perks.slice(4).sort((a, b) => a - b)];
      add(w.pages, JSON.stringify({ primaryStyle: r.primary_style, subStyle: r.sub_style, perks, shards: r.shards }), r.win);
    }

    if (r.purchases && r.purchase_t && r.purchases.length === r.purchase_t.length) {
      const start = r.purchases.filter((it, i) => r.purchase_t![i]! <= 60 && !TRINKETS.has(it)).sort((a, b) => a - b);
      if (start.length) add(w.starting, start.join(","), r.win);
      const early = new Set<number>();
      r.purchases.forEach((it, i) => {
        const t = r.purchase_t![i]!;
        if (t > 60 && t <= 600 && !TRINKETS.has(it)) early.add(it);
      });
      for (const it of early) add(w.early, String(it), r.win);

      const legend: { item: number; t: number }[] = [];
      r.purchases.forEach((it, i) => {
        if (legendary.has(it) && !legend.some((l) => l.item === it)) legend.push({ item: it, t: r.purchase_t![i]! });
      });
      legend.slice(0, 6).forEach((l, i) => {
        const pos = w.positions[i]!;
        add(pos.acc, String(l.item), r.win);
        pos.minutes.set(String(l.item), (pos.minutes.get(String(l.item)) ?? 0) + l.t / 60);
      });
      for (const l of legend) {
        add(w.all.acc, String(l.item), r.win);
        w.all.minutes.set(String(l.item), (w.all.minutes.get(String(l.item)) ?? 0) + l.t / 60);
      }
      if (legend.length >= 3) add(w.cores, legend.slice(0, 3).map((l) => l.item).join(","), r.win);
    }

    add(w.trend, matchDay.get(r.match_id) ?? "", r.win);
    const p = w.players.get(r.puuid) ?? { ...acc(), name: r.game_name ?? "", tag: r.tag_line ?? "" };
    p.games++;
    if (r.win) p.wins++;
    if (r.game_name) (p.name = r.game_name), (p.tag = r.tag_line ?? "");
    w.players.set(r.puuid, p);
  }

  // Base de jugadores normalizada: popularidad (pick relativo) y profundidad (partidas por jugador)
  const allPlayers = new Set(rows.map((r) => r.puuid)).size || 1;
  const globalDepth = rows.length / allPlayers;
  const avgGames = [...work.values()].reduce((s, w) => s + w.rows.length, 0) / Math.max(1, work.size);

  const out = new Map<string, ChampionDetail>();
  const statValues = new Map<string, Record<string, number>>();
  for (const [k, w] of work) {
    const games = w.rows.length;
    const champWr = wr(k);
    const minGames = Math.max(5, Math.round(games * 0.03));
    // "Mejor" = mayor winrate encogido hacia el del campeón, con muestra mínima
    const pick = (m: Map<string, Acc>, mode: "best" | "common") => {
      const list = entries(m).filter((e) => e.k && (mode === "common" || e.games >= minGames));
      if (!list.length) return null;
      const score = (e: Acc) => (mode === "common" ? e.games : (e.wins + 10 * champWr) / (e.games + 10));
      return list.reduce((a, b) => (score(b) > score(a) ? b : a));
    };
    const toEntry = (e: { games: number; wins: number } | null): BuildEntry | null => (e ? { games: e.games, wins: e.wins } : null);
    const variant = (mode: "best" | "common"): BuildVariant => {
      const skills = pick(w.priority, mode);
      const path = pick(w.paths, mode);
      const spells = pick(w.spells, mode);
      const page = pick(w.pages, mode);
      const start = pick(w.starting, mode);
      const core = pick(w.cores, mode);
      const coreItems = core ? core.k.split(",").map(Number) : [];
      return {
        skills: skills?.k ?? null,
        skillPath: path?.k ?? null,
        spells: spells ? (spells.k.split(",").map(Number) as [number, number]) : null,
        runes: page ? JSON.parse(page.k) : null,
        starting: start ? start.k.split(",").map(Number) : [],
        core: coreItems,
        next: [3, 4, 5].map((i) => {
          const list = entries(w.positions[i]!.acc).filter((e) => !coreItems.includes(Number(e.k)));
          const sorted = mode === "common" ? top(list, 3) : list.filter((e) => e.games >= Math.max(3, minGames / 3)).sort((a, b) => (b.wins + 5 * champWr) / (b.games + 5) - (a.wins + 5 * champWr) / (a.games + 5)).slice(0, 3);
          return sorted.map((e) => ({ item: Number(e.k), games: e.games, wins: e.wins }));
        }),
        support: { skills: toEntry(skills), runes: toEntry(page), core: toEntry(core), starting: toEntry(start), spells: toEntry(spells) },
      };
    };

    const withMinutes = (bucket: { acc: Map<string, Acc>; minutes: Map<string, number> }, n: number) =>
      top(entries(bucket.acc), n).map((e) => ({ item: Number(e.k), games: e.games, wins: e.wins, minute: Math.round((bucket.minutes.get(e.k) ?? 0) / e.games) }));

    const groupTop = (m: Map<string, Map<number, Acc>>) =>
      Object.fromEntries(
        [...m].map(([pos, byChamp]) => [
          pos,
          top(
            [...byChamp].map(([championId, a]) => ({ championId, ...a, otherWr: wr(`${championId}|${pos}`) })),
            40,
          ),
        ]),
      );

    const stats: Record<string, number> = {};
    for (const s of STAT_KEYS) if (w.stats[s].n) stats[s] = w.stats[s].sum / w.stats[s].n;
    statValues.set(k, stats);

    const days = [...w.trend].filter(([d]) => d).sort(([a], [b]) => a.localeCompare(b)).slice(-30);
    out.set(k, {
      gameAvgWr: w.gameAvg.n ? w.gameAvg.sum / w.gameAvg.n : 0.5,
      builds: { best: variant("best"), common: variant("common") },
      items: {
        starting: top(entries(w.starting), 8).map((e) => ({ items: e.k.split(",").map(Number), games: e.games, wins: e.wins })),
        early: top(entries(w.early), 14).map((e) => ({ item: Number(e.k), games: e.games, wins: e.wins })),
        byPosition: w.positions.slice(0, 5).map((p) => withMinutes(p, 12)),
        all: withMinutes(w.all, 40),
      },
      spells: top(entries(w.spells), 6).map((e) => ({ spells: e.k.split(",").map(Number) as [number, number], games: e.games, wins: e.wins })),
      skillLevels: w.levels.map((lvl) => ({
        q: lvl.get("Q") ?? acc(),
        w: lvl.get("W") ?? acc(),
        e: lvl.get("E") ?? acc(),
        r: lvl.get("R") ?? acc(),
      })),
      skillPriority: top(entries(w.priority), 6).map((e) => ({ order: e.k, games: e.games, wins: e.wins })),
      runeStats: Object.fromEntries(entries(w.runes).map((e) => [e.k, { games: e.games, wins: e.wins }])),
      counters: groupTop(w.counters),
      synergy: groupTop(w.synergy),
      sides: w.sides,
      objectives: [...w.objectives].map(([key, o]) => ({ key, secure: o.secure, yield: o.yield })),
      duration: BUCKETS.map(([, bucket]) => ({ bucket, ...(w.duration.get(bucket) ?? acc()) })),
      stats: {},
      trend: days.map(([day, a]) => ({
        day,
        games: a.games,
        wins: a.wins,
        bans: bansPerDay.get(day)?.get(Number(k.split("|")[0])) ?? 0,
        matches: matchesPerDay.get(day) ?? 0,
      })),
      playerBase: {
        players: w.players.size,
        popularity: games / Math.max(1, avgGames),
        depth: games / Math.max(1, w.players.size) / Math.max(1e-9, globalDepth),
      },
      bestPlayers: [...w.players.entries()]
        .filter(([, p]) => p.games >= 5 && p.name)
        .sort(([, a], [, b]) => (b.wins + 1) / (b.games + 2) - (a.wins + 1) / (a.games + 2) || b.games - a.games)
        .slice(0, 10)
        .map(([puuid, p]) => ({ gameName: p.name, tagLine: p.tag, tier: tiers.get(puuid) ?? null, games: p.games, wins: p.wins })),
    });
  }

  // Puesto de cada estadística entre los campeones del mismo rol (1 = valor más alto)
  for (const [k, detail] of out) {
    const pos = k.split("|")[1];
    const peers = [...statValues].filter(([pk]) => pk.split("|")[1] === pos);
    for (const [stat, value] of Object.entries(statValues.get(k) ?? {})) {
      const values = peers.map(([, v]) => v[stat]).filter((v): v is number => v !== undefined);
      detail.stats[stat] = { value, rank: values.filter((v) => v > value).length + 1, of: values.length };
    }
  }
  return out;
}
