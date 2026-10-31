import { BRACKETS, isBracket, latestScope, loadChampion, SMALL_SAMPLE, wilson, type BracketId, type Matchup } from "@riftlens/core";
import type { BuildEntry, ChampionBuild } from "@riftlens/db";
import { ddragonImg, regionBySlug, type Position, type StaticData } from "@riftlens/riot";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { FilterPills } from "@/components/filter-pills";
import { ChampionIcon, ItemIcon, RuneIcon, SpellIcon } from "@/components/icons";
import { SiteHeader } from "@/components/site-header";
import { TierBadge } from "@/components/tier-badge";
import { localePath, t, type Locale } from "@/i18n/config";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/server";
import { positionIcon } from "@/lib/assets";
import { championBySlug, championSlug, param, slugFromRole } from "@/lib/champions";
import { formatInt, pct } from "@/lib/format";
import { db } from "@/lib/server";
import { getStaticData } from "@/lib/static-data";

type Props = PageProps<"/[lang]/champions/[champion]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { champion } = await params;
  const data = await getStaticData(await getLocale());
  const c = championBySlug(data, champion);
  return { title: c ? `${c.name} — Build` : "Champion" };
}

export default function ChampionPage({ params, searchParams }: Props) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pt-8 pb-20">
        <Suspense
          fallback={
            <div className="space-y-6" aria-busy="true">
              <div className="flex items-center gap-5">
                <div className="skeleton size-20 rounded-2xl" />
                <div className="skeleton h-10 w-56 rounded-lg" />
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="skeleton h-72 rounded-2xl" />
                <div className="skeleton h-72 rounded-2xl" />
              </div>
            </div>
          }
        >
          <Champion params={params} searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

const wrColor = (wr: number) => (wr >= 0.5 ? "var(--color-win)" : "var(--color-loss)");

/** Winrate + partidas, en pequeño, para cualquier opción de build. */
function EntryStats({ e, total, dict }: { e: BuildEntry; total: number; dict: Dictionary }) {
  const wr = e.games ? e.wins / e.games : 0;
  return (
    <div className="tabular shrink-0 text-right text-xs">
      <p className="font-medium" style={{ color: wrColor(wr) }}>
        {pct(wr, 1)}
      </p>
      <p className="text-faint" title={t(dict.champions.gamesN, { n: e.games })}>
        {pct(total ? e.games / total : 0, 1)} · {e.games}
      </p>
    </div>
  );
}

