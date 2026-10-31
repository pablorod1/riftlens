/**
 * Crawler de partidas Solo/Dúo para builds, matchups y tier list.
 *
 *   bun run crawl                         # EUW, hasta Ctrl+C
 *   bun run crawl -- --seed               # (re)carga jugadores Esmeralda+ antes de empezar
 *   bun run crawl -- --max 500            # para tras guardar 500 partidas
 *   bun run crawl -- --no-timelines       # sin líneas temporales (el doble de rápido, sin orden de
 *                                         # compra/habilidades ni curvas de referencia)
 *
 * Solo guarda partidas del parche actual (según Data Dragon) y respeta
 * RIOT_WORKER_SHARE para no dejar a la web sin cuota.
 *
 * DuckDB solo admite un proceso con el fichero abierto, así que el propio
 * crawler publica los agregados cada --publish-every minutos y al parar.
 */
import { getDb } from "@riftlens/db";
import { APEX_TIERS, latestVersion, loadStaticData, parseTimeline, patchFromVersion, regionBySlug, RiotApiError, riotFromEnv } from "@riftlens/riot";
import { parseArgs } from "node:util";
import { aggregate } from "./lake/aggregate";
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
    "no-timelines": { type: "boolean", default: false },
    /** Minutos entre publicaciones de agregados (0 = solo al terminar) */
    "publish-every": { type: "string", default: "30" },
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

async function publish(patch: string) {
  const t = Date.now();
  const results = await aggregate(lake, getDb(), await loadStaticData("en_US"), { platform: region!.platform, patch });
  const summary = results.map((r) => `${r.bracket} ${r.matches}`).join(" · ");
  log(`Agregados publicados (${((Date.now() - t) / 1000).toFixed(1)} s): ${summary}`);
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
  const publishEvery = Number(values["publish-every"]) * 60_000;
  let lastPublish = Date.now();
  let saved = 0;
  let savedSincePublish = 0;

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
            const timeline = values["no-timelines"] ? undefined : parseTimeline(await riot.timeline(region.regional, id));
            await lake.insertMatch(m, bracket, timeline);
            saved++;
            savedSincePublish++;
            if (saved % 25 === 0) log(`${saved} partidas guardadas`);
          }
        } catch (err) {
          if (err instanceof RiotApiError && err.isNotFound) await lake.skip(id, "404");
          else throw err;
        }
      }
      await lake.markCrawled(player.puuid);
      if (publishEvery && savedSincePublish && Date.now() - lastPublish >= publishEvery) {
        await publish(patch);
        lastPublish = Date.now();
        savedSincePublish = 0;
      }
    }
  }
  if (savedSincePublish) await publish(patch);
  const s = await lake.stats(region.platform);
  log(`Fin. Esta sesión: ${saved}. En total: ${s.matches} partidas, ${s.players} jugadores.`);
} catch (err) {
  if (err instanceof RiotApiError && err.isAuth) console.error("La API de Riot rechaza la clave (401/403). ¿Ha caducado RIOT_API_KEY?");
  else console.error(err);
  process.exitCode = 1;
} finally {
  lake.close();
}
