import "server-only";
import { getDb } from "@riftlens/db";
import { riotFromEnv } from "@riftlens/riot";

export const db = () => getDb();
/**
 * Cliente de Riot para la web: usa su parte de la cuota y nunca deja al usuario
 * esperando más de 10 s (si Riot está saturado, se muestra un aviso).
 */
export const riot = () =>
  riotFromEnv({ share: Number(process.env.RIOT_WEB_SHARE || 0.5), maxWaitMs: 10_000 });

/** Hora del servidor para textos relativos ("hace 5 min"). Las páginas que la usan son dinámicas. */
export const serverNow = () => Date.now();
