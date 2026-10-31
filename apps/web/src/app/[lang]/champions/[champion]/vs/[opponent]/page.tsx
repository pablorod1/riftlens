import { BRACKETS, isBracket, latestScope, loadChampion, loadMatchup, loadTierList, SMALL_SAMPLE, type BracketId, type ChampionRow, type Matchup } from "@riftlens/core";
import type { ChampionBuild } from "@riftlens/db";
import { ddragonImg, regionBySlug, type ChampionInfo, type Position, type StaticData } from "@riftlens/riot";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { RunePage } from "@/components/champion/rune-page";
import { Card, pct1, wrColor } from "@/components/champion/ui";
import { FilterPills } from "@/components/filter-pills";
import { ItemIcon, SpellIcon } from "@/components/icons";
import { SiteHeader } from "@/components/site-header";
import { TierBadge } from "@/components/tier-badge";
import { localePath, t } from "@/i18n/config";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/server";
import { positionIcon } from "@/lib/assets";
import { championBySlug, param, roleFromSlug, slugFromRole } from "@/lib/champions";
import { formatInt } from "@/lib/format";
import { db } from "@/lib/server";
import { getChampionLore, getStaticData } from "@/lib/static-data";

type Props = PageProps<"/[lang]/champions/[champion]/vs/[opponent]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { champion, opponent } = await params;
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const data = await getStaticData(locale);
  const a = championBySlug(data, champion);
  const b = championBySlug(data, opponent);
  return { title: a && b ? t(dict.vs.metaTitle, { a: a.name, b: b.name }) : "Matchup" };
}

export default function VsPage({ params, searchParams }: Props) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pt-8 pb-20">
        <Suspense
          fallback={
            <div className="space-y-6" aria-busy="true">
              <div className="skeleton h-56 rounded-3xl" />
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="skeleton h-72 rounded-2xl" />
                <div className="skeleton h-72 rounded-2xl" />
              </div>
            </div>
          }
        >
          <Vs params={params} searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

const signedInt = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(Math.round(x)).toLocaleString()}`;
const signed1 = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(1)}`;

/** Barra enfrentada: cuánto de cada lado (a la izquierda el campeón, a la derecha el rival). */
function DuelBar({ label, a, b, fmt, higherIsBetter = true }: { label: string; a: number; b: number; fmt: (v: number) => string; higherIsBetter?: boolean }) {
  const total = Math.abs(a) + Math.abs(b) || 1;
  const share = Math.abs(a) / total;
  const aWins = higherIsBetter ? a > b : a < b;
  const bWins = higherIsBetter ? b > a : b < a;
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_4.5rem] items-center gap-3 py-1.5 text-sm">
      <span className={`tabular text-right ${aWins ? "font-semibold text-fg" : "text-muted"}`}>{fmt(a)}</span>
      <div>
        <p className="mb-1 text-center text-[11px] text-faint">{label}</p>
        <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full">
          <span className="rounded-l-full" style={{ width: `${share * 100}%`, background: aWins ? "var(--color-accent)" : "var(--color-line-strong)" }} />
          <span className="flex-1 rounded-r-full" style={{ background: bWins ? "var(--color-loss)" : "var(--color-line-strong)" }} />
        </div>
      </div>
      <span className={`tabular ${bWins ? "font-semibold text-fg" : "text-muted"}`}>{fmt(b)}</span>
    </div>
  );
}

/** Diferencia (campeón − rival) centrada en cero: la barra crece hacia el que va por delante. */
function DiffBar({ label, value, scale, fmt }: { label: string; value: number; scale: number; fmt: (v: number) => string }) {
  const off = Math.max(-1, Math.min(1, value / scale));
  return (
    <div className="py-1.5">
      <div className="mb-1 flex items-baseline justify-between text-[11px]">
        <span className="text-faint">{label}</span>
        <span className="tabular text-sm font-semibold" style={{ color: Math.abs(off) < 0.02 ? "var(--color-muted)" : off > 0 ? "var(--color-accent)" : "var(--color-loss)" }}>
          {fmt(value)}
        </span>
      </div>
      <div className="relative h-1.5 rounded-full bg-panel-3/70">
        <span className="absolute inset-y-[-3px] left-1/2 w-px bg-line-strong" />
        <span
          className="absolute inset-y-0 rounded-full"
          style={{
            left: off >= 0 ? "50%" : `${50 + off * 50}%`,
            width: `${Math.abs(off) * 50}%`,
            background: off >= 0 ? "var(--color-accent)" : "var(--color-loss)",
          }}
        />
      </div>
    </div>
  );
}

