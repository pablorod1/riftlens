/**
 * Publica en Turso los agregados del parche más reciente del lake.
 *
 *   bun run aggregate                  # EUW
 *   bun run aggregate -- --patch 16.21
 */
import { getDb } from "@riftlens/db";
import { loadStaticData, regionBySlug } from "@riftlens/riot";
import { parseArgs } from "node:util";
import { aggregate } from "./lake/aggregate";
import { Lake } from "./lake/lake";

const { values } = parseArgs({ options: { region: { type: "string", default: "euw" }, patch: { type: "string" } } });
const region = regionBySlug(values.region!);
if (!region) throw new Error(`Región desconocida: ${values.region}`);

const lake = await Lake.open();
try {
  const patch = values.patch ?? (await lake.stats(region.platform)).patch;
  if (!patch) {
    console.log("El lake está vacío. Ejecuta antes: bun run crawl");
  } else {
    const t = Date.now();
    const results = await aggregate(lake, getDb(), await loadStaticData("en_US"), { platform: region.platform, patch });
    for (const r of results) console.log(`${patch} ${r.bracket}: ${r.matches} partidas, ${r.champions} campeón-rol`);
    console.log(`Publicado en ${((Date.now() - t) / 1000).toFixed(1)} s`);
  }
} finally {
  lake.close();
}
