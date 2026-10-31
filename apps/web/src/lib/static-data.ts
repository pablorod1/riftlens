import "server-only";
import { loadStaticData, type StaticData } from "@riftlens/riot";
import { cacheLife } from "next/cache";
import { ddragonLocale, type Locale } from "@/i18n/config";

/** Campeones, objetos, hechizos y runas del último parche (Data Dragon), en el idioma pedido. */
export async function getStaticData(locale: Locale): Promise<StaticData> {
  "use cache";
  cacheLife("hours");
  return loadStaticData(ddragonLocale[locale]);
}
