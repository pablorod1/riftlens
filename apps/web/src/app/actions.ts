"use server";

import { REFRESH_COOLDOWN_MS, refreshProfile } from "@riftlens/core";
import { schema } from "@riftlens/db";
import { regionBySlug, RiotApiError } from "@riftlens/riot";
import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { parseRiotIdQuery, summonerPath } from "@/lib/format";
import { db, riot } from "@/lib/server";

export async function searchSummoner(formData: FormData) {
  const region = regionBySlug(String(formData.get("region") ?? "euw")) ?? regionBySlug("euw")!;
  const parsed = parseRiotIdQuery(String(formData.get("q") ?? ""), region.defaultTag);
  if (!parsed) redirect("/");
  redirect(summonerPath(region.slug, parsed.gameName, parsed.tagLine));
}

export type UpdateState = { status: "idle" | "ok" | "error"; message?: string };

export async function updateProfile(_prev: UpdateState, formData: FormData): Promise<UpdateState> {
  const region = regionBySlug(String(formData.get("region") ?? ""));
  const puuid = String(formData.get("puuid") ?? "");
  if (!region || !puuid) return { status: "error", message: "Petición inválida" };

  const [current] = await db()
    .select({ refreshedAt: schema.summoners.refreshedAt })
    .from(schema.summoners)
    .where(and(eq(schema.summoners.puuid, puuid), eq(schema.summoners.platform, region.platform)))
    .limit(1);
  if (current && Date.now() - current.refreshedAt.getTime() < REFRESH_COOLDOWN_MS) {
    return { status: "error", message: "Actualizado hace poco, espera un par de minutos" };
  }

  try {
    const { newMatches } = await refreshProfile(db(), riot(), region, { puuid });
    refresh();
    return { status: "ok", message: newMatches ? `${newMatches} partidas nuevas` : "Sin partidas nuevas" };
  } catch (err) {
    if (err instanceof RiotApiError && err.isAuth) {
      return { status: "error", message: "La clave de la API de Riot no es válida o ha caducado" };
    }
    console.error(err);
    return { status: "error", message: "No se ha podido actualizar, inténtalo más tarde" };
  }
}
