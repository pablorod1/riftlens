/**
 * Rellena la base de datos local con datos FICTICIOS para ver la web sin clave de Riot:
 * un perfil "Demo#EUW" con 20 partidas y un ranking de EUW de 60 jugadores.
 *
 *   bun run seed:demo        # luego abre /es/summoner/euw/Demo-EUW
 */
import { ladderPuuidsWithoutName, refreshApexLadder, refreshProfile, resolveAccounts } from "@riftlens/core";
import { getDb, schema } from "@riftlens/db";
import { latestVersion, loadStaticData, patchFromVersion } from "@riftlens/riot";
import { resolve } from "node:path";
import { aggregate } from "./lake/aggregate";
import { Lake } from "./lake/lake";
import { and, count, eq, notLike } from "drizzle-orm";
import { regionBySlug, RiotClient, type FetchLike } from "@riftlens/riot";

const ME = "demo-puuid";
const PUUIDS = [ME, ...Array.from({ length: 9 }, (_, i) => `demo-player-${i + 1}`)];
const POS = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
// Campeones por posición (claves de Data Dragon) y builds verosímiles
const CHAMPS = [[266, 122, 86], [64, 254, 121], [103, 238, 134], [222, 51, 202], [412, 117, 111]];
const ITEMS = [[3078, 3053, 3047, 6333, 3071], [6692, 3071, 3111, 6333, 3742], [6655, 3089, 3020, 3135, 3157], [3031, 6672, 3006, 3094, 3036], [3190, 3107, 3117, 3222, 2065]];
const MY_POOL = [103, 103, 238, 103, 134, 238];

const rnd = (seed: number) => {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};

function participant(n: number, i: number) {
  const pos = i % 5;
  const team = i < 5 ? 100 : 200;
  const blueWins = rnd(n) > 0.4;
  const r = (k: number) => rnd(n * 31 + i * 7 + k);
  const champ = i === 0 ? MY_POOL[n % MY_POOL.length]! : CHAMPS[pos]![(n + i) % 3]!;
  const items = ITEMS[pos]!.map((it, j) => (r(j) > 0.15 ? it : 0));
  return {
    puuid: PUUIDS[i]!, participantId: i + 1, teamId: team,
    riotIdGameName: i === 0 ? "Demo" : `Player ${i}`, riotIdTagline: "EUW",
    championId: champ, championName: "", champLevel: 12 + Math.floor(r(1) * 6),
    teamPosition: i === 0 ? "MIDDLE" : POS[pos], individualPosition: "",
    win: (team === 100) === blueWins,
    kills: Math.floor(r(2) * 12), deaths: Math.floor(r(3) * 8), assists: Math.floor(r(4) * 14),
    totalMinionsKilled: pos === 1 || pos === 4 ? Math.floor(20 + r(5) * 40) : Math.floor(140 + r(5) * 110),
    neutralMinionsKilled: pos === 1 ? Math.floor(120 + r(6) * 60) : Math.floor(r(6) * 12),
    goldEarned: Math.floor(8000 + r(7) * 7000), totalDamageDealtToChampions: Math.floor(9000 + r(8) * 28000),
    totalDamageTaken: Math.floor(10000 + r(9) * 20000), visionScore: Math.floor(10 + r(10) * (pos === 4 ? 70 : 30)),
    wardsPlaced: 8, wardsKilled: 2, visionWardsBoughtInGame: 2,
    item0: items[0], item1: items[1], item2: items[2], item3: items[3], item4: items[4], item5: 0, item6: pos === 4 ? 3364 : 3340,
    summoner1Id: 4, summoner2Id: pos === 1 ? 11 : pos === 4 ? 3 : 14,
    perks: { styles: [
      { description: "primaryStyle", style: pos === 0 ? 8000 : 8100, selections: [{ perk: pos === 0 ? 8010 : 8112, var1: 0, var2: 0, var3: 0 }] },
      { description: "subStyle", style: pos === 0 ? 8400 : 8300, selections: [] },
    ] },
    gameEndedInEarlySurrender: n === 9, gameEndedInSurrender: false,
    doubleKills: r(11) > 0.6 ? 1 : 0, tripleKills: r(12) > 0.85 ? 1 : 0, quadraKills: 0, pentaKills: i === 0 && n === 3 ? 1 : 0,
  };
}

const match = (n: number) => ({
  metadata: { matchId: `EUW1_DEMO${1000 + n}`, participants: PUUIDS, dataVersion: "2" },
  info: {
    gameCreation: Date.now() - (n * 2.5 + 0.3) * 3600_000, gameStartTimestamp: 0,
    gameDuration: n === 9 ? 210 : 1380 + Math.floor(rnd(n) * 900),
    gameMode: "CLASSIC", gameType: "MATCHED_GAME", gameVersion: "16.21.1.1", mapId: 11, platformId: "EUW1",
    queueId: n % 5 === 2 ? 440 : n % 7 === 6 ? 450 : 420, teams: [],
    participants: PUUIDS.map((_, i) => participant(n, i)),
  },
});

