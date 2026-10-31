/**
 * Actualiza la clasificación de Aspirante/Gran Maestro/Maestro y resuelve los Riot ID.
 *
 *   bun run ladder                    # EUW, una vez
 *   bun run ladder --region kr
 *   bun run ladder --watch            # cada 30 min (y resuelve nombres entre medias)
 */
import { ladderPuuidsWithoutName, refreshApexLadder, resolveAccounts } from "@riftlens/core";
import { getDb } from "@riftlens/db";
import { regionBySlug, RiotApiError, riotFromEnv } from "@riftlens/riot";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    region: { type: "string", default: "euw" },
    queue: { type: "string", default: "RANKED_SOLO_5x5" },
    watch: { type: "boolean", default: false },
    interval: { type: "string", default: "30" },
    /** Riot IDs a resolver por tanda (cada uno es una petición) */
    batch: { type: "string", default: "50" },
  },
});

const region = regionBySlug(values.region!);
if (!region) {
  console.error(`Región desconocida: ${values.region}`);
  process.exit(1);
}

const db = getDb();
// El worker deja libre el resto de la cuota para la web.
const riot = riotFromEnv({ share: Number(process.env.RIOT_WORKER_SHARE || 0.5) });
const intervalMs = Number(values.interval) * 60_000;
const batch = Number(values.batch);
const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function refreshLadder() {
  const n = await refreshApexLadder(db, riot, region!, values.queue);
  log(`Clasificación ${region!.slug.toUpperCase()} ${values.queue}: ${n} jugadores`);
}

/** Resuelve nombres hasta que no queden pendientes o hasta `deadline`. */
async function resolveNames(deadline: number) {
  let total = 0;
  while (Date.now() < deadline) {
    const pending = await ladderPuuidsWithoutName(db, region!.platform, batch);
    if (!pending.length) break;
    total += await resolveAccounts(db, riot, region!, pending);
    log(`Riot IDs resueltos: ${total}`);
  }
  return total;
}

try {
  if (!values.watch) {
    await refreshLadder();
    await resolveNames(Infinity);
  } else {
    for (;;) {
      const start = Date.now();
      await refreshLadder();
      await resolveNames(start + intervalMs);
      const wait = start + intervalMs - Date.now();
      if (wait > 0) await Bun.sleep(wait);
    }
  }
} catch (err) {
  if (err instanceof RiotApiError && err.isAuth) {
    console.error("La API de Riot rechaza la clave (401/403). ¿Ha caducado RIOT_API_KEY?");
  } else {
    console.error(err);
  }
  process.exit(1);
}
