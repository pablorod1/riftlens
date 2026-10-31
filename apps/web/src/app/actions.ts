"use server";

import { REFRESH_COOLDOWN_MS, refreshProfile } from "@riftlens/core";
import { schema } from "@riftlens/db";
import { regionBySlug, RiotApiError } from "@riftlens/riot";
import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { defaultLocale, isLocale, localePath, t } from "@/i18n/config";
import { getDictionaryFor } from "@/i18n/server";
import { parseRiotIdQuery, summonerPath } from "@/lib/format";
import { db, riot } from "@/lib/server";

export async function searchSummoner(formData: FormData) {
  const lang = String(formData.get("lang") ?? "");
  const locale = isLocale(lang) ? lang : defaultLocale;
  const region = regionBySlug(String(formData.get("region") ?? "euw")) ?? regionBySlug("euw")!;
  const parsed = parseRiotIdQuery(String(formData.get("q") ?? ""), region.defaultTag);
  if (!parsed) redirect(localePath(locale, "/"));
  redirect(summonerPath(locale, region.slug, parsed.gameName, parsed.tagLine));
}

export type UpdateState = { status: "idle" | "ok" | "error"; message?: string };

export async function updateProfile(_prev: UpdateState, formData: FormData): Promise<UpdateState> {
  const dict = (await getDictionaryFor(formData.get("lang"))).refreshResult;
  const region = regionBySlug(String(formData.get("region") ?? ""));
  const puuid = String(formData.get("puuid") ?? "");
  if (!region || !puuid) return { status: "error", message: dict.invalid };

  const [current] = await db()
    .select({ refreshedAt: schema.summoners.refreshedAt })
    .from(schema.summoners)
    .where(and(eq(schema.summoners.puuid, puuid), eq(schema.summoners.platform, region.platform)))
    .limit(1);
  if (current && Date.now() - current.refreshedAt.getTime() < REFRESH_COOLDOWN_MS) {
    return { status: "error", message: dict.cooldown };
  }

  try {
    const { newMatches } = await refreshProfile(db(), riot(), region, { puuid });
    refresh();
    return { status: "ok", message: newMatches ? t(dict.newMatches, { n: newMatches }) : dict.noNew };
  } catch (err) {
    if (err instanceof RiotApiError && err.isAuth) return { status: "error", message: dict.auth };
    console.error(err);
    return { status: "error", message: dict.failed };
  }
}
