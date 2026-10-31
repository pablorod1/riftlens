"use client";

/**
 * Búsquedas recientes, solo en el navegador del usuario (localStorage).
 * Todo va en try/catch: en modo privado o sin almacenamiento simplemente no hay recientes.
 */
export interface RecentSummoner {
  region: string;
  gameName: string;
  tagLine: string;
  iconUrl?: string;
  /** Texto corto del rango, p. ej. "Esmeralda II" */
  rank?: string;
  at: number;
}

const KEY = "riftlens:recent";
const EVENT = "riftlens:recent-change";
const MAX = 8;

export function readRecent(): RecentSummoner[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as RecentSummoner[]) : [];
    return Array.isArray(list) ? list.slice(0, MAX) : [];
  } catch {
    return [];
  }
}

function write(list: RecentSummoner[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* sin almacenamiento disponible */
  }
}

const same = (a: RecentSummoner, b: Pick<RecentSummoner, "region" | "gameName" | "tagLine">) =>
  a.region === b.region && a.gameName.toLowerCase() === b.gameName.toLowerCase() && a.tagLine.toLowerCase() === b.tagLine.toLowerCase();

export function pushRecent(entry: Omit<RecentSummoner, "at">) {
  write([{ ...entry, at: Date.now() }, ...readRecent().filter((r) => !same(r, entry))]);
}

export function removeRecent(entry: RecentSummoner) {
  write(readRecent().filter((r) => !same(r, entry)));
}

export function clearRecent() {
  write([]);
}

export function subscribeRecent(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export const OPEN_SEARCH_EVENT = "riftlens:open-search";
