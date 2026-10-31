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
  /** Ramas de runas con sus filas (la primera fila es la de las claves) */
  runeTrees: { id: number; name: string; icon: string; slots: number[][] }[];
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

  const data: StaticData = { version: v, champions: {}, items: {}, spells: {}, runes: {}, runeTrees: [] };
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
    data.runeTrees.push({ id: style.id, name: style.name, icon: style.icon, slots: style.slots.map((s) => s.runes.map((r) => r.id)) });
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
  /** Habilidades: nombre de fichero tal cual viene en el JSON del campeón */
  passive: (v: string, file: string) => `${CDN}/cdn/${v}/img/passive/${file}`,
  ability: (v: string, file: string) => `${CDN}/cdn/${v}/img/spell/${file}`,
  /** Arte del campeón (sin versión): splash completo y recorte centrado */
  splash: (championId: string, skin = 0) => `${CDN}/cdn/img/champion/splash/${championId}_${skin}.jpg`,
  centered: (championId: string, skin = 0) => `${CDN}/cdn/img/champion/centered/${championId}_${skin}.jpg`,
};

export interface ChampionAbility {
  key: "P" | "Q" | "W" | "E" | "R";
  name: string;
  /** Texto plano (sin las etiquetas HTML de Data Dragon) */
  description: string;
  icon: string;
  /** Enfriamiento por rango ("8/7/6/5/4"), vacío en la pasiva */
  cooldown: string;
}

export interface ChampionLore {
  abilities: ChampionAbility[];
  /** Consejos para jugarlo y para jugar contra él (pueden venir vacíos) */
  allyTips: string[];
  enemyTips: string[];
  /** Puntuaciones 0–10 de Riot: ataque, defensa, magia y dificultad */
  info: { attack: number; defense: number; magic: number; difficulty: number };
  partype: string;
}

const plain = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Habilidades, consejos y valoración de un campeón (un JSON por campeón en Data Dragon). */
export async function loadChampionLore(version: string, lang: string, championId: string, fetchImpl: typeof fetch = fetch): Promise<ChampionLore> {
  type Raw = {
    data: Record<
      string,
      {
        passive: { name: string; description: string; image: { full: string } };
        spells: { name: string; description: string; cooldownBurn: string; image: { full: string } }[];
        allytips: string[];
        enemytips: string[];
        info: ChampionLore["info"];
        partype: string;
      }
    >;
  };
  const raw = await getJson<Raw>(`${CDN}/cdn/${version}/data/${lang}/champion/${championId}.json`, fetchImpl);
  const c = Object.values(raw.data)[0]!;
  const keys = ["Q", "W", "E", "R"] as const;
  return {
    abilities: [
      { key: "P", name: c.passive.name, description: plain(c.passive.description), icon: ddragonImg.passive(version, c.passive.image.full), cooldown: "" },
      ...c.spells.slice(0, 4).map((sp, i) => ({
        key: keys[i]!,
        name: sp.name,
        description: plain(sp.description),
        icon: ddragonImg.ability(version, sp.image.full),
        cooldown: sp.cooldownBurn,
      })),
    ],
    allyTips: (c.allytips ?? []).map(plain).filter(Boolean),
    enemyTips: (c.enemytips ?? []).map(plain).filter(Boolean),
    info: c.info,
    partype: c.partype,
  };
}

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

/** Fragmentos de estadísticas: tres filas (ataque, flexible, defensa) con sus opciones. */
export const STAT_SHARD_ROWS: number[][] = [
  [5008, 5005, 5007],
  [5008, 5010, 5001],
  [5011, 5013, 5001],
];

const SHARD_ICONS: Record<number, string> = {
  5001: "statmodshealthplusicon",
  5002: "statmodsarmoricon",
  5003: "statmodsmagicresicon",
  5005: "statmodsattackspeedicon",
  5007: "statmodscdrscalingicon",
  5008: "statmodsadaptiveforceicon",
  5010: "statmodsmovementspeedicon",
  5011: "statmodshealthscalingicon",
  5012: "statmodsadaptiveforcescalingicon",
  5013: "statmodstenacityicon",
};

export const shardIcon = (id: number) =>
  SHARD_ICONS[id]
    ? `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/statmods/${SHARD_ICONS[id]}.png`
    : null;

export const minimapImage = (v: string) => `${CDN}/cdn/${v}/img/map/map11.png`;
