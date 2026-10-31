/** Campeón tal como lo necesitan los buscadores del cliente. */
export interface ChampionOption {
  slug: string;
  name: string;
  icon: string;
}

/** Normaliza para buscar campeones sin acentos ni signos ("kaisa" encuentra "Kai'Sa"). */
export const normChampion = (s: string) => s.normalize("NFD").replace(/[^a-z0-9]/gi, "").toLowerCase();

/**
 * Campeones que encajan con lo escrito: primero los que empiezan por ello,
 * después los que tienen una palabra que empieza por ello ("fortune" → Miss Fortune).
 */
export function matchChampions<T extends ChampionOption>(champions: T[], query: string, limit = 5): T[] {
  const q = normChampion(query);
  if (!q || query.includes("#")) return [];
  const starts: T[] = [];
  const words: T[] = [];
  for (const c of champions) {
    if (normChampion(c.name).startsWith(q) || c.slug.startsWith(q)) starts.push(c);
    else if (c.name.split(/[\s'.&]+/).some((w) => normChampion(w).startsWith(q))) words.push(c);
  }
  return [...starts, ...words].slice(0, limit);
}

/** El campeón cuyo nombre coincide exactamente con lo escrito (para Enter sin elegir nada). */
export const exactChampion = <T extends ChampionOption>(champions: T[], query: string) => {
  const q = normChampion(query);
  return q && !query.includes("#") ? champions.find((c) => normChampion(c.name) === q || c.slug === q) : undefined;
};
