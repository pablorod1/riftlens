import "server-only";
import { loadChampionLore, loadStaticData, type ChampionLore, type StaticData } from "@riftlens/riot";
import { cacheLife } from "next/cache";
import { ddragonLocale, type Locale } from "@/i18n/config";

/** Campeones, objetos, hechizos y runas del último parche (Data Dragon), en el idioma pedido. */
export async function getStaticData(locale: Locale): Promise<StaticData> {
  "use cache";
  cacheLife("hours");
  return loadStaticData(ddragonLocale[locale]);
}

/** Habilidades, consejos y valoración de un campeón. Si Data Dragon falla, la ficha sigue sin ellas. */
export async function getChampionLore(locale: Locale, version: string, championId: string): Promise<ChampionLore | null> {
  "use cache";
  cacheLife("hours");
  try {
    return await loadChampionLore(version, ddragonLocale[locale], championId);
  } catch {
    return null;
  }
}
