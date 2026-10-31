/**
 * Data Dragon: datos estáticos (campeones, objetos, hechizos, runas) e imágenes.
 * Es un CDN público de Riot; no consume cuota de la API.
 */
const CDN = "https://ddragon.leagueoflegends.com";
const LOCALE = "es_ES";

export interface ChampionInfo {
  /** Clave numérica de la API de partidas (p. ej. 103) */
  key: number;
  /** Id de texto usado en imágenes (p. ej. "Ahri") */
  id: string;
  name: string;
  title: string;
  tags: string[];
}

export interface StaticData {
  version: string;
  champions: Record<number, ChampionInfo>;
  items: Record<number, { name: string; description: string; gold: number }>;
  /** summonerXId -> id de imagen ("SummonerFlash") y nombre */
  spells: Record<number, { id: string; name: string }>;
  /** id de runa o estilo -> icono y nombre */
  runes: Record<number, { icon: string; name: string }>;
}

async function getJson<T>(url: string, fetchImpl: typeof fetch): Promise<T> {
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`Data Dragon ${res.status}: ${url}`);
  return (await res.json()) as T;
}

export async function latestVersion(fetchImpl: typeof fetch = fetch): Promise<string> {
  const versions = await getJson<string[]>(`${CDN}/api/versions.json`, fetchImpl);
  return versions[0]!;
}

export async function loadStaticData(version?: string, fetchImpl: typeof fetch = fetch): Promise<StaticData> {
  const v = version ?? (await latestVersion(fetchImpl));
  const base = `${CDN}/cdn/${v}/data/${LOCALE}`;

  type ChampJson = { data: Record<string, { key: string; id: string; name: string; title: string; tags: string[] }> };
  type ItemJson = { data: Record<string, { name: string; plaintext: string; gold: { total: number } }> };
  type SpellJson = { data: Record<string, { key: string; id: string; name: string }> };
  type RuneJson = { id: number; icon: string; name: string; slots: { runes: { id: number; icon: string; name: string }[] }[] }[];

  const [champs, items, spells, runes] = await Promise.all([
    getJson<ChampJson>(`${base}/champion.json`, fetchImpl),
    getJson<ItemJson>(`${base}/item.json`, fetchImpl),
    getJson<SpellJson>(`${base}/summoner.json`, fetchImpl),
    getJson<RuneJson>(`${base}/runesReforged.json`, fetchImpl),
  ]);

  const data: StaticData = { version: v, champions: {}, items: {}, spells: {}, runes: {} };
  for (const c of Object.values(champs.data)) {
    data.champions[Number(c.key)] = { key: Number(c.key), id: c.id, name: c.name, title: c.title, tags: c.tags };
  }
  for (const [id, it] of Object.entries(items.data)) {
    data.items[Number(id)] = { name: it.name, description: it.plaintext, gold: it.gold.total };
  }
  for (const s of Object.values(spells.data)) {
    data.spells[Number(s.key)] = { id: s.id, name: s.name };
  }
  for (const style of runes) {
    data.runes[style.id] = { icon: style.icon, name: style.name };
    for (const slot of style.slots) for (const r of slot.runes) data.runes[r.id] = { icon: r.icon, name: r.name };
  }
  return data;
}

export const ddragonImg = {
  profileIcon: (v: string, id: number) => `${CDN}/cdn/${v}/img/profileicon/${id}.png`,
  champion: (v: string, championId: string) => `${CDN}/cdn/${v}/img/champion/${championId}.png`,
  item: (v: string, id: number) => `${CDN}/cdn/${v}/img/item/${id}.png`,
  spell: (v: string, spellId: string) => `${CDN}/cdn/${v}/img/spell/${spellId}.png`,
  /** Las runas no van versionadas: el icono ya trae la ruta completa. */
  rune: (iconPath: string) => `${CDN}/cdn/img/${iconPath}`,
};
