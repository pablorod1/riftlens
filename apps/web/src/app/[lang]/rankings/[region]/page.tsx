import { loadLadder } from "@riftlens/core";
import { regionBySlug, REGIONS, type Tier } from "@riftlens/riot";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { rankCrest } from "@/lib/assets";
import { localePath, t } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/server";
import { formatInt, pct, summonerPath, timeAgo } from "@/lib/format";
import { db, serverNow } from "@/lib/server";

type Props = PageProps<"/[lang]/rankings/[region]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region } = await params;
  const dict = await getDictionary();
  return { title: t(dict.meta.ladder, { region: region.toUpperCase() }) };
}

export default function RankingsPage({ params, searchParams }: Props) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Suspense fallback={<div className="h-[70vh] animate-pulse rounded-xl bg-panel" />}>
          <Ladder params={params} searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function Ladder({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const [{ region: slug }, sp] = await Promise.all([params, searchParams]);
  // Los datos vienen de la base de datos: siempre en tiempo de petición.
  await connection();
  const region = regionBySlug(slug);
  if (!region) notFound();
  const page = Math.max(1, Number(Array.isArray(sp.page) ? sp.page[0] : sp.page) || 1);

  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const L = dict.ladder;
  const ladder = await loadLadder(db(), region.platform, { page });
  const pages = Math.max(1, Math.ceil(ladder.total / ladder.pageSize));
  const now = serverNow();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{L.title}</h1>
          <p className="text-sm text-muted">
            {t(L.summary, {
              region: dict.regions[region.slug as keyof typeof dict.regions],
              n: formatInt(ladder.total, locale),
            })}
            {ladder.updatedAt && <> · {t(L.updated, { when: timeAgo(ladder.updatedAt.getTime(), now, locale) })}</>}
          </p>
        </div>
        <nav className="flex flex-wrap gap-1" aria-label={dict.search.region}>
          {REGIONS.map((r) => (
            <Link
              key={r.slug}
              href={localePath(locale, `/rankings/${r.slug}`)}
              title={dict.regions[r.slug]}
              className={`rounded-md px-2 py-1 text-xs font-semibold uppercase ${
                r.slug === region.slug ? "bg-accent text-bg" : "bg-panel text-muted hover:text-fg"
              }`}
            >
              {r.slug}
            </Link>
          ))}
        </nav>
      </div>

      {ladder.total === 0 ? (
        <div className="rounded-xl border border-line bg-panel p-6 text-sm text-muted">
          {L.empty}{" "}
          <code className="rounded bg-panel-2 px-1.5 py-0.5 text-fg">bun run worker:ladder -- --region {region.slug}</code>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-panel">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-faint">
                <th className="w-16 px-4 py-3 text-center font-semibold">#</th>
                <th className="px-2 py-3 font-semibold">{L.player}</th>
                <th className="px-2 py-3 font-semibold">{L.league}</th>
                <th className="px-2 py-3 text-right font-semibold">{L.lp}</th>
                <th className="px-4 py-3 font-semibold">{L.winrate}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ladder.rows.map((r) => {
                const games = r.wins + r.losses;
                const wr = games ? r.wins / games : 0;
                return (
                  <tr key={r.puuid} className="hover:bg-panel-2">
                    <td className="tabular px-4 py-2 text-center font-semibold text-muted">{r.position}</td>
                    <td className="px-2 py-2">
                      {r.gameName ? (
                        <Link href={summonerPath(locale, region.slug, r.gameName, r.tagLine ?? "")} className="font-medium hover:text-accent">
                          {r.gameName}
                          <span className="ml-1 text-faint">#{r.tagLine}</span>
                        </Link>
                      ) : (
                        <span className="text-faint" title={L.resolvingTitle}>
                          {L.resolving}
                        </span>
                      )}
                      {r.hotStreak && (
                        <span className="ml-2 text-xs" title={L.hotStreak}>
                          🔥
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <span className="flex items-center gap-1.5">
                        <Image src={rankCrest(r.tier)} alt="" width={20} height={20} />
                        {dict.tiers[r.tier as Tier]}
                      </span>
                    </td>
                    <td className="tabular px-2 py-2 text-right font-semibold">{formatInt(r.leaguePoints, locale)}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-3">
                        <div className="flex h-4 w-32 overflow-hidden rounded text-[10px] font-semibold leading-4">
                          <div className="bg-win pl-1" style={{ width: `${wr * 100}%` }}>
                            {t(L.wins, { n: r.wins })}
                          </div>
                          <div className="flex-1 bg-loss pr-1 text-right">{t(L.losses, { n: r.losses })}</div>
                        </div>
                        <span className="tabular w-10 text-xs">{pct(wr)}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-2 text-sm" aria-label={L.pagination}>
          {page > 1 && (
            <Link href={`?page=${page - 1}`} className="rounded-md bg-panel px-3 py-1.5 hover:text-accent">
              {L.prev}
            </Link>
          )}
          <span className="tabular px-2 text-muted">
            {t(L.page, { page, pages })}
          </span>
          {page < pages && (
            <Link href={`?page=${page + 1}`} className="rounded-md bg-panel px-3 py-1.5 hover:text-accent">
              {L.next}
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
