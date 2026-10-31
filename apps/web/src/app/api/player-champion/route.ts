import { compare, loadBenchmarks, playerChampions, riotIdKey } from "@riftlens/core";
import { schema } from "@riftlens/db";
import { regionBySlug } from "@riftlens/riot";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/lib/server";

export interface PlayerChampionDto {
  found: boolean;
  games: number;
  wins: number;
  position: string | null;
  comparisons: { key: string; mine: number; ref: number; delta: number }[];
}

/**
 * Rendimiento de un jugador (por Riot ID) con un campeón, frente a la mediana
 * del campeón. Solo con partidas guardadas: no llama a Riot.
 *   GET /api/player-champion?region=euw&name=Faker&tag=KR1&champion=103&position=MIDDLE
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const region = regionBySlug(q.get("region") ?? "");
  const championId = Number(q.get("champion"));
  const wanted = q.get("position");
  const empty: PlayerChampionDto = { found: false, games: 0, wins: 0, position: null, comparisons: [] };
  if (!region || !championId || !q.get("name") || !q.get("tag")) return Response.json(empty);

  const [account] = await db()
    .select({ puuid: schema.accounts.puuid })
    .from(schema.accounts)
    .where(eq(schema.accounts.riotIdKey, riotIdKey(q.get("name")!, q.get("tag")!)))
    .limit(1);
  if (!account) return Response.json(empty);

  const { champions } = await playerChampions(db(), region.platform, account.puuid);
  const options = champions.filter((c) => c.championId === championId);
  const mine = options.find((c) => c.position === wanted) ?? options[0];
  if (!mine) return Response.json({ ...empty, found: true });

  const bench = (await loadBenchmarks(db(), region.platform, [mine])).get(`${mine.championId}|${mine.position}`);
  const out: PlayerChampionDto = {
    found: true,
    games: mine.games,
    wins: mine.wins,
    position: mine.position,
    comparisons: bench ? compare(mine, bench.benchmark) : [],
  };
  return Response.json(out, { headers: { "Cache-Control": "private, max-age=60" } });
}