const league = (tier: string, count: number, offset: number) => ({
  leagueId: "demo", tier, name: "demo", queue: "RANKED_SOLO_5x5",
  entries: Array.from({ length: count }, (_, i) => ({
    puuid: `demo-ladder-${offset + i}`, leaguePoints: Math.max(0, 1850 - (offset + i) * 23 - Math.floor(rnd(i) * 10)), rank: "I",
    wins: 180 + Math.floor(rnd(i + offset) * 160), losses: 140 + Math.floor(rnd(i + offset + 1) * 120),
    hotStreak: rnd(i + offset + 2) > 0.8, veteran: false, freshBlood: false, inactive: false,
  })),
});

const NAMES = ["Kairo", "Velvet Rift", "Nocturne Main", "sunset", "Hexwalker", "Mira", "Lumen", "ZeroWard", "Tidecaller", "Ashen", "Quill", "Orbit"];

const fakeRiot: FetchLike = async (input) => {
  const { pathname: p } = new URL(String(input));
  const json = (b: unknown) => new Response(JSON.stringify(b), { headers: { "content-type": "application/json" } });
  if (p.includes("/accounts/by-riot-id/")) return json({ puuid: ME, gameName: "Demo", tagLine: "EUW" });
  if (p.includes("/accounts/by-puuid/")) {
    const id = p.split("/").pop()!;
    const n = Number(id.split("-").pop());
    return json({ puuid: id, gameName: id === ME ? "Demo" : `${NAMES[n % NAMES.length]}${n >= NAMES.length ? n : ""}`, tagLine: "EUW" });
  }
  if (p.includes("/summoners/by-puuid/")) return json({ puuid: ME, profileIconId: 6610, revisionDate: 0, summonerLevel: 412 });
  if (p.includes("/entries/by-puuid/")) {
    return json([
      { puuid: ME, queueType: "RANKED_SOLO_5x5", tier: "EMERALD", rank: "I", leaguePoints: 74, wins: 88, losses: 71, hotStreak: true },
      { puuid: ME, queueType: "RANKED_FLEX_SR", tier: "PLATINUM", rank: "II", leaguePoints: 12, wins: 14, losses: 15, hotStreak: false },
    ]);
  }
  if (p.endsWith("/ids")) return json(Array.from({ length: 20 }, (_, i) => `EUW1_DEMO${1000 + i}`));
  if (p.includes("/matches/EUW1_DEMO")) return json(match(Number(p.split("DEMO").pop()) - 1000));
  if (p.includes("challengerleagues")) return json(league("CHALLENGER", 12, 0));
  if (p.includes("grandmasterleagues")) return json(league("GRANDMASTER", 18, 12));
  if (p.includes("masterleagues")) return json(league("MASTER", 30, 30));
  return new Response("{}", { status: 404 });
};

const db = getDb();
const riot = new RiotClient({ apiKey: "demo", rateLimits: "1000:1", fetch: fakeRiot });
const euw = regionBySlug("euw")!;
await refreshProfile(db, riot, euw, { gameName: "Demo", tagLine: "EUW" });

// Nunca pisamos un ranking real: el de demo solo se carga si EUW está vacío o ya era de demo.
const [real] = await db
  .select({ n: count() })
  .from(schema.ladderEntries)
  .where(and(eq(schema.ladderEntries.platform, euw.platform), notLike(schema.ladderEntries.puuid, "demo-%")));
if (real && real.n > 0) {
  console.log(`Ranking de EUW con ${real.n} jugadores reales: no se sustituye por el de demo.`);
} else {
  await refreshApexLadder(db, riot, euw);
  await resolveAccounts(db, riot, euw, await ladderPuuidsWithoutName(db, euw.platform, 100));
}
// --- Fase 2: partidas sintéticas para la tier list y las páginas de campeón ---------
const [realStats] = await db
  .select({ n: count() })
  .from(schema.statsMeta)
  .where(and(eq(schema.statsMeta.platform, euw.platform), notLike(schema.statsMeta.patch, "demo%")));
