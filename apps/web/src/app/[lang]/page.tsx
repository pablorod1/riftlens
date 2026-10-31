import { latestScope, loadTierList, type ChampionRow } from "@riftlens/core";
import { ddragonImg, POSITIONS, regionBySlug, type Position, type StaticData } from "@riftlens/riot";
import Link from "next/link";
import { connection } from "next/server";
import { cache, Suspense } from "react";
import { ChampionGrid } from "@/components/home/champion-grid";
import { HeroSearch } from "@/components/hero-search";
import { SiteHeader } from "@/components/site-header";
import { TierBadge } from "@/components/tier-badge";
import { localePath, t, type Locale } from "@/i18n/config";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/server";
import { positionIcon } from "@/lib/assets";
import { championSlug, slugFromRole } from "@/lib/champions";
import { formatInt, pct, timeAgo } from "@/lib/format";
import { db, serverNow } from "@/lib/server";
import { getStaticData } from "@/lib/static-data";

/** Meta del parche en EUW Esmeralda+: lo comparten la cabecera, las listas y la rejilla. */
const loadHomeMeta = cache(async () => {
  await connection();
  const scope = await latestScope(db(), regionBySlug("euw")!.platform, "emerald_plus");
  const rows = scope ? await loadTierList(db(), scope) : [];
  return { scope, rows };
});

const wrColor = (wr: number) => (wr >= 0.5 ? "var(--color-win)" : "var(--color-loss)");

export default async function Home() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const data = await getStaticData(locale);
  const h = dict.home;
  const champions = Object.values(data.champions)
    .map((c) => ({ slug: c.id.toLowerCase(), name: c.name, icon: ddragonImg.champion(data.version, c.id) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <SiteHeader search={false} />
      <main className="relative flex-1 overflow-hidden">
        {/* Portada: arte del campeón del momento detrás del buscador */}
        <section className="relative isolate">
          <Suspense fallback={null}>
            <HeroBackdrop />
          </Suspense>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(ellipse 55% 60% at 50% 0%, rgb(142 230 208 / 0.10), transparent 70%), radial-gradient(ellipse 40% 50% at 85% 30%, rgb(126 166 255 / 0.06), transparent 70%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 opacity-[0.35] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_30%,black,transparent)]"
            style={{
              backgroundImage: "linear-gradient(rgb(255 255 255 / 0.04) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.04) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
          <div className="relative mx-auto flex max-w-3xl flex-col items-center px-5 pt-20 pb-16 text-center sm:pt-28">
            <p className="eyebrow animate-fade-up">{h.eyebrow}</p>
            <h1 className="mt-5 animate-fade-up text-4xl font-semibold tracking-[-0.035em] text-balance sm:text-6xl [animation-delay:60ms]">
              {h.titleStart}{" "}
              <span className="font-serif text-[1.08em] font-normal italic tracking-[-0.01em] text-accent-strong">{h.titleAccent}</span>
            </h1>
            <p className="mt-5 max-w-xl animate-fade-up text-[15px] leading-relaxed text-muted text-balance [animation-delay:120ms]">{h.subtitle}</p>
            <div className="relative z-30 mt-10 w-full animate-fade-up text-left [animation-delay:180ms]">
              <HeroSearch locale={locale} labels={dict.search} regions={dict.regions} champions={champions} />
            </div>
            <Suspense fallback={<div className="mt-6 h-8" />}>
              <HeroExtras locale={locale} dict={dict} data={data} />
            </Suspense>
          </div>
        </section>

        <Suspense
          fallback={
            <div className="mx-auto max-w-6xl space-y-6 px-5 pb-16" aria-busy="true">
              <div className="skeleton h-8 w-64 rounded-lg" />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {POSITIONS.map((p) => (
                  <div key={p} className="skeleton h-64 rounded-2xl" />
                ))}
              </div>
            </div>
          }
        >
          <MetaSection locale={locale} dict={dict} data={data} />
        </Suspense>

        <section className="relative mx-auto max-w-6xl px-5 pb-24">
          <h2 className="text-xl font-semibold tracking-tight">{h.whyTitle}</h2>
          <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {h.features.map((f, i) => (
              <li key={f.title} className="rounded-2xl border border-line bg-panel/60 p-5">
                <p className="tabular text-xs text-accent/80">0{i + 1}</p>
                <p className="mt-3 flex items-center gap-2 font-medium">
                  {f.title}
                  {!f.ready && <span className="rounded-full border border-line px-2 py-0.5 text-[10px] font-normal text-faint">{dict.nav.soon}</span>}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.text}</p>
              </li>
            ))}
          </ol>
          <Link href={localePath(locale, "/rankings/euw")} className="mt-8 inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-fg">
            {h.ladderLink}
          </Link>
        </section>
      </main>
    </>
  );
}

/** Arte del mejor campeón del parche, muy tenue y fundido hacia abajo. */
async function HeroBackdrop() {
  const [{ rows }, locale] = await Promise.all([loadHomeMeta(), getLocale()]);
  const data = await getStaticData(locale);
  const top = rows.find((r) => r.games >= 20) ?? rows[0];
  const champ = top ? data.champions[top.championId] : undefined;
  if (!champ) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-20 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ddragonImg.splash(champ.id)}
        alt=""
        className="h-full w-full object-cover object-[center_20%] opacity-[0.16] blur-[1px] [mask-image:linear-gradient(to_bottom,black_10%,transparent_95%)]"
      />
    </div>
  );
}

