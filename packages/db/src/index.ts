import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

export * from "./schema";
export { schema };

export type Db = LibSQLDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __riftlensDb?: { db: Db; client: Client } };

/**
 * Cliente de base de datos compartido. En local apunta a un fichero SQLite;
 * en producción a Turso (DATABASE_URL=libsql://… + DATABASE_AUTH_TOKEN).
 */
export function getDb(): Db {
  if (!globalForDb.__riftlensDb) {
    const client = createClient({
      url: process.env.DATABASE_URL ?? "file:../../data/riftlens.db",
      authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
    });
    globalForDb.__riftlensDb = { db: drizzle(client, { schema }), client };
  }
  return globalForDb.__riftlensDb.db;
}