if (realStats && realStats.n > 0) {
  console.log("Ya hay estadísticas reales de EUW: no se generan las de demo.");
} else {
  const patch = patchFromVersion(await latestVersion());
  // Lake propio: nunca mezclamos partidas inventadas con las reales
  const lake = await Lake.open(resolve(process.cwd(), "../../data/demo.duckdb"));
  const { matches } = await lake.stats(euw.platform);
  if (matches === 0) {
    const POOLS: Record<string, number[]> = {
      TOP: [266, 122, 86, 24, 58, 240, 887, 516],
      JUNGLE: [64, 254, 121, 59, 141, 234, 876, 427],
      MIDDLE: [103, 238, 134, 4, 61, 517, 112, 7],
      BOTTOM: [222, 51, 202, 145, 81, 236, 498, 895],
      UTILITY: [412, 117, 111, 89, 526, 497, 350, 43],
    };
    const BUILDS: Record<string, number[]> = {
      TOP: [3078, 6333, 3053, 3071, 6692, 3742, 3181],
      JUNGLE: [6692, 3071, 3142, 6333, 3156, 3814, 6694],
      MIDDLE: [6655, 3089, 3135, 3157, 4645, 3165, 3116],
      BOTTOM: [3031, 6672, 3094, 3036, 3072, 3046, 6675],
      UTILITY: [3190, 3107, 3109, 2065, 3222, 3050, 4005],
    };
    const BOOTS: Record<string, number[]> = { TOP: [3047, 3111], JUNGLE: [3047, 3111], MIDDLE: [3020, 3158], BOTTOM: [3006, 3009], UTILITY: [3158, 3047] };
    const RUNES: Record<string, { style: number; perks: number[]; sub: number; subPerks: number[] }[]> = {
      TOP: [{ style: 8000, perks: [8010, 9111, 9104, 8299], sub: 8400, subPerks: [8444, 8242] }],
      JUNGLE: [{ style: 8100, perks: [8128, 8143, 8138, 8135], sub: 8000, subPerks: [9111, 8014] }],
      MIDDLE: [{ style: 8100, perks: [8112, 8139, 8138, 8135], sub: 8300, subPerks: [8345, 8347] }, { style: 8200, perks: [8229, 8226, 8210, 8237], sub: 8300, subPerks: [8345, 8347] }],
      BOTTOM: [{ style: 8000, perks: [8008, 9111, 9104, 8017], sub: 8100, subPerks: [8139, 8135] }],
      UTILITY: [{ style: 8400, perks: [8439, 8463, 8473, 8242], sub: 8300, subPerks: [8345, 8347] }],
    };
    const SPELLS: Record<string, [number, number]> = { TOP: [4, 12], JUNGLE: [4, 11], MIDDLE: [4, 14], BOTTOM: [4, 7], UTILITY: [4, 14] };
    // Cada campeón tiene una "fuerza" fija para que la tier list tenga forma
    const strength = (champ: number) => (rnd(champ) - 0.5) * 0.16;
    const pick = <T,>(arr: T[], seed: number) => arr[Math.floor(rnd(seed) * arr.length)]!;
    for (let n = 0; n < 900; n++) {
      const comp = POS.map((pos, i) => [pick(POOLS[pos]!, n * 13 + i), pick(POOLS[pos]!.filter((c) => c !== pick(POOLS[pos]!, n * 13 + i)), n * 17 + i + 5)] as const);
      const edge = comp.reduce((s, [a, b]) => s + strength(a) - strength(b), 0);
      const blueWins = rnd(n * 7 + 3) < 0.5 + edge;
      const participants = [100, 200].flatMap((team, t) =>
        POS.map((pos, i) => {
          const champ = comp[i]![t]!;
          const r = (k: number) => rnd(n * 101 + t * 11 + i * 3 + k);
          const pool = BUILDS[pos]!;
          const items = [...pool].sort((a, b) => rnd(a * (champ + 1)) - rnd(b * (champ + 1)) + (r(1) - 0.5) * 0.6).slice(0, 3 + Math.floor(r(2) * 2));
          const rune = pick(RUNES[pos]!, champ + n);
          return {
            ...participant(n, t * 5 + i),
            puuid: `demo-lake-${n}-${team}-${i}`, participantId: t * 5 + i + 1, teamId: team, championId: champ,
            teamPosition: pos, win: (team === 100) === blueWins,
            item0: items[0] ?? 0, item1: items[1] ?? 0, item2: items[2] ?? 0, item3: items[3] ?? 0, item4: pick(BOOTS[pos]!, champ * 3 + Math.floor(r(3) * 1.4)), item5: 0,
            summoner1Id: SPELLS[pos]![0], summoner2Id: SPELLS[pos]![1],
            perks: {
              styles: [
                { description: "primaryStyle", style: rune.style, selections: rune.perks.map((perk) => ({ perk, var1: 0, var2: 0, var3: 0 })) },
                { description: "subStyle", style: rune.sub, selections: rune.subPerks.map((perk) => ({ perk, var1: 0, var2: 0, var3: 0 })) },
              ],
              statPerks: { offense: 5008, flex: 5008, defense: 5011 },
            },
            gameEndedInEarlySurrender: false,
          };
        }),
      );
      const m = match(n);
      await lake.insertMatch(
        {
          ...m,
          metadata: { ...m.metadata, matchId: `EUW1_DEMOLAKE${n}` },
          info: {
            ...m.info,
            gameVersion: `${patch}.1.1`,
            queueId: 420,
            participants: participants as never,
            teams: [100, 200].map((teamId, t) => ({ teamId: teamId as 100 | 200, win: (teamId === 100) === blueWins, objectives: {}, bans: [{ championId: pick(Object.values(POOLS).flat(), n * 5 + t), pickTurn: 1 }] })),
          },
        },
        (["emerald", "diamond", "master_plus"] as const)[n % 3]!,
      );
    }
  }
  await aggregate(lake, db, await loadStaticData("en_US"), { platform: euw.platform, patch });
  lake.close();
  console.log("Tier list de demo publicada: /es/champions");
}

console.log("Datos de demo cargados: /es/summoner/euw/Demo-EUW y /es/rankings/euw");