/** "Prueba con…" y la línea de muestra (partidas, parche, actualización). */
async function HeroExtras({ locale, dict, data }: { locale: Locale; dict: Dictionary; data: StaticData }) {
  const { scope, rows } = await loadHomeMeta();
  if (!scope || !rows.length) return null;
  const h = dict.home;
  const popular = uniqueChampions([...rows].sort((a, b) => b.pickRate - a.pickRate)).slice(0, 6);
  const distinct = new Set(rows.map((r) => r.championId)).size;
  return (
    <div className="mt-6 flex animate-fade-up flex-col items-center gap-4 [animation-delay:240ms]">
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-faint">
        <span>{h.try}</span>
        {popular.map((r) => {
          const c = data.champions[r.championId];
          if (!c) return null;
          return (
            <Link
              key={r.championId}
              href={localePath(locale, `/champions/${championSlug(data, r.championId)}?role=${slugFromRole(r.position)}`)}
              className="flex items-center gap-1.5 rounded-full border border-line bg-panel/80 py-0.5 pl-0.5 pr-2.5 text-muted transition-colors hover:border-line-strong hover:text-fg"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ddragonImg.champion(data.version, c.id)} alt="" className="size-5 rounded-full" />
              {c.name}
            </Link>
          );
        })}
      </div>
      <p className="tabular flex flex-wrap items-center justify-center gap-x-2 text-[11px] text-faint">
        <span className="inline-flex items-center gap-1.5">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
            <span className="relative inline-flex size-1.5 rounded-full bg-accent" />
          </span>
          {t(h.snapshot, {
            matches: formatInt(scope.matches, locale),
            champions: distinct,
            patch: scope.patch,
            bracket: dict.champions.brackets[scope.bracket],
          })}
        </span>
        <span>· {t(h.updated, { when: timeAgo(scope.updatedAt.getTime(), serverNow(), locale) })}</span>
      </p>
    </div>
  );
}

const uniqueChampions = (list: ChampionRow[]) => {
  const seen = new Set<number>();
  return list.filter((r) => (seen.has(r.championId) ? false : (seen.add(r.championId), true)));
};

function ChampLine({ r, data, locale, dict, value, valueColor, rank }: { r: ChampionRow; data: StaticData; locale: Locale; dict: Dictionary; value: string; valueColor?: string; rank: number }) {
  const c = data.champions[r.championId];
  if (!c) return null;
  const icon = positionIcon(r.position);
  return (
    <li>
      <Link
        href={localePath(locale, `/champions/${championSlug(data, r.championId)}?role=${slugFromRole(r.position)}`)}
        className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-panel-2"
      >
        <span className="tabular w-3 text-[11px] text-faint">{rank}</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ddragonImg.champion(data.version, c.id)} alt="" className="size-8 rounded-lg" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{c.name}</span>
          <span className="flex items-center gap-1 text-[11px] text-faint">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {icon && <img src={icon} alt="" className="size-3 opacity-60" />}
            {dict.positions[r.position as Position] ?? r.position}
          </span>
        </span>
        <span className="tabular text-sm font-medium" style={{ color: valueColor }}>
          {value}
        </span>
      </Link>
    </li>
  );
}

