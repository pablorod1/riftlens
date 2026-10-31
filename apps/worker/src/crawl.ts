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
 *
 * Pensado para correr sin vigilancia (launchd/systemd, ver deploy/): cada hora
 * comprueba si hay parche nuevo y cambia a él, vuelve a sembrar jugadores cada
 * --reseed-hours y sobrevive a errores puntuales de Riot. Solo sale ante una
 * clave rechazada (código 2), para que el supervisor lo relance al cambiarla.
 */
import { getDb } from "@riftlens/db";
import { APEX_TIERS, latestVersion, loadStaticData, parseTimeline, patchFromVersion, regionBySlug, RiotApiError, riotFromEnv } from "@riftlens/riot";
import { parseArgs } from "node:util";
import { aggregate, publishAccounts } from "./lake/aggregate";
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
    /**
     * Minutos entre publicaciones de agregados (0 = solo al terminar). Por defecto 30 con
     * la base de datos local y 720 con Turso: cada publicación reescribe decenas de miles
     * de filas y el plan gratuito permite 10M filas escritas al mes.
     */
    "publish-every": { type: "string" },
    /** Horas entre resiembras de jugadores (tiers al día y jugadores nuevos; 0 = nunca) */
    "reseed-hours": { type: "string", default: "24" },
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
  const accounts = await publishAccounts(lake, getDb(), region!.platform);
  const summary = results.map((r) => `${r.bracket} ${r.matches}`).join(" · ");
  log(`Agregados publicados (${((Date.now() - t) / 1000).toFixed(1)} s): ${summary} · ${accounts} Riot IDs nuevos`);
}

let stopping = false;
// SIGTERM es como para launchd/systemd: publicamos lo pendiente y salimos
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    if (stopping) process.exit(1);
    stopping = true;
    log("Parando tras la petición en curso… (Ctrl+C otra vez para forzar)");
  });
}

const HOUR = 3600_000;
/** Espera que se corta en cuanto se pide parar. */
async function sleep(ms: number) {
  const end = Date.now() + ms;
  while (!stopping && Date.now() < end) await new Promise((r) => setTimeout(r, Math.min(1000, end - Date.now())));
}
/** Errores que no merece la pena reintentar: la clave no vale. */
const fatal = (err: unknown) => err instanceof RiotApiError && err.isAuth;
let failures = 0;
/** Error puntual (5xx, red, Data Dragon…): espera creciente y seguimos. */
async function recover(err: unknown, what: string) {
  if (fatal(err)) throw err;
  failures++;
  const wait = Math.min(15 * 60_000, 30_000 * 2 ** Math.min(failures - 1, 5));
  log(`Error en ${what} (${failures} seguidos), reintento en ${Math.round(wait / 1000)} s:`, err instanceof Error ? err.message : err);
  await sleep(wait);
}

try {
  let patch = patchFromVersion(await latestVersion());
  let lastSeed = 0;
  if (values.seed || (await lake.stats(region.platform)).players === 0) {
    await seed();
    lastSeed = Date.now();
  }
  log(`Parche actual ${patch}. Rastreando ${region.slug.toUpperCase()}…`);

  const max = Number(values.max);
  const remoteDb = (process.env.DATABASE_URL ?? "").startsWith("libsql:");
  const publishEvery = Number(values["publish-every"] ?? (remoteDb ? 720 : 30)) * 60_000;
  log(`Publicando agregados cada ${publishEvery / 60_000} min${remoteDb ? " (Turso)" : ""}`);
  const reseedEvery = Number(values["reseed-hours"]) * HOUR;
  let lastPublish = Date.now();
  let lastPatchCheck = Date.now();
  let saved = 0;
  let savedSincePublish = 0;

  while (!stopping && (!max || saved < max)) {
    // Parche nuevo: publicamos lo que quede del anterior y pasamos al nuevo
    if (Date.now() - lastPatchCheck >= HOUR) {
      lastPatchCheck = Date.now();
      try {
        const current = patchFromVersion(await latestVersion());
        if (current !== patch) {
          if (savedSincePublish) await publish(patch);
          savedSincePublish = 0;
          lastPublish = Date.now();
          log(`Parche nuevo: ${patch} → ${current}`);
          patch = current;
          lastSeed = 0;
        }
      } catch (err) {
        await recover(err, "la comprobación de parche");
      }
    }
    if (reseedEvery && Date.now() - lastSeed >= reseedEvery) {
      try {
        log(`Resembrando jugadores: ${await seed()}`);
        lastSeed = Date.now();
      } catch (err) {
        await recover(err, "la siembra");
        continue;
      }
    }

    const batch = await lake.nextPlayers(region.platform, 10);
    if (!batch.length) {
      log("No hay jugadores. Ejecuta con --seed.");
      break;
    }
    // Solo partidas recientes (el parche dura ~2 semanas); la ventana avanza con el tiempo
    const startTime = Math.floor((Date.now() - 15 * 86400_000) / 1000);
    for (const player of batch) {
      if (stopping || (max && saved >= max)) break;
      const bracket = bracketOfTier(player.tier);
      if (!bracket) continue;
      try {
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
        failures = 0;
      } catch (err) {
        // El jugador se queda sin marcar: se reintentará en otra vuelta
        await recover(err, "el rastreo");
        continue;
      }
      if (publishEvery && savedSincePublish && Date.now() - lastPublish >= publishEvery) {
        try {
          await publish(patch);
          savedSincePublish = 0;
        } catch (err) {
          await recover(err, "la publicación");
        }
        lastPublish = Date.now();
      }
    }
  }
  if (savedSincePublish) await publish(patch);
  const s = await lake.stats(region.platform);
  log(`Fin. Esta sesión: ${saved}. En total: ${s.matches} partidas, ${s.players} jugadores.`);
} catch (err) {
  if (fatal(err)) {
    console.error("La API de Riot rechaza la clave (401/403). ¿Ha caducado RIOT_API_KEY?");
    process.exitCode = 2;
  } else {
    console.error(err);
    process.exitCode = 1;
  }
} finally {
  lake.close();
}
