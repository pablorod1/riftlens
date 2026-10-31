/**
 * Data Dragon: datos estáticos (campeones, objetos, hechizos, runas) e imágenes.
 * Es un CDN público de Riot; no consume cuota de la API.
 */
const CDN = "https://ddragon.leagueoflegends.com";

export interface ChampionInfo {
  /** Clave numérica de la API de partidas (p. ej. 103) */
  key: number;
  /** Id de texto usado en imágenes (p. ej. "Ahri") */
  id: string;
  name: string;
  title: string;
  tags: string[];
}

export interface ItemInfo {
  name: string;
  description: string;
  gold: number;
  /** Profundidad en el árbol de compra (1 = básico, 3 = completo) */
  depth: number;
  into: number[];
  from: number[];
  tags: string[];
  /** Comprable en la Grieta del Invocador */
  sr: boolean;
}

export interface StaticData {
  version: string;
  champions: Record<number, ChampionInfo>;
  items: Record<number, ItemInfo>;
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

export async function loadStaticData(
  /** Idioma de Data Dragon: "es_ES", "en_US"… */
  locale = "en_US",
  version?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<StaticData> {
  const v = version ?? (await latestVersion(fetchImpl));
  const base = `${CDN}/cdn/${v}/data/${locale}`;

  type ChampJson = { data: Record<string, { key: string; id: string; name: string; title: string; tags: string[] }> };
  type ItemJson = {
    data: Record<
      string,
      {
        name: string;
        plaintext: string;
        gold: { total: number; purchasable: boolean };
        depth?: number;
        into?: string[];
        from?: string[];
        tags?: string[];
        maps?: Record<string, boolean>;
        inStore?: boolean;
      }
    >;
  };
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
    data.items[Number(id)] = {
      name: it.name,
      description: it.plaintext,
      gold: it.gold.total,
      depth: it.depth ?? 1,
      into: (it.into ?? []).map(Number),
      from: (it.from ?? []).map(Number),
      tags: it.tags ?? [],
      sr: !!it.maps?.["11"] && it.gold.purchasable && it.inStore !== false,
    };
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

export interface ItemClasses {
  /** Objetos completos (los que definen una build) */
  legendary: Set<number>;
  /** Botas: id de cualquier nivel -> id de las botas de nivel 2 (las que se eligen) */
  boots: Map<number, number>;
}

/**
 * Clasifica los objetos de la Grieta. Un objeto completo no se mejora en nada,
 * cuesta al menos 2000 de oro y no es consumible, abalorio ni botas.
 * Las botas de nivel 3 se agrupan con su versión de nivel 2.
 */
export function classifyItems(data: StaticData): ItemClasses {
  const legendary = new Set<number>();
  const boots = new Map<number, number>();
  for (const [key, it] of Object.entries(data.items)) {
    const id = Number(key);
    if (!it.sr) continue;
    if (it.tags.includes("Boots")) {
      if (it.depth === 2) boots.set(id, id);
      continue;
    }
    if (it.into.length === 0 && it.gold >= 2000 && !it.tags.includes("Consumable") && !it.tags.includes("Trinket")) {
      legendary.add(id);
    }
  }
  // Nivel 3 -> nivel 2 (el nivel 3 sale de mejorar unas botas de nivel 2)
  for (const [key, it] of Object.entries(data.items)) {
    const id = Number(key);
    if (!it.tags.includes("Boots") || boots.has(id)) continue;
    const base = it.from.find((f) => boots.has(f));
    if (base !== undefined) boots.set(id, base);
  }
  return { legendary, boots };
}