/** Mejores por rol, listas destacadas y la rejilla de todos los campeones. */
async function MetaSection({ locale, dict, data }: { locale: Locale; dict: Dictionary; data: StaticData }) {
  const { scope, rows } = await loadHomeMeta();
  const h = dict.home;
  const positions = POSITIONS.map((p) => ({ key: p, label: dict.positions[p], icon: positionIcon(p) }));

  // Rejilla: todos los campeones, con los roles en los que se juegan (de más a menos)
  const rolesBy = new Map<number, ChampionRow[]>();
  for (const r of rows) rolesBy.set(r.championId, [...(rolesBy.get(r.championId) ?? []), r]);
  const grid = Object.values(data.champions)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => {
      const roles = (rolesBy.get(c.key) ?? []).filter((r) => r.roleShare >= 0.1).sort((a, b) => b.games - a.games);
      const slug = c.id.toLowerCase();
      return { slug, name: c.name, icon: ddragonImg.champion(data.version, c.id), href: localePath(locale, `/champions/${slug}`), roles: roles.map((r) => r.position) };
    });
  const gridSection = (
    <section className="mx-auto max-w-6xl px-5 pb-20">
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-tight">{h.allChampions}</h2>
        <p className="mt-1 text-sm text-muted">{h.allChampionsHint}</p>
      </div>
      <ChampionGrid champions={grid} positions={positions} labels={{ filter: h.filterChampions, all: dict.champions.allRoles, none: dict.champions.noResults }} />
    </section>
  );

  if (!scope || !rows.length) {
    return (
      <>
        <p className="mx-auto mb-16 max-w-xl px-5 text-center text-sm text-faint">{h.noData}</p>
        {gridSection}
      </>
    );
  }

  const minGames = Math.max(20, Math.round(scope.matches * 0.01));
  const solid = rows.filter((r) => r.games >= minGames);
  const topWr = [...solid].sort((a, b) => b.winrate - a.winrate).slice(0, 6);
  const topBan = uniqueChampions([...rows].sort((a, b) => b.banRate - a.banRate)).slice(0, 6);
  const topPick = [...rows].sort((a, b) => b.pickRate - a.pickRate).slice(0, 6);

  return (
    <>
      <section className="mx-auto max-w-6xl px-5 pb-16">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{h.metaTitle}</h2>
            <p className="mt-1 text-sm text-muted">{h.metaSubtitle}</p>
          </div>
          <Link href={localePath(locale, "/champions")} className="text-sm text-muted transition-colors hover:text-fg">
            {h.fullTier}
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {POSITIONS.map((p) => {
            const list = rows.filter((r) => r.position === p).slice(0, 5);
            const [first, ...rest] = list;
            const icon = positionIcon(p);
            const firstChamp = first ? data.champions[first.championId] : undefined;
            return (
              <div key={p} className="overflow-hidden rounded-2xl border border-line bg-panel">
                <Link
                  href={localePath(locale, `/champions?role=${slugFromRole(p)}`)}
                  className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-xs font-medium text-muted transition-colors hover:text-fg"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {icon && <img src={icon} alt="" className="size-3.5 opacity-70" />}
                  {dict.positions[p]}
                </Link>
                {first && firstChamp && (
                  <Link
                    href={localePath(locale, `/champions/${championSlug(data, first.championId)}?role=${slugFromRole(p)}`)}
                    className="group relative block h-28 overflow-hidden"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={ddragonImg.centered(firstChamp.id)}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover object-[center_25%] opacity-60 transition duration-500 group-hover:scale-105 group-hover:opacity-80"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-panel via-panel/40 to-transparent" />
                    <div className="absolute inset-x-3 bottom-2 flex items-end justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{firstChamp.name}</p>
                        <p className="tabular text-xs font-medium" style={{ color: wrColor(first.winrate) }}>
                          {pct(first.winrate, 1)}
                        </p>
                      </div>
                      <TierBadge tier={first.tier} />
                    </div>
                  </Link>
                )}
                <ul className="p-1.5">
                  {rest.map((r, i) => {
                    const c = data.champions[r.championId];
                    if (!c) return null;
                    return (
                      <li key={r.championId}>
                        <Link
                          href={localePath(locale, `/champions/${championSlug(data, r.championId)}?role=${slugFromRole(p)}`)}
                          className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-panel-2"
                        >
                          <span className="tabular w-3 text-[11px] text-faint">{i + 2}</span>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={ddragonImg.champion(data.version, c.id)} alt="" className="size-7 rounded-md" />
                          <span className="min-w-0 flex-1 truncate text-sm">{c.name}</span>
                          <span className="tabular text-xs" style={{ color: wrColor(r.winrate) }}>
                            {pct(r.winrate, 1)}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {[
            { title: h.topWinrate, list: topWr, value: (r: ChampionRow) => pct(r.winrate, 1), color: (r: ChampionRow) => wrColor(r.winrate) },
            { title: h.topBanned, list: topBan, value: (r: ChampionRow) => pct(r.banRate, 1), color: () => "var(--color-loss)" },
            { title: h.topPicked, list: topPick, value: (r: ChampionRow) => pct(r.pickRate, 1), color: () => undefined },
          ].map((block) => (
            <div key={block.title} className="rounded-2xl border border-line bg-panel p-3">
              <p className="eyebrow px-2 pb-2 pt-1">{block.title}</p>
              <ol>
                {block.list.map((r, i) => (
                  <ChampLine key={`${r.championId}-${r.position}`} r={r} data={data} locale={locale} dict={dict} value={block.value(r)} valueColor={block.color(r)} rank={i + 1} />
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>
      {gridSection}
    </>
  );
}
