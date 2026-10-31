import {
  analysePool,
  compare,
  latestScope,
  loadBenchmarks,
  loadRoleMatchups,
  loadTierList,
  personalMatchups,
  playerChampions,
  type MetricComparison,
  type MetricKey,
} from "@riftlens/core";
import type { Position, Region, StaticData } from "@riftlens/riot";
import Link from "next/link";
import { localePath, t, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/server";
import { positionIcon } from "@/lib/assets";
import { championSlug } from "@/lib/champions";
import { pct, summonerPath } from "@/lib/format";
import { db } from "@/lib/server";
import { FilterPills } from "./filter-pills";
import { ChampionIcon } from "./icons";
import { LoadMoreButton } from "./load-more-button";

const fmt: Record<MetricKey, (v: number) => string> = {
  csPerMin: (v) => v.toFixed(1),
  goldPerMin: (v) => Math.round(v).toString(),
  damagePerMin: (v) => Math.round(v).toString(),
  visionPerMin: (v) => v.toFixed(2),
  killParticipation: (v) => pct(v),
  deaths: (v) => v.toFixed(1),
};

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {note && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">{note}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function MetricRow({ m, dict, refLabel }: { m: MetricComparison; dict: Dictionary; refLabel: string }) {
  const max = Math.max(m.mine, m.ref) * 1.1 || 1;
  const good = m.delta >= 0;
  const color = Math.abs(m.delta) < 0.05 ? "var(--color-muted)" : good ? "var(--color-win)" : "var(--color-loss)";
  return (
    <li className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)_auto] items-center gap-4 py-3 sm:grid-cols-[180px_minmax(0,1fr)_96px]">
      <span className="text-sm">{dict.coach.metrics[m.key]}</span>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-[10px] text-faint">{dict.coach.you}</span>
          <span className="h-2 rounded-full" style={{ width: `${(m.mine / max) * 100}%`, background: color }} />
          <span className="tabular text-xs">{fmt[m.key](m.mine)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0 truncate text-[10px] text-faint">{refLabel}</span>
          <span className="h-2 rounded-full bg-fg/25" style={{ width: `${(m.ref / max) * 100}%` }} />
          <span className="tabular text-xs text-muted">{fmt[m.key](m.ref)}</span>
        </div>
      </div>
      <span className="tabular text-right text-xs font-medium" style={{ color }}>
        {t(good ? dict.coach.better : dict.coach.worse, { pct: pct(Math.abs(m.delta)) })}
      </span>
    </li>
  );
}

