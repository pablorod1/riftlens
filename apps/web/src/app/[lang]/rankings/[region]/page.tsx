import { loadLadder } from "@riftlens/core";
import { ddragonImg, regionBySlug, REGIONS, type Tier } from "@riftlens/riot";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { localePath, t, type Locale } from "@/i18n/config";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/server";
import { rankCrest } from "@/lib/assets";
import { formatInt, pct, summonerPath, timeAgo } from "@/lib/format";
import { db, serverNow } from "@/lib/server";
import { getStaticData } from "@/lib/static-data";

type Props = PageProps<"/[lang]/rankings/[region]">;
type Row = Awaited<ReturnType<typeof loadLadder>>["rows"][number];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region } = await params;
  const dict = await getDictionary();
  return { title: t(dict.meta.ladder, { region: region.toUpperCase() }) };
}

export default function RankingsPage({ params, searchParams }: Props) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pt-10 pb-20">
        <Suspense
          fallback={
            <div className="space-y-6" aria-busy="true">
              <div className="skeleton h-10 w-72 rounded-lg" />
              <div className="grid gap-3 sm:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="skeleton h-40 rounded-2xl" />
                ))}
              </div>
              <div className="skeleton h-[60vh] rounded-2xl" />
            </div>
          }
        >
          <Ladder params={params} searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

function PlayerName({ r, locale, region, dict }: { r: Row; locale: Locale; region: string; dict: Dictionary }) {
  if (!r.gameName) {
    return (
      <span className="text-faint" title={dict.ladder.resolvingTitle}>
        {dict.ladder.resolving}
      </span>
    );
  }
  return (
    <Link href={summonerPath(locale, region, r.gameName, r.tagLine ?? "")} className="truncate font-medium transition-colors hover:text-accent">
      {r.gameName}
      <span className="ml-1 font-normal text-faint">#{r.tagLine}</span>
    </Link>
  );
}

function WinBar({ wins, losses }: { wins: number; losses: number }) {
  const games = wins + losses;
  const wr = games ? wins / games : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="h-1 w-24 overflow-hidden rounded-full bg-loss/25">
        <div className="h-full rounded-full bg-win/80" style={{ width: `${wr * 100}%` }} />
      </div>
      <span className="tabular w-9 text-xs" style={{ color: wr >= 0.5 ? "var(--color-win)" : "var(--color-loss)" }}>
        {pct(wr)}
      </span>
      <span className="tabular hidden text-[11px] text-faint md:inline">{games}</span>
    </div>
  );
}