function Card({ title, children, note, className = "" }: { title: string; children: React.ReactNode; note?: string; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-panel p-5 ${className}`}>
      <h2 className="eyebrow">{title}</h2>
      <div className="mt-4">{children}</div>
      {note && <p className="mt-4 text-[11px] leading-relaxed text-faint">{note}</p>}
    </section>
  );
}

function RunePage({ r, data, large = false }: { r: ChampionBuild["runes"][number]; data: StaticData; large?: boolean }) {
  const [keystone, ...rest] = r.perks;
  const primary = rest.slice(0, 3);
  const secondary = rest.slice(3, 5);
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <RuneIcon data={data} runeId={keystone!} size={large ? 52 : 34} className="rounded-full bg-panel-3" />
        <div className="flex gap-1">
          {primary.map((id) => (
            <RuneIcon key={id} data={data} runeId={id} size={large ? 28 : 20} className="rounded-full bg-panel-2 p-0.5" />
          ))}
        </div>
      </div>
      <span className="h-6 w-px bg-line" />
      <div className="flex items-center gap-1">
        <RuneIcon data={data} runeId={r.subStyle} size={large ? 22 : 16} className="opacity-70" />
        {secondary.map((id) => (
          <RuneIcon key={id} data={data} runeId={id} size={large ? 28 : 20} className="rounded-full bg-panel-2 p-0.5" />
        ))}
      </div>
    </div>
  );
}

/** Tecla de habilidad (Q, W, E, R). */
function SkillKey({ k, strong = false }: { k: string; strong?: boolean }) {
  return (
    <span
      className={`inline-flex size-8 items-center justify-center rounded-lg text-sm font-semibold ${
        strong ? "bg-fg text-bg" : "border border-line-strong text-fg"
      }`}
    >
      {k}
    </span>
  );
}

function MatchupList({ list, data, dict, locale, query }: { list: Matchup[]; data: StaticData; dict: Dictionary; locale: Locale; query: string }) {
  return (
    <ul className="space-y-1">
      {list.map((m) => {
        const champ = data.champions[m.opponentId];
        return (
          <li key={m.opponentId}>
            <Link
              href={localePath(locale, `/champions/${championSlug(data, m.opponentId)}${query}`)}
              className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-panel-2"
            >
              <ChampionIcon data={data} championId={m.opponentId} size={28} className="rounded-md" />
              <span className="min-w-0 flex-1 truncate text-sm">{champ?.name ?? "?"}</span>
              <span className="tabular text-sm font-medium" style={{ color: wrColor(m.winrate) }}>
                {pct(m.winrate, 1)}
              </span>
              <span className="tabular w-14 text-right text-[11px] text-faint">{t(dict.champions.gamesN, { n: m.games })}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

async function Champion({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const [{ champion: slug }, sp] = await Promise.all([params, searchParams]);
  await connection();
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const C = dict.champions;
  const data = await getStaticData(locale);
  const champ = championBySlug(data, slug);
  if (!champ) notFound();

  const region = regionBySlug(param(sp.region) ?? "euw") ?? regionBySlug("euw")!;
  const bracket: BracketId = isBracket(param(sp.elo)) ? (param(sp.elo) as BracketId) : "emerald_plus";
  const scope = await latestScope(db(), region.platform, bracket);
  const loaded = scope ? await loadChampion(db(), scope, champ.key) : null;
  const roles = loaded?.roles ?? [];
  const requested = param(sp.role);
  const role = roles.find((r) => slugFromRole(r.position) === requested) ?? roles[0];

  const href = (patch: { role?: string; elo?: string }) => {
    const q = new URLSearchParams();
    const r = patch.role ?? (role ? slugFromRole(role.position) : undefined);
    const elo = patch.elo ?? bracket;
    if (r) q.set("role", r);
    if (elo !== "emerald_plus") q.set("elo", elo);
    if (region.slug !== "euw") q.set("region", region.slug);
    const s = q.toString();
    return localePath(locale, `/champions/${slug}${s ? `?${s}` : ""}`);
  };
  const tierHref = localePath(locale, `/champions${role ? `?role=${slugFromRole(role.position)}` : ""}`);

  const build = role ? loaded?.buildBy.get(role.position) : undefined;
  const matchups = (role ? loaded?.matchupsBy.get(role.position) : undefined) ?? [];
  // Para "mejores/peores" exigimos una muestra mínima y ordenamos por winrate corregido
  const solid = matchups.filter((m) => m.games >= Math.max(5, Math.round((role?.games ?? 0) * 0.01)));
  const best = [...solid].sort((a, b) => b.score - a.score).slice(0, 6);
  const worst = [...solid].sort((a, b) => a.score - b.score).slice(0, 6);
  const matchupQuery = role ? `?role=${slugFromRole(role.position)}${bracket !== "emerald_plus" ? `&elo=${bracket}` : ""}` : "";
  const ci = role ? wilson(role.wins, role.games) : null;

  return (
    <div className="animate-fade-up">
      <Link href={tierHref} className="text-xs text-faint transition-colors hover:text-fg">
        {C.backToTier}
      </Link>

      <header className="mt-4 flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <Image src={ddragonImg.champion(data.version, champ.id)} alt="" width={80} height={80} priority className="rounded-2xl ring-1 ring-line-strong" />
          <div>
            <h1 className="text-4xl font-semibold tracking-[-0.03em]">{champ.name}</h1>
            <p className="mt-1 font-serif text-lg italic text-muted">{champ.title}</p>
          </div>
        </div>
        {role && ci && (
          <dl className="flex items-center gap-6 sm:gap-8">
            <div className="text-center">
              <dt className="eyebrow">{C.tier}</dt>
              <dd className="mt-1.5">
                <TierBadge tier={role.tier} size="lg" />
              </dd>
            </div>
            <div>
              <dt className="eyebrow">{C.winrate}</dt>
              <dd className="tabular mt-1.5 text-2xl font-semibold" style={{ color: wrColor(role.winrate) }} title={`${pct(ci.low, 1)} – ${pct(ci.high, 1)} (95%)`}>
                {pct(role.winrate, 1)}
              </dd>
            </div>
            <div>
              <dt className="eyebrow">{C.pickRate}</dt>
              <dd className="tabular mt-1.5 text-2xl font-semibold">{pct(role.pickRate, 1)}</dd>
            </div>
            <div>
              <dt className="eyebrow">{C.banRate}</dt>
              <dd className="tabular mt-1.5 text-2xl font-semibold">{pct(role.banRate, 1)}</dd>
            </div>
            <div className="hidden sm:block">
              <dt className="eyebrow">{C.games}</dt>
              <dd className="tabular mt-1.5 text-2xl font-semibold text-muted">{formatInt(role.games, locale)}</dd>
            </div>
          </dl>
        )}
      </header>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {roles.length > 0 && (
          <FilterPills
            label={C.role}
            pills={roles.map((r) => ({
              key: r.position,
              label: `${dict.positions[r.position as Position] ?? r.position} · ${pct(r.roleShare)}`,
              href: href({ role: slugFromRole(r.position) }),
              icon: positionIcon(r.position),
              active: r.position === role?.position,
            }))}
          />
        )}
        <FilterPills label={C.bracket} pills={BRACKETS.map((b) => ({ key: b, label: C.brackets[b], href: href({ elo: b }), active: b === bracket }))} />
        {scope && <span className="text-xs text-faint">{t(C.patch, { patch: scope.patch })}</span>}
      </div>

      {!role || !build ? (
        <p className="mt-8 rounded-2xl border border-dashed border-line-strong px-6 py-16 text-center text-sm text-muted">{C.noChampionData}</p>
      ) : (
        <>
          {role.games < SMALL_SAMPLE * 5 && (
            <p className="mt-6 inline-flex items-center gap-2 rounded-lg border border-gold/30 px-3 py-1.5 text-xs text-gold">
              <span className="size-1.5 rounded-full bg-gold" />
              {C.lowSample} · {t(C.gamesN, { n: role.games })}
            </p>
          )}

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Card title={C.runes}>
              {build.runes[0] && (
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-panel-2 p-4">
                  <RunePage r={build.runes[0]} data={data} large />
                  <EntryStats e={build.runes[0]} total={role.games} dict={dict} />
                </div>
              )}
              {build.runes.length > 1 && (
                <>
                  <p className="eyebrow mt-5 mb-2">{C.alternatives}</p>
                  <ul className="space-y-1">
                    {build.runes.slice(1).map((r, i) => (
                      <li key={i} className="flex items-center justify-between gap-4 rounded-lg px-2 py-2 hover:bg-panel-2">
                        <RunePage r={r} data={data} />
                        <EntryStats e={r} total={role.games} dict={dict} />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>

            <div className="space-y-6">
              <Card title={C.spells}>
                <ul className="space-y-2">
                  {build.spells.map((s) => (
                    <li key={s.spells.join()} className="flex items-center justify-between">
                      <span className="flex gap-1.5">
                        {s.spells.map((id) => (
                          <SpellIcon key={id} data={data} spellId={id} size={30} className="rounded-lg" />
                        ))}
                      </span>
                      <EntryStats e={s} total={role.games} dict={dict} />
                    </li>
                  ))}
                </ul>
              </Card>
              <Card title={C.boots}>
                <ul className="space-y-2">
                  {build.boots.map((b) => (
                    <li key={b.item} className="flex items-center gap-3">
                      <ItemIcon data={data} itemId={b.item} size={30} className="rounded-lg" />
                      <span className="min-w-0 flex-1 truncate text-sm">{data.items[b.item]?.name}</span>
                      <EntryStats e={b} total={role.games} dict={dict} />
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>

          {(build.order?.length || build.skills?.length) && (
            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              {build.order?.length ? (
                <Card title={C.buildOrder} note={C.buildOrderNote}>
                  <ul className="space-y-2">
                    {build.order.map((o, i) => (
                      <li key={o.items.join()} className={`flex items-center justify-between gap-4 rounded-xl p-3 ${i === 0 ? "bg-panel-2" : ""}`}>
                        <div className="flex items-center gap-2">
                          {o.items.map((id, j) => (
                            <span key={id} className="flex items-center gap-2">
                              {j > 0 && (
                                <svg viewBox="0 0 16 16" aria-hidden className="size-3.5 text-faint">
                                  <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                              <ItemIcon data={data} itemId={id} size={i === 0 ? 44 : 32} className="rounded-lg" />
                            </span>
                          ))}
                        </div>
                        <EntryStats e={o} total={role.games} dict={dict} />
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : (
                <div />
              )}
              {build.skills?.length ? (
                <Card title={C.skillOrder}>
                  <p className="eyebrow mb-3">{C.maxFirst}</p>
                  <ul className="space-y-2">
                    {build.skills.map((s, i) => (
                      <li key={s.order} className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          {s.order.split(">").map((k, j) => (
                            <span key={k} className="flex items-center gap-1.5">
                              {j > 0 && <span className="text-faint">›</span>}
                              <SkillKey k={k} strong={i === 0 && j === 0} />
                            </span>
                          ))}
                        </span>
                        <EntryStats e={s} total={role.games} dict={dict} />
                      </li>
                    ))}
                  </ul>
                  {build.skillStart?.[0] && (
                    <>
                      <p className="eyebrow mt-5 mb-3">{C.skillStart}</p>
                      <div className="flex items-center justify-between">
                        <span className="flex gap-1.5">
                          {[...build.skillStart[0].start].map((k, j) => (
                            <span key={j} className="flex flex-col items-center gap-1">
                              <SkillKey k={k} />
                              <span className="tabular text-[10px] text-faint">{j + 1}</span>
                            </span>
                          ))}
                        </span>
                        <EntryStats e={build.skillStart[0]} total={role.games} dict={dict} />
                      </div>
                    </>
                  )}
                </Card>
              ) : null}
            </div>
          )}

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Card title={C.core} note={C.coreNote}>
              <ul className="space-y-2">
                {build.core.map((c, i) => (
                  <li key={c.items.join()} className={`flex items-center justify-between gap-4 rounded-xl p-3 ${i === 0 ? "bg-panel-2" : ""}`}>
                    <div className="flex items-center gap-2">
                      {c.items.map((id, j) => (
                        <span key={id} className="flex items-center gap-2">
                          {j > 0 && <span className="text-faint">+</span>}
                          <ItemIcon data={data} itemId={id} size={i === 0 ? 44 : 32} className="rounded-lg" />
                        </span>
                      ))}
                      {i === 0 && (
                        <span className="ml-2 hidden min-w-0 text-xs leading-snug text-muted md:block">
                          {c.items.map((id) => data.items[id]?.name).join(" · ")}
                        </span>
                      )}
                    </div>
                    <EntryStats e={c} total={role.games} dict={dict} />
                  </li>
                ))}
              </ul>
            </Card>
            <Card title={C.items}>
              <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-1">
                {build.items.slice(0, 8).map((it) => (
                  <li key={it.item} className="flex items-center gap-3 rounded-lg px-1 py-1">
                    <ItemIcon data={data} itemId={it.item} size={28} className="rounded-md" />
                    <span className="min-w-0 flex-1 truncate text-sm">{data.items[it.item]?.name}</span>
                    <EntryStats e={it} total={role.games} dict={dict} />
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          {matchups.length > 0 && (
            <section className="mt-6">
              {solid.length >= 2 ? (
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card title={C.best}>
                    <MatchupList list={best} data={data} dict={dict} locale={locale} query={matchupQuery} />
                  </Card>
                  <Card title={C.worst}>
                    <MatchupList list={worst} data={data} dict={dict} locale={locale} query={matchupQuery} />
                  </Card>
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-line-strong px-6 py-8 text-center text-sm text-muted">{C.matchupsLowSample}</p>
              )}
              <details className="match group mt-6 rounded-2xl border border-line bg-panel">
                <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 [&::-webkit-details-marker]:hidden">
                  <span className="eyebrow">
                    {C.allMatchups} · {matchups.length}
                  </span>
                  <svg viewBox="0 0 16 16" aria-hidden className="size-4 text-faint transition-transform duration-300 group-open:rotate-180">
                    <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </summary>
                <div className="grid gap-x-6 border-t border-line px-3 py-3 sm:grid-cols-2 lg:grid-cols-3">
                  <MatchupList list={matchups} data={data} dict={dict} locale={locale} query={matchupQuery} />
                </div>
              </details>
              <p className="mt-3 text-[11px] text-faint">{C.matchupNote}</p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
