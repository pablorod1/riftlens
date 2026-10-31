/**
 * Estadística "honesta": todo winrate va acompañado de su intervalo de confianza,
 * para no presentar como firme un 70 % sacado de 10 partidas.
 */

/** Intervalo de Wilson al 95 % para una proporción. */
export function wilson(wins: number, games: number, z = 1.96): { low: number; high: number } {
  if (games === 0) return { low: 0, high: 1 };
  const p = wins / games;
  const z2 = z * z;
  const denom = 1 + z2 / games;
  const center = (p + z2 / (2 * games)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / games + z2 / (4 * games * games))) / denom;
  return { low: Math.max(0, center - margin), high: Math.min(1, center + margin) };
}

/** Por debajo de este número de partidas avisamos de que la muestra es pequeña. */
export const SMALL_SAMPLE = 20;

export type Confidence = "baja" | "media" | "alta";

/** Confianza según la anchura del intervalo. */
export function confidence(games: number): Confidence {
  if (games < SMALL_SAMPLE) return "baja";
  if (games < 100) return "media";
  return "alta";
}

export function kda(kills: number, deaths: number, assists: number) {
  return deaths === 0 ? Infinity : (kills + assists) / deaths;
}

/**
 * Winrate "encogido" hacia el 50 %: con pocas partidas pesa más el 50 % que el
 * dato observado. Evita que un campeón con 12 partidas al 75 % lidere la tier list.
 */
export function shrunkWinrate(wins: number, games: number, prior = 0.5, strength = 100) {
  return (wins + prior * strength) / (games + strength);
}

export type Tier = "S+" | "S" | "A" | "B" | "C" | "D";

/** Tier a partir del winrate encogido. Umbrales pensados para Solo/Dúo. */
export function tierOf(shrunk: number): Tier {
  if (shrunk >= 0.535) return "S+";
  if (shrunk >= 0.522) return "S";
  if (shrunk >= 0.508) return "A";
  if (shrunk >= 0.493) return "B";
  if (shrunk >= 0.478) return "C";
  return "D";
}