async function Ladder({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const [{ region: slug }, sp] = await Promise.all([params, searchParams]);
  const region = regionBySlug(slug);
  if (!region) notFound();
  // Los datos vienen de la base de datos: siempre en tiempo de petición.
  await connection();
  const page = Math.max(1, Number(Array.isArray(sp.page) ? sp.page[0] : sp.page) || 1);

  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const L = dict.ladder;
  const [ladder, data] = await Promise.all([loadLadder(db(), region.platform, { page }), getStaticData(locale)]);
  const pages = Math.max(1, Math.ceil(ladder.total / ladder.pageSize));
  const now = serverNow();
  const podium = page === 1 ? ladder.rows.slice(0, 3) : [];
  const rest = page === 1 ? ladder.rows.slice(3) : ladder.rows;

  return (
    <div className="animate-fade-up">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">{dict.regions[region.slug as keyof typeof dict.regions]}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">{L.title}</h1>
          <p className="mt-2 text-sm text-muted">
            {t(L.summary, { region: region.slug.toUpperCase(), n: formatInt(ladder.total, locale) })}
            {ladder.updatedAt && <span className="text-faint"> · {t(L.updated, { when: timeAgo(ladder.updatedAt.getTime(), now, locale) })}</span>}
          </p>
        </div>
      </header>

      <nav aria-label={L.regions} className="no-scrollbar -mx-5 mt-8 flex gap-1 overflow-x-auto px-5">
        {REGIONS.map((r) => (
          <Link
            key={r.slug}
            href={localePath(locale, `/rankings/${r.slug}`)}
            title={dict.regions[r.slug]}
            aria-current={r.slug === region.slug ? "page" : undefined}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium uppercase tracking-wide transition-colors ${
              r.slug === region.slug ? "bg-fg text-bg" : "text-faint hover:bg-panel-2 hover:text-fg"
            }`}
          >
            {r.slug}
          </Link>
        ))}
      </nav>

      {ladder.total === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-line-strong px-6 py-16 text-center text-sm text-muted">
          <p>{L.empty}</p>
          <code className="mt-3 inline-block rounded-md bg-panel-2 px-2.5 py-1 font-mono text-xs text-fg">
            bun run worker:ladder -- --region {region.slug}
          </code>
        </div>
      ) : (
        <>
          {podium.length > 0 && (
            <ol className="mt-8 grid gap-3 sm:grid-cols-3">
              {podium.map((r) => (
                <li key={r.puuid} className="relative overflow-hidden rounded-2xl border border-line bg-panel p-5">
                  <span aria-hidden className="pointer-events-none absolute -right-2 -top-6 font-serif text-[120px] italic leading-none text-fg/[0.04]">
                    {r.position}
                  </span>
                  <div className="flex items-center gap-3">
                    {r.profileIconId ? (
                      <Image src={ddragonImg.profileIcon(data.version, r.profileIconId)} alt="" width={40} height={40} className="rounded-full" />
                    ) : (
                      <Image src={rankCrest(r.tier)} alt="" width={40} height={40} />
                    )}
                    <div className="min-w-0">
                      <p className="tabular text-xs text-faint">#{r.position}</p>
                      <PlayerName r={r} locale={locale} region={region.slug} dict={dict} />
                    </div>
                  </div>
                  <div className="mt-6 flex items-end justify-between">
                    <div>
                      <p className="tabular text-2xl font-semibold tracking-tight">{formatInt(r.leaguePoints, locale)}</p>
                      <p className="flex items-center gap-1.5 text-xs text-muted">
                        <Image src={rankCrest(r.tier)} alt="" width={14} height={14} />
                        {dict.tiers[r.tier as Tier]} · LP
                      </p>
                    </div>
                    <WinBar wins={r.wins} losses={r.losses} />
                  </div>
                </li>
              ))}
            </ol>
          )}

          <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-panel">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="text-left">
                  <th className="eyebrow w-16 py-3 pl-5 font-medium">#</th>
                  <th className="eyebrow py-3 font-medium">{L.player}</th>
                  <th className="eyebrow py-3 font-medium">{L.league}</th>
                  <th className="eyebrow py-3 pr-6 text-right font-medium">{L.lp}</th>
                  <th className="eyebrow py-3 pr-5 font-medium">{L.winrate}</th>
                </tr>
              </thead>
              <tbody>
                {rest.map((r) => (
                  <tr key={r.puuid} className="border-t border-line transition-colors hover:bg-panel-2">
                    <td className="tabular py-2.5 pl-5 text-xs text-faint">{r.position}</td>
                    <td className="max-w-0 py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <PlayerName r={r} locale={locale} region={region.slug} dict={dict} />
                        {r.hotStreak && <span className="size-1.5 shrink-0 rounded-full bg-gold" title={L.hotStreak} />}
                      </div>
                    </td>
                    <td className="py-2.5">
                      <span className="flex items-center gap-2 text-xs text-muted">
                        <Image src={rankCrest(r.tier)} alt="" width={16} height={16} />
                        {dict.tiers[r.tier as Tier]}
                      </span>
                    </td>
                    <td className="tabular py-2.5 pr-6 text-right font-medium">{formatInt(r.leaguePoints, locale)}</td>
                    <td className="py-2.5 pr-5">
                      <WinBar wins={r.wins} losses={r.losses} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <nav className="mt-6 flex items-center justify-between text-sm" aria-label={L.pagination}>
              {page > 1 ? (
                <Link href={`?page=${page - 1}`} className="rounded-lg border border-line px-3 py-1.5 text-muted transition-colors hover:border-line-strong hover:text-fg">
                  {L.prev}
                </Link>
              ) : (
                <span />
              )}
              <span className="tabular text-xs text-faint">{t(L.page, { page, pages })}</span>
              {page < pages ? (
                <Link href={`?page=${page + 1}`} className="rounded-lg border border-line px-3 py-1.5 text-muted transition-colors hover:border-line-strong hover:text-fg">
                  {L.next}
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
