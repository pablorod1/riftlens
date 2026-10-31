"use client";

import { useSyncExternalStore } from "react";
import { readRecent, subscribeRecent, type RecentSummoner } from "@/lib/recent";

let cache: { raw: string; list: RecentSummoner[] } = { raw: "", list: [] };
const EMPTY: RecentSummoner[] = [];

function snapshot() {
  const list = readRecent();
  const raw = JSON.stringify(list);
  if (raw !== cache.raw) cache = { raw, list };
  return cache.list;
}

/** Recientes sincronizados entre componentes y pestañas. En el servidor, lista vacía. */
export function useRecent() {
  return useSyncExternalStore(subscribeRecent, snapshot, () => EMPTY);
}