function CompactBuild({ build, data, dict }: { build: ChampionBuild | undefined; data: StaticData; dict: Dictionary }) {
  if (!build) return <p className="text-sm text-faint">{dict.champ.notEnough}</p>;
  const v = build.detail?.builds.common;
  const runes = v?.runes ?? build.runes[0] ?? null;
  const core = v?.core.length ? v.core : (build.core[0]?.items ?? []);
  const starting = v?.starting ?? [];
  const spells = v?.spells ?? build.spells[0]?.spells ?? null;
  const skills = v?.skills ?? build.skills?.[0]?.order ?? null;
  const C = dict.champ;
  return (
    <div className="space-y-4">
      {runes && <RunePage data={data} page={runes} size={22} />}
      <div className="flex flex-wrap items-start gap-6">
        {starting.length > 0 && (
          <div>
            <p className="eyebrow mb-2">{C.startingItems}</p>
            <div className="flex gap-1">
              {starting.map((id, i) => (
                <ItemIcon key={i} data={data} itemId={id} size={30} className="rounded-md" />
              ))}
            </div>
          </div>
        )}
        {core.length > 0 && (
          <div>
            <p className="eyebrow mb-2">{C.coreBuild}</p>
            <div className="flex items-center gap-1.5">
              {core.map((id, i) => (
                <span key={id} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-faint">›</span>}
                  <ItemIcon data={data} itemId={id} size={36} className="rounded-lg" />
                </span>
              ))}
            </div>
          </div>
        )}
        {spells && (
          <div>
            <p className="eyebrow mb-2">{C.spells}</p>
            <div className="flex gap-1">
              {spells.map((id) => (
                <SpellIcon key={id} data={data} spellId={id} size={30} className="rounded-md" />
              ))}
            </div>
          </div>
        )}
        {skills && (
          <div>
            <p className="eyebrow mb-2">{C.skillPriority}</p>
            <div className="flex items-center gap-1 text-sm font-semibold">
              {skills.split(">").map((k, i) => (
                <span key={k} className="flex items-center gap-1">
                  {i > 0 && <span className="text-faint">›</span>}
                  <span className={`inline-flex size-7 items-center justify-center rounded-md ${i === 0 ? "bg-fg text-bg" : "border border-line-strong"}`}>{k}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Side({ champ, data, wr, games, align, dict, href }: { champ: ChampionInfo; data: StaticData; wr: number | null; games: number; align: "left" | "right"; dict: Dictionary; href: string }) {
  return (
    <Link href={href} className={`group flex items-center gap-4 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ddragonImg.champion(data.version, champ.id)} alt="" width={80} height={80} className="size-16 rounded-2xl ring-1 ring-line-strong transition-transform group-hover:scale-105 sm:size-20" />
      <div className="min-w-0">
        <p className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">{champ.name}</p>
        {wr !== null ? (
          <p className="tabular mt-1 text-3xl font-semibold sm:text-4xl" style={{ color: wrColor(wr) }}>
            {pct1(wr)}
          </p>
        ) : (
          <p className="mt-1 text-sm text-faint">—</p>
        )}
        <p className="tabular text-xs text-faint">{t(dict.vs.games, { n: games })}</p>
      </div>
    </Link>
  );
}

async function Vs({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const [{ champion: slugA, opponent: slugB }, sp] = await Promise.all([params, searchParams]);
  await connection();
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const data = await getStaticData(locale);
  const a = championBySlug(data, slugA);
  const b = championBySlug(data, slugB);
  if (!a || !b || a.key === b.key) notFound();
  const V = dict.vs;
  const C = dict.champions;

  const region = regionBySlug(param(sp.region) ?? "euw") ?? regionBySlug("euw")!;
  const bracket: BracketId = isBracket(param(sp.elo)) ? (param(sp.elo) as BracketId) : "emerald_plus";
  const scope = await latestScope(db(), region.platform, bracket);
  const [loadedA, loadedB, loreB] = await Promise.all([
    scope ? loadChampion(db(), scope, a.key) : null,
    scope ? loadChampion(db(), scope, b.key) : null,
    getChampionLore(locale, data.version, b.id),
  ]);
  const rolesA = loadedA?.roles ?? [];
  const position = roleFromSlug(param(sp.role)) ?? rolesA[0]?.position ?? "MIDDLE";
  const roleName = dict.positions[position as Position] ?? position;
  const [pair, peers] = scope ? await Promise.all([loadMatchup(db(), scope, a.key, b.key, position), loadTierList(db(), scope, position)]) : [null, [] as ChampionRow[]];
  const mine = pair?.mine ?? null;
  const theirs = pair?.theirs ?? null;
  const rowA = rolesA.find((r) => r.position === position);
  const rowB = loadedB?.roles.find((r) => r.position === position);

  const query = (patch: { role?: string; elo?: string } = {}) => {
    const q = new URLSearchParams();
    const r = patch.role ?? slugFromRole(position);
    const elo = patch.elo ?? bracket;
    if (r) q.set("role", r);
    if (elo !== "emerald_plus") q.set("elo", elo);
    if (region.slug !== "euw") q.set("region", region.slug);
    const s = q.toString();
    return s ? `?${s}` : "";
  };
  const champHref = (c: ChampionInfo) => localePath(locale, `/champions/${c.id.toLowerCase()}${query()}`);
  const vsHref = (x: ChampionInfo, y: ChampionInfo, patch?: { role?: string; elo?: string }) => localePath(locale, `/champions/${x.id.toLowerCase()}/vs/${y.id.toLowerCase()}${query(patch)}`);

  const games = mine?.games ?? 0;
  const wrA = mine ? mine.winrate : null;
  const dA = mine?.detail ?? null;
  const dB = theirs?.detail ?? null;
  const others = (loadedA?.matchupsBy.get(position) ?? []).filter((m: Matchup) => m.opponentId !== b.key).slice(0, 24);
  const rank = (row: ChampionRow | undefined) => (row ? peers.findIndex((p) => p.championId === row.championId) + 1 : 0);

  return (
    <div className="animate-fade-up">
      <Link href={champHref(a)} className="text-xs text-faint transition-colors hover:text-fg">
        {t(V.back, { champion: a.name })}
      </Link>

      {/* Cara a cara: arte de ambos, winrate del matchup y barra repartida */}
      <header className="relative isolate mt-4 overflow-hidden rounded-3xl border border-line bg-panel">
        <div aria-hidden className="absolute inset-0 -z-10 grid grid-cols-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ddragonImg.centered(a.id)} alt="" className="h-full w-full object-cover object-[center_20%] opacity-30" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ddragonImg.centered(b.id)} alt="" className="h-full w-full object-cover object-[center_20%] opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-r from-panel/70 via-panel/95 to-panel/70" />
          <div className="absolute inset-0 bg-gradient-to-t from-panel to-transparent" />
        </div>
        <div className="p-6 sm:p-8">
          <p className="text-center text-xs text-faint">{t(V.subtitle, { role: roleName, bracket: C.brackets[bracket], patch: scope?.patch ?? "—" })}</p>
          <h1 className="sr-only">{t(V.title, { a: a.name, b: b.name })}</h1>
          <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 sm:gap-8">
            <Side champ={a} data={data} wr={wrA} games={games} align="left" dict={dict} href={champHref(a)} />
            <span className="font-serif text-3xl italic text-faint sm:text-4xl">vs</span>
            <Side champ={b} data={data} wr={theirs ? theirs.winrate : null} games={theirs?.games ?? 0} align="right" dict={dict} href={champHref(b)} />
          </div>
          {wrA !== null && (
            <div className="mx-auto mt-6 max-w-2xl">
              <div className="flex h-2.5 gap-1 overflow-hidden rounded-full">
                <span className="rounded-l-full bg-accent" style={{ width: `${wrA * 100}%` }} />
                <span className="flex-1 rounded-r-full bg-loss/80" />
              </div>
              <p className="mt-2 text-center text-xs text-muted">{t(V.edge, { champion: wrA >= 0.5 ? a.name : b.name, pct: pct1(Math.max(wrA, 1 - wrA)) })}</p>
            </div>
          )}
          <div className="mt-5 flex justify-center">
            <Link href={vsHref(b, a)} className="rounded-full border border-line-strong bg-panel/70 px-3 py-1 text-xs text-muted transition-colors hover:text-fg">
              ⇄ {t(V.swap, { champion: b.name })}
            </Link>
          </div>
        </div>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {rolesA.length > 0 && (
          <FilterPills
            label={C.role}
            pills={rolesA.map((r) => ({
              key: r.position,
              label: dict.positions[r.position as Position] ?? r.position,
              href: vsHref(a, b, { role: slugFromRole(r.position) }),
              icon: positionIcon(r.position),
              active: r.position === position,
            }))}
          />
        )}
        <FilterPills label={C.bracket} pills={BRACKETS.map((x) => ({ key: x, label: C.brackets[x], href: vsHref(a, b, { elo: x }), active: x === bracket }))} />
      </div>

      {!mine ? (
        <p className="mt-8 rounded-2xl border border-dashed border-line-strong px-6 py-16 text-center text-sm text-muted">{t(V.noData, { a: a.name, b: b.name, role: roleName })}</p>
      ) : (
        <>
          {games < SMALL_SAMPLE && (
            <p className="mt-6 inline-flex items-center gap-2 rounded-lg border border-gold/30 px-3 py-1.5 text-xs text-gold">
              <span className="size-1.5 rounded-full bg-gold" />
              {V.lowSample} · {t(V.games, { n: games })}
            </p>
          )}

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card title={V.laning} help={dA ? t(V.laningHelp, { n: dA.tlGames }) : undefined}>
              {dA && dA.tlGames > 0 ? (
                <div>
                  <div className="mb-2 flex justify-between text-[11px] text-faint">
                    <span>← {b.name}</span>
                    <span>{a.name} →</span>
                  </div>
                  {dA.gold10 !== null && <DiffBar label={V.metrics.gold10} value={dA.gold10} scale={800} fmt={signedInt} />}
                  {dA.gold15 !== null && <DiffBar label={V.metrics.gold15} value={dA.gold15} scale={1500} fmt={signedInt} />}
                  {dA.cs15 !== null && <DiffBar label={V.metrics.cs15} value={dA.cs15} scale={20} fmt={signed1} />}
                  {dA.xp15 !== null && <DiffBar label={V.metrics.xp15} value={dA.xp15} scale={1000} fmt={signedInt} />}
                  <div className="mt-3 border-t border-line pt-3">
                    <DuelBar label={V.metrics.lead15} a={dA.lead15 / dA.tlGames} b={dB && dB.tlGames ? dB.lead15 / dB.tlGames : 1 - dA.lead15 / dA.tlGames} fmt={pct1} />
                    {dA.lead15 > 0 && dB && dB.lead15 > 0 && (
                      <DuelBar label={V.metrics.leadWr} a={dA.lead15Wins / dA.lead15} b={dB.lead15Wins / dB.lead15} fmt={pct1} />
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-faint">{V.noTimeline}</p>
              )}
            </Card>

            <Card title={V.avgGame}>
              {dA && dB ? (
                <div>
                  <div className="mb-2 grid grid-cols-[4.5rem_minmax(0,1fr)_4.5rem] gap-3 text-[11px] text-faint">
                    <span className="text-right">{a.name}</span>
                    <span />
                    <span>{b.name}</span>
                  </div>
                  <DuelBar label={V.metrics.kills} a={dA.kills} b={dB.kills} fmt={(v) => v.toFixed(1)} />
                  <DuelBar label={V.metrics.deaths} a={dA.deaths} b={dB.deaths} fmt={(v) => v.toFixed(1)} higherIsBetter={false} />
                  <DuelBar label={V.metrics.assists} a={dA.assists} b={dB.assists} fmt={(v) => v.toFixed(1)} />
                  <DuelBar label={V.metrics.damage} a={dA.damage} b={dB.damage} fmt={(v) => formatInt(Math.round(v), locale)} />
                  <DuelBar label={V.metrics.cs} a={dA.cs} b={dB.cs} fmt={(v) => v.toFixed(0)} />
                  <DuelBar label={V.metrics.gold} a={dA.gold} b={dB.gold} fmt={(v) => formatInt(Math.round(v), locale)} />
                </div>
              ) : (
                <p className="text-sm text-faint">{dict.champ.notEnough}</p>
              )}
            </Card>
          </div>
        </>
      )}

      {/* En general en el rol: tier, winrate, pick y ban de cada uno */}
      <section className="mt-6">
        <Card title={t(V.overall, { role: roleName })}>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { c: a, row: rowA },
              { c: b, row: rowB },
            ].map(({ c, row }) => (
              <Link key={c.key} href={champHref(c)} className="flex items-center gap-4 rounded-xl border border-line bg-panel-2/30 p-4 transition-colors hover:border-line-strong">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ddragonImg.champion(data.version, c.id)} alt="" width={44} height={44} className="rounded-xl" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.name}</p>
                  {row ? (
                    <p className="tabular mt-0.5 text-xs text-faint">
                      #{rank(row)}/{peers.length} · {C.pickRate} {pct1(row.pickRate)} · {C.banRate} {pct1(row.banRate)} · {t(C.gamesN, { n: row.games })}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-faint">{C.noRole}</p>
                  )}
                </div>
                {row && (
                  <div className="flex items-center gap-3">
                    <span className="tabular text-lg font-semibold" style={{ color: wrColor(row.winrate) }}>
                      {pct1(row.winrate)}
                    </span>
                    <TierBadge tier={row.tier} />
                  </div>
                )}
              </Link>
            ))}
          </div>
        </Card>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title={`${V.builds} · ${a.name}`}>
          <CompactBuild build={loadedA?.buildBy.get(position)} data={data} dict={dict} />
        </Card>
        <Card title={`${V.builds} · ${b.name}`}>
          <CompactBuild build={loadedB?.buildBy.get(position)} data={data} dict={dict} />
        </Card>
      </section>

      {loreB && loreB.enemyTips.length > 0 && (
        <section className="mt-6">
          <Card title={t(V.tips, { champion: b.name })}>
            <ul className="space-y-2 text-sm leading-relaxed text-muted">
              {loreB.enemyTips.map((tip) => (
                <li key={tip} className="flex gap-2.5">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-accent" />
                  {tip}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      {others.length > 0 && (
        <section className="mt-6">
          <Card title={t(V.others, { champion: a.name, role: roleName })}>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-2">
              {others.map((m) => {
                const c = data.champions[m.opponentId];
                if (!c) return null;
                return (
                  <li key={m.opponentId}>
                    <Link href={vsHref(a, c)} className="block rounded-xl border border-line bg-panel-2/40 p-2 text-center transition-colors hover:border-line-strong">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={ddragonImg.champion(data.version, c.id)} alt="" width={40} height={40} className={`mx-auto rounded-lg ${m.games < 5 ? "opacity-50" : ""}`} />
                      <p className="mt-1 truncate text-[11px] text-muted">{c.name}</p>
                      <p className="tabular text-xs font-medium" style={{ color: wrColor(m.winrate) }}>
                        {pct1(m.winrate)}
                      </p>
                      <p className="tabular text-[10px] text-faint">{m.games}</p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      )}
    </div>
  );
}
