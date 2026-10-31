/**
 * Crawler de partidas Solo/Dúo para builds, matchups y tier list.
 *
 *   bun run crawl                         # EUW, hasta Ctrl+C
 *   bun run crawl -- --seed               # (re)carga jugadores Esmeralda+ antes de empezar
 *   bun run crawl -- --max 500            # para tras guardar 500 partidas
 *
 * Solo guarda partidas del parche actual (según Data Dragon) y respeta
 * RIOT_WORKER_SHARE para no dejar a la web sin cuota.
 */
import { APEX_TIERS, latestVersion, patchFromVersion, regionBySlug, RiotApiError, riotFromEnv } from "@riftlens/riot";
import { parseArgs } from "node:util";
import { bracketOfTier, Lake } from "./lake/lake";

const { values } = parseArgs({
  options: {
    region: { type: "string", default: "euw" },
    seed: { type: "boolean", default: false },
    /** Páginas por división al sembrar (205 jugadores por página) */
    "seed-pages": { type: "string", default: "1" },
    max: { type: "string", default: "0" },
    /** Partidas recientes a pedir por jugador */
    "per-player": { type: "string", default: "20" },
  },
});

const region = regionBySlug(values.region!);
if (!region) {
  console.error(`Región desconocida: ${values.region}`);
  process.exit(1);
}
const riot = riotFromEnv({ share: Number(process.env.RIOT_WORKER_SHARE || 0.5) });
const lake = await Lake.open();
const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

const SEED_TIERS = ["EMERALD", "DIAMOND"] as const;
const DIVISIONS = ["I", "II", "III", "IV"] as const;

async function seed() {
  let total = 0;
  for (const tier of APEX_TIERS) {
    const list = await riot.apexLeague(region!.platform, tier as "MASTER");
    await lake.upsertPlayers(list.entries.map((e) => ({ puuid: e.puuid, platform: region!.platform, tier, lp: e.leaguePoints })));
    total += list.entries.length;
    log(`Semilla ${tier}: ${list.entries.length}`);
  }
  for (const tier of SEED_TIERS) {
    for (const division of DIVISIONS) {
      for (let page = 1; page <= Number(values["seed-pages"]); page++) {
        const entries = await riot.leagueEntries(region!.platform, "RANKED_SOLO_5x5", tier, division, page);
        if (!entries.length) break;
        await lake.upsertPlayers(entries.map((e) => ({ puuid: e.puuid, platform: region!.platform, tier, division, lp: e.leaguePoints })));
        total += entries.length;
        log(`Semilla ${tier} ${division} p${page}: ${entries.length}`);
      }
    }
  }
  return total;
}

let stopping = false;
process.on("SIGINT", () => {
  if (stopping) process.exit(1);
  stopping = true;
  log("Parando tras la petición en curso… (Ctrl+C otra vez para forzar)");
});

try {
  const patch = patchFromVersion(await latestVersion());
  if (values.seed || (await lake.stats(region.platform)).players === 0) await seed();
  log(`Parche actual ${patch}. Rastreando ${region.slug.toUpperCase()}…`);

  // Solo partidas recientes: el parche dura ~2 semanas
  const startTime = Math.floor((Date.now() - 15 * 86400_000) / 1000);
  const max = Number(values.max);
  let saved = 0;

  while (!stopping && (!max || saved < max)) {
    const batch = await lake.nextPlayers(region.platform, 10);
    if (!batch.length) {
      log("No hay jugadores. Ejecuta con --seed.");
      break;
    }
    for (const player of batch) {
      if (stopping || (max && saved >= max)) break;
      const bracket = bracketOfTier(player.tier);
      if (!bracket) continue;
      const ids = await riot.matchIdsByPuuid(region.regional, player.puuid, {
        queue: 420,
        type: "ranked",
        startTime,
        count: Number(values["per-player"]),
      });
      for (const id of await lake.unknownMatchIds(ids)) {
        if (stopping || (max && saved >= max)) break;
        try {
          const m = await riot.match(region.regional, id);
          const matchPatch = patchFromVersion(m.info.gameVersion);
          if (matchPatch !== patch) await lake.skip(id, `patch ${matchPatch}`);
          else if (m.info.participants.some((p) => p.gameEndedInEarlySurrender)) await lake.skip(id, "remake");
          else {
            await lake.insertMatch(m, bracket);
            saved++;
            if (saved % 25 === 0) log(`${saved} partidas guardadas`);
          }
        } catch (err) {
          if (err instanceof RiotApiError && err.isNotFound) await lake.skip(id, "404");
          else throw err;
        }
      }
      await lake.markCrawled(player.puuid);
    }
  }
  const s = await lake.stats(region.platform);
  log(`Fin. Esta sesión: ${saved}. En total: ${s.matches} partidas, ${s.players} jugadores.`);
} catch (err) {
  if (err instanceof RiotApiError && err.isAuth) console.error("La API de Riot rechaza la clave (401/403). ¿Ha caducado RIOT_API_KEY?");
  else console.error(err);
  process.exitCode = 1;
} finally {
  lake.close();
}
