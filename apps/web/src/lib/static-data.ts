import "server-only";
import { loadStaticData, type StaticData } from "@riftlens/riot";
import { cacheLife } from "next/cache";

/** Campeones, objetos, hechizos y runas del último parche (Data Dragon). */
export async function getStaticData(): Promise<StaticData> {
  "use cache";
  cacheLife("hours");
  return loadStaticData();
}