export async function CoachPanel({
  puuid,
  region,
  locale,
  dict,
  data,
  selected,
  basePath,
}: {
  puuid: string;
  region: Region;
  locale: Locale;
  dict: Dictionary;
  data: StaticData;
  /** "103-MIDDLE" (campeón y rol elegidos) */
  selected?: string;
  basePath: string;
}) {
  const C = dict.coach;
  const { champions, participations, totalRanked } = await playerChampions(db(), region.platform, puuid);
  const options = champions.slice(0, 5);
  const current =
    options.find((c) => `${c.championId}-${c.position}` === selected) ?? options.find((c) => c.games >= 3) ?? options[0];

  const footer = (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-dashed border-line-strong px-5 py-4">
      <p className="text-xs text-muted">{t(C.basedOn, { n: totalRanked })}</p>
      <LoadMoreButton region={region.slug} puuid={puuid} lang={locale} labels={{ idle: C.loadMore, pending: C.loadingMore }} />
    </div>
  );

  if (!current) {
    return (
      <div className="space-y-6">
        <p className="rounded-2xl border border-line bg-panel px-6 py-10 text-center text-sm text-muted">{C.noRanked}</p>
        {footer}
      </div>
    );
  }

  const champName = data.champions[current.championId]?.name ?? "?";
  const roleName = dict.positions[current.position as Position] ?? current.position;
  const benchmarks = await loadBenchmarks(db(), region.platform, options);
  const bench = benchmarks.get(`${current.championId}|${current.position}`);
  const comparisons = bench ? compare(current, bench.benchmark) : [];
  const refLabel = bench ? dict.champions.brackets[bench.bracket] : "";
  const weak = comparisons.filter((c) => c.delta < -0.08).sort((a, b) => a.delta - b.delta).slice(0, 3);
  const strong = [...comparisons].sort((a, b) => b.delta - a.delta)[0];

  const scope = await latestScope(db(), region.platform, "emerald_plus");
  const [roleMatchups, roleStats] = scope
    ? await Promise.all([loadRoleMatchups(db(), scope, current.position), loadTierList(db(), scope, current.position)])
    : [new Map(), []];
  const mine = personalMatchups(participations, current.championId, current.position, roleMatchups);
  // Sin solaparse: por encima y por debajo del 50 % esperado
  const best = mine.filter((m) => m.expected >= 0.5).sort((a, b) => b.expected - a.expected).slice(0, 5);
  const worst = mine.filter((m) => m.expected < 0.5).sort((a, b) => a.expected - b.expected).slice(0, 5);
  const pool = analysePool(participations, current.position, roleMatchups, roleStats);

  const champLink = (id: number) => localePath(locale, `/champions/${championSlug(data, id)}`);
  const sel = (c: (typeof options)[number]) => `${basePath}?tab=coach&champ=${c.championId}-${c.position}`;

  return (
    <div className="space-y-6">
      {options.length > 1 && (
        <FilterPills
          label={C.champion}
          pills={options.map((c) => ({
            key: `${c.championId}-${c.position}`,
            label: `${data.champions[c.championId]?.name ?? "?"} · ${c.games}`,
            href: sel(c),
            icon: positionIcon(c.position),
            active: c === current,
          }))}
        />
      )}

      <Section
        title={C.title}
        note={bench ? t(C.subtitle, { games: current.games, champion: champName, role: roleName, bracket: refLabel, patch: bench.patch }) : undefined}
      >
        {!bench ? (
          <p className="text-sm text-muted">{t(C.noBenchmark, { champion: champName, role: roleName })}</p>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <ul className="divide-y divide-line">
              {comparisons.map((m) => (
                <MetricRow key={m.key} m={m} dict={dict} refLabel={refLabel} />
              ))}
            </ul>
            <div className="space-y-5">
              {weak.length > 0 ? (
                <div>
                  <p className="eyebrow mb-3">{C.tipsTitle}</p>
                  <ol className="space-y-3">
                    {weak.map((w, i) => (
                      <li key={w.key} className="flex gap-3 text-sm leading-relaxed">
                        <span className="tabular mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-loss/15 text-[10px] text-loss">{i + 1}</span>
                        <span className="text-muted">{t(C.tips[w.key], { mine: fmt[w.key](w.mine), ref: fmt[w.key](w.ref), bracket: refLabel })}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : (
                <p className="text-sm text-muted">{C.allGood}</p>
              )}
              {strong && strong.delta > 0.05 && (
                <div className="rounded-xl border border-win/20 bg-win-bg px-4 py-3">
                  <p className="eyebrow text-win/80">{C.strengthTitle}</p>
                  <p className="mt-1 text-sm">
                    {C.metrics[strong.key]}: <span className="tabular font-medium">{fmt[strong.key](strong.mine)}</span>
                    <span className="text-muted"> · {t(C.better, { pct: pct(strong.delta) })}</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </Section>

      <Section title={t(C.matchupsTitle, { champion: champName })} note={C.matchupsNote}>
        {mine.length === 0 ? (
          <p className="text-sm text-muted">{C.matchupsEmpty}</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {[
              { title: C.bestFor, list: best },
              { title: C.worstFor, list: worst },
            ].map((col) => (
              <div key={col.title}>
                <p className="eyebrow mb-2">{col.title}</p>
                {col.list.length === 0 && <p className="px-2 py-1.5 text-sm text-faint">—</p>}
                <ul className="space-y-1">
                  {col.list.map((m) => (
                    <li key={m.opponentId}>
                      <Link href={champLink(m.opponentId)} className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-panel-2">
                        <ChampionIcon data={data} championId={m.opponentId} size={28} className="rounded-md" />
                        <span className="min-w-0 flex-1 truncate text-sm">{data.champions[m.opponentId]?.name}</span>
                        <span className="tabular text-xs text-faint">{t(dict.profile.winsLosses, { w: m.personal.wins, l: m.personal.games - m.personal.wins })}</span>
                        <span className="tabular w-24 text-right text-xs">
                          <span className="font-medium" style={{ color: m.expected >= 0.5 ? "var(--color-win)" : "var(--color-loss)" }}>
                            {pct(m.expected)}
                          </span>{" "}
                          <span className="text-faint">{C.expected}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title={t(C.poolTitle, { role: roleName })} note={C.poolNote}>
        {!pool.pool.length ? (
          <p className="text-sm text-muted">{C.poolEmpty}</p>
        ) : !scope ? (
          <p className="text-sm text-muted">{C.noGlobal}</p>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div>
              <div className="mb-4 flex flex-wrap gap-2">
                {pool.pool.map((id) => (
                  <ChampionIcon key={id} data={data} championId={id} size={34} className="rounded-lg ring-1 ring-line-strong" />
                ))}
              </div>
              <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                {pool.picks.map((p) => {
                  const gap = pool.gaps.includes(p.opponentId);
                  return (
                    <li key={p.opponentId} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
                      <ChampionIcon data={data} championId={p.opponentId} size={24} className="rounded-md opacity-90" />
                      <span className="min-w-0 flex-1 truncate text-xs text-muted">{data.champions[p.opponentId]?.name}</span>
                      <span className="text-faint">→</span>
                      {p.best && <ChampionIcon data={data} championId={p.best.championId} size={24} className="rounded-md" />}
                      <span
                        className="tabular w-10 text-right text-xs font-medium"
                        style={{ color: gap ? "var(--color-loss)" : p.best && p.best.expected >= 0.5 ? "var(--color-win)" : "var(--color-muted)" }}
                      >
                        {p.best ? pct(p.best.expected) : "—"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div>
              <p className="eyebrow mb-3">{C.gapsTitle}</p>
              {pool.gaps.length === 0 ? (
                <p className="text-sm text-muted">{C.noGaps}</p>
              ) : (
                <>
                  <p className="text-sm text-muted">{C.gapsText}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {pool.gaps.map((id) => (
                      <ChampionIcon key={id} data={data} championId={id} size={30} className="rounded-lg ring-1 ring-loss/40" />
                    ))}
                  </div>
                  {pool.suggestions.length > 0 && (
                    <>
                      <p className="eyebrow mt-6 mb-2">{C.suggestion}</p>
                      <ul className="space-y-1">
                        {pool.suggestions.map((s) => (
                          <li key={s.championId}>
                            <Link href={champLink(s.championId)} className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-panel-2">
                              <ChampionIcon data={data} championId={s.championId} size={30} className="rounded-lg" />
                              <span className="min-w-0 flex-1 truncate text-sm">{data.champions[s.championId]?.name}</span>
                              <span className="tabular text-xs font-medium text-win">{pct(s.expected)}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </Section>

      {footer}
    </div>
  );
}

export const coachHref = (locale: Locale, region: string, gameName: string, tagLine: string) =>
  `${summonerPath(locale, region, gameName, tagLine)}?tab=coach`;
