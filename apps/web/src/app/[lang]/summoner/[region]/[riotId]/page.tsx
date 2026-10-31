import { findCachedSummoner, loadProfile, refreshProfile } from "@riftlens/core";
import { ddragonImg, isRateLimitError, regionBySlug, RiotApiError } from "@riftlens/riot";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ApiKeyNotice, RateLimitNotice } from "@/components/api-key-notice";
import { ChampionStats } from "@/components/champion-stats";
import { CoachPanel } from "@/components/coach-panel";
import Link from "next/link";
import { InsightsRow } from "@/components/insights";
import { MatchCard } from "@/components/match-card";
import { MatchList } from "@/components/match-list";
import { RankPanel, rankLabel } from "@/components/rank-card";
import { FormStrip } from "@/components/recent-summary";
import { RecordVisit } from "@/components/record-visit";
import { RefreshButton } from "@/components/refresh-button";
import { SiteHeader } from "@/components/site-header";
import { t } from "@/i18n/config";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/server";
import { parseRiotIdSlug, summonerPath, timeAgo } from "@/lib/format";
import { computeInsights, queueGroup } from "@/lib/insights";
import { param } from "@/lib/champions";
import { db, riot, serverNow } from "@/lib/server";
import { getStaticData } from "@/lib/static-data";

type Props = PageProps<"/[lang]/summoner/[region]/[riotId]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region, riotId } = await params;
  const id = parseRiotIdSlug(riotId);
  const dict = await getDictionary();
  return { title: id ? `${id.gameName}#${id.tagLine} (${region.toUpperCase()})` : dict.meta.summoner };
}

export default async function SummonerPage({ params, searchParams }: Props) {
  const dict = await getDictionary();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pt-10 pb-20">
        <Suspense fallback={<ProfileSkeleton dict={dict} />}>
          <ProfileContent params={params} searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function ProfileContent({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const [{ region: regionSlug, riotId }, sp] = await Promise.all([params, searchParams]);
  const tab = param(sp.tab) === "coach" ? "coach" : "overview";
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
      if (isRateLimitError(err)) {
        return <RateLimitNotice retryHref={summonerPath(await getLocale(), region.slug, id.gameName, id.tagLine)} />;
      }
      if ((err instanceof RiotApiError && err.isAuth) || (err instanceof Error && err.message.includes("RIOT_API_KEY"))) {
        return <ApiKeyNotice />;
      }
      throw err;
    }
  }

  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const [profile, data] = await Promise.all([loadProfile(db(), region.platform, puuid), getStaticData(locale)]);
  if (!profile) notFound();
  const now = serverNow();
  const p = dict.profile;
  const solo = profile.entries.find((e) => e.queueType === "RANKED_SOLO_5x5");
  const flex = profile.entries.find((e) => e.queueType === "RANKED_FLEX_SR");
  const iconUrl = ddragonImg.profileIcon(data.version, profile.summoner.profileIconId);
  const insights = computeInsights(profile.matches, profile.champions);
  const basePath = summonerPath(locale, region.slug, profile.account.gameName, profile.account.tagLine);

  return (
    <div className="animate-fade-up">
      <RecordVisit
        region={region.slug}
        gameName={profile.account.gameName}
        tagLine={profile.account.tagLine}
        iconUrl={iconUrl}
        rank={solo ? rankLabel(solo, dict) : undefined}
      />

      <section className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="relative shrink-0">
            <Image src={iconUrl} alt="" width={84} height={84} priority className="rounded-2xl ring-1 ring-line-strong" />
            <span className="tabular absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-line-strong bg-bg px-2 py-0.5 text-[10px] text-muted">
              {profile.summoner.summonerLevel}
            </span>
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              {profile.account.gameName}
              <span className="ml-1.5 font-normal text-faint">#{profile.account.tagLine}</span>
            </h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-sm text-muted">
              <span>{dict.regions[region.slug as keyof typeof dict.regions]}</span>
              <span className="text-faint">·</span>
              <span>{t(p.level, { n: profile.summoner.summonerLevel })}</span>
              {solo && (
                <>
                  <span className="text-faint">·</span>
                  <span className="text-fg">{rankLabel(solo, dict)}</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <RefreshButton region={region.slug} puuid={puuid} lang={locale} labels={{ refresh: p.refresh, refreshing: p.refreshing }} />
          <p className="text-[11px] text-faint">{t(p.updated, { when: timeAgo(profile.summoner.refreshedAt.getTime(), now, locale) })}</p>
        </div>
      </section>

      <div className="mt-10">
        <InsightsRow insights={insights} data={data} dict={dict} />
      </div>

      <nav className="mt-8 flex gap-6 border-b border-line" aria-label={p.overview}>
        {[
          { key: "overview", label: p.overview, href: basePath },
          { key: "coach", label: dict.coach.tab, href: `${basePath}?tab=coach` },
        ].map((tb) => (
          <Link
            key={tb.key}
            href={tb.href}
            scroll={false}
            aria-current={tab === tb.key ? "page" : undefined}
            className={`-mb-px border-b-2 pb-3 text-sm font-medium transition-colors ${
              tab === tb.key ? "border-fg text-fg" : "border-transparent text-faint hover:text-muted"
            }`}
          >
            {tb.label}
          </Link>
        ))}
      </nav>

      {tab === "coach" ? (
        <div className="mt-6">
          <CoachPanel
            puuid={puuid}
            region={region}
            locale={locale}
            dict={dict}
            data={data}
            selected={param(sp.champ)}
            basePath={basePath}
          />
        </div>
      ) : (
      <div className="mt-6 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-6">
          <RankPanel solo={solo} flex={flex} dict={dict} />
          <ChampionStats data={data} champions={profile.champions} dict={dict} />
        </aside>
        <div className="min-w-0 space-y-6">
          <FormStrip matches={profile.matches} dict={dict} />
          {profile.matches.length === 0 ? (
            <p className="rounded-2xl border border-line bg-panel p-8 text-center text-sm text-faint">{p.noMatches}</p>
          ) : (
            <MatchList
              labels={{
                title: p.matches,
                all: p.filterAll,
                solo: p.filterSolo,
                flex: p.filterFlex,
                other: p.filterOther,
                empty: p.noMatchesFilter,
              }}
              items={profile.matches.map((m) => ({
                id: m.match.matchId,
                group: queueGroup(m.match.queueId),
                node: <MatchCard m={m} data={data} now={now} dict={dict} locale={locale} ranks={profile.ranks} />,
              }))}
            />
          )}
        </div>
      </div>
      )}
    </div>
  );
}

function ProfileSkeleton({ dict }: { dict: Dictionary }) {
  return (
    <div aria-label={dict.profile.loadingLabel} aria-busy="true">
      <div className="flex items-center gap-5">
        <div className="skeleton size-21 rounded-2xl" />
        <div className="space-y-3">
          <div className="skeleton h-8 w-64 rounded-lg" />
          <div className="skeleton h-4 w-44 rounded" />
        </div>
      </div>
      <div className="skeleton mt-10 h-[84px] rounded-2xl" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className="space-y-6">
          <div className="skeleton h-56 rounded-2xl" />
          <div className="skeleton h-80 rounded-2xl" />
        </div>
        <div className="space-y-3">
          <div className="skeleton h-28 rounded-2xl" />
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="skeleton h-[74px] rounded-xl" />
          ))}
        </div>
      </div>
      <p className="mt-8 text-center text-xs text-faint">{dict.profile.loading}</p>
    </div>
  );
}
