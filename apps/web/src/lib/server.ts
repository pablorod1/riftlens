import "server-only";
import { getDb } from "@riftlens/db";
import { riotFromEnv } from "@riftlens/riot";

export const db = () => getDb();
export const riot = () => riotFromEnv();

/** Hora del servidor para textos relativos ("hace 5 min"). Las páginas que la usan son dinámicas. */
export const serverNow = () => Date.now();
