import { findCachedSummoner, loadProfile, refreshProfile } from "@riftlens/core";
import { ddragonImg, regionBySlug, RiotApiError } from "@riftlens/riot";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ApiKeyNotice } from "@/components/api-key-notice";
import { ChampionStats } from "@/components/champion-stats";
import { MatchCard } from "@/components/match-card";
import { RankCard } from "@/components/rank-card";
import { RecentSummary } from "@/components/recent-summary";
import { RefreshButton } from "@/components/refresh-button";
import { SiteHeader } from "@/components/site-header";
import { parseRiotIdSlug, timeAgo } from "@/lib/format";
import { db, riot, serverNow } from "@/lib/server";
import { getStaticData } from "@/lib/static-data";

type Props = PageProps<"/summoner/[region]/[riotId]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region, riotId } = await params;
  const id = parseRiotIdSlug(riotId);
  return { title: id ? `${id.gameName}#${id.tagLine} (${region.toUpperCase()})` : "Invocador" };
}

export default function SummonerPage({ params }: Props) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Suspense fallback={<ProfileSkeleton />}>
          <ProfileContent params={params} />
        </Suspense>
      </main>
    </>
  );
}

async function ProfileContent({ params }: Pick<Props, "params">) {
  const { region: regionSlug, riotId } = await params;
  const region = regionBySlug(regionSlug);
  const id = parseRiotIdSlug(riotId);
  if (!region || !id) notFound();
  // Los datos vienen de la base de datos y de Riot: siempre en tiempo de petición.
  await connection();

  // Si no lo tenemos guardado, lo traemos de Riot en este momento.
  let puuid = (await findCachedSummoner(db(), region.platform, id.gameName, id.tagLine))?.puuid;
  if (!puuid) {
    try {
      puuid = (await refreshProfile(db(), riot(), region, id)).puuid;
    } catch (err) {
      if (err instanceof RiotApiError && err.isNotFound) notFound();
      if ((err instanceof RiotApiError && err.isAuth) || (err instanceof Error && err.message.includes("RIOT_API_KEY"))) {
        return <ApiKeyNotice />;
      }
      throw err;
    }
  }

  const [profile, data] = await Promise.all([loadProfile(db(), region.platform, puuid), getStaticData()]);
  if (!profile) notFound();
  const now = serverNow();
  const solo = profile.entries.find((e) => e.queueType === "RANKED_SOLO_5x5");
  const flex = profile.entries.find((e) => e.queueType === "RANKED_FLEX_SR");

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center gap-5">
        <div className="relative">
          <Image
            src={ddragonImg.profileIcon(data.version, profile.summoner.profileIconId)}
            alt=""
            width={88}
            height={88}
            className="rounded-2xl border-2 border-line"
            priority
          />
          <span className="tabular absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-line bg-bg px-2 text-xs">
            {profile.summoner.summonerLevel}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold">
            {profile.account.gameName}
            <span className="ml-1 font-normal text-muted">#{profile.account.tagLine}</span>
          </h1>
          <p className="mt-0.5 text-sm text-muted">
            {region.label} · actualizado {timeAgo(profile.summoner.refreshedAt.getTime(), now)}
          </p>
          <div className="mt-3">
            <RefreshButton region={region.slug} puuid={puuid} />
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <RankCard title="Clasificatoria Solo/Dúo" entry={solo} />
          <RankCard title="Clasificatoria Flexible" entry={flex} />
          <ChampionStats data={data} champions={profile.champions} />
        </aside>
        <div className="min-w-0 space-y-3">
          <RecentSummary matches={profile.matches} />
          {profile.matches.length === 0 ? (
            <p className="rounded-xl border border-line bg-panel p-6 text-sm text-faint">No hay partidas recientes.</p>
          ) : (
            profile.matches.map((m) => <MatchCard key={m.match.matchId} m={m} data={data} now={now} />)
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-label="Cargando perfil">
      <div className="flex items-center gap-5">
        <div className="size-22 rounded-2xl bg-panel" />
        <div className="space-y-2">
          <div className="h-7 w-56 rounded bg-panel" />
          <div className="h-4 w-40 rounded bg-panel" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <div className="h-28 rounded-xl bg-panel" />
          <div className="h-28 rounded-xl bg-panel" />
          <div className="h-80 rounded-xl bg-panel" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-24 rounded-xl bg-panel" />
          ))}
        </div>
      </div>
      <p className="text-center text-sm text-muted">Descargando partidas de Riot… la primera vez tarda unos segundos.</p>
    </div>
  );
}
