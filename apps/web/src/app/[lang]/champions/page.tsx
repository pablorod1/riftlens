import { BRACKETS, isBracket, latestScope, loadTierList, SMALL_SAMPLE, wilson, type BracketId } from "@riftlens/core";
import { ddragonImg, regionBySlug, type Position } from "@riftlens/riot";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { FilterPills } from "@/components/filter-pills";
import { SiteHeader } from "@/components/site-header";
import { TierTable, type TierRow } from "@/components/tier-table";
import { localePath, t } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/server";
import { positionIcon } from "@/lib/assets";
import { championSlug, param, ROLE_SLUGS, roleFromSlug } from "@/lib/champions";
import { formatInt, timeAgo } from "@/lib/format";
import { db, serverNow } from "@/lib/server";
import { getStaticData } from "@/lib/static-data";

type Props = PageProps<"/[lang]/champions">;

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.champions.title };
}

export default function TierListPage({ searchParams }: Props) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pt-10 pb-20">
        <Suspense
          fallback={
            <div className="space-y-6" aria-busy="true">
              <div className="skeleton h-10 w-56 rounded-lg" />
              <div className="skeleton h-10 w-full max-w-lg rounded-xl" />
              <div className="skeleton h-[70vh] rounded-2xl" />
            </div>
          }
        >
          <TierList searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function TierList({ searchParams }: Pick<Props, "searchParams">) {
  const sp = await searchParams;
  await connection();
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const C = dict.champions;
  const region = regionBySlug(param(sp.region) ?? "euw") ?? regionBySlug("euw")!;
  const bracket: BracketId = isBracket(param(sp.elo)) ? (param(sp.elo) as BracketId) : "emerald_plus";
  const roleSlug = param(sp.role);
  const position = roleFromSlug(roleSlug);

  const href = (patch: { role?: string | null; elo?: string }) => {
    const q = new URLSearchParams();
    const role = patch.role === undefined ? roleSlug : patch.role;
    const elo = patch.elo ?? bracket;
    if (role) q.set("role", role);
    if (elo !== "emerald_plus") q.set("elo", elo);
    if (region.slug !== "euw") q.set("region", region.slug);
    const s = q.toString();
    return localePath(locale, `/champions${s ? `?${s}` : ""}`);
  };

  const [scope, data] = await Promise.all([latestScope(db(), region.platform, bracket), getStaticData(locale)]);
  const now = serverNow();

  const header = (
    <header className="flex flex-wrap items-end justify-between gap-6">
      <div>
        <p className="eyebrow">{dict.regions[region.slug as keyof typeof dict.regions]}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">{C.title}</h1>
        {scope && (
          <p className="mt-2 text-sm text-muted">
            {t(C.subtitle, { region: region.slug.toUpperCase(), patch: scope.patch, n: formatInt(scope.matches, locale) })}
            <span className="text-faint"> · {t(C.updated, { when: timeAgo(scope.updatedAt.getTime(), now, locale) })}</span>
          </p>
        )}
      </div>
    </header>
  );

  const filters = (
    <div className="mt-8 flex flex-wrap items-center gap-3">
      <FilterPills
        label={C.role}
        pills={[
          { key: "all", label: C.allRoles, href: href({ role: null }), active: !position },
          ...Object.entries(ROLE_SLUGS).map(([slug, pos]) => ({
            key: slug,
            label: dict.positions[pos as Position],
            href: href({ role: slug }),
            icon: positionIcon(pos),
            active: position === pos,
          })),
        ]}
      />
      <FilterPills
        label={C.bracket}
        pills={BRACKETS.map((b) => ({ key: b, label: C.brackets[b], href: href({ elo: b }), active: b === bracket }))}
      />
    </div>
  );

  if (!scope) {
    return (
      <div className="animate-fade-up">
        {header}
        {filters}
        <div className="mt-8 rounded-2xl border border-dashed border-line-strong px-6 py-16 text-center text-sm text-muted">
          <p>{C.empty}</p>
          <code className="mt-3 inline-block rounded-md bg-panel-2 px-2.5 py-1 font-mono text-xs text-fg">
            bun run worker:crawl -- --seed && bun run worker:aggregate
          </code>
        </div>
      </div>
    );
  }

  const list = await loadTierList(db(), scope, position);
  const rows: TierRow[] = list
    .filter((r) => data.champions[r.championId])
    .map((r) => {
      const champ = data.champions[r.championId]!;
      const ci = wilson(r.wins, r.games);
      const role = Object.entries(ROLE_SLUGS).find(([, p]) => p === r.position)?.[0];
      return {
        key: `${r.championId}-${r.position}`,
        href: localePath(locale, `/champions/${championSlug(data, r.championId)}?${new URLSearchParams({ ...(role ? { role } : {}), ...(bracket !== "emerald_plus" ? { elo: bracket } : {}) })}`),
        name: champ.name,
        icon: ddragonImg.champion(data.version, champ.id),
        roleIcon: positionIcon(r.position),
        roleLabel: dict.positions[r.position as Position] ?? r.position,
        tier: r.tier,
        score: r.score,
        winrate: r.winrate,
        low: ci.low,
        high: ci.high,
        pickRate: r.pickRate,
        banRate: r.banRate,
        games: r.games,
        lowSample: r.games < SMALL_SAMPLE * 5,
      };
    });

  return (
    <div className="animate-fade-up">
      {header}
      {filters}
      <div className="mt-6">
        <TierTable
          rows={rows}
          showRole={!position}
          labels={{
            champion: C.champion,
            tier: C.tier,
            winrate: C.winrate,
            pickRate: C.pickRate,
            banRate: C.banRate,
            games: C.games,
            filter: C.filter,
            noResults: C.noResults,
            lowSample: C.lowSample,
          }}
        />
      </div>
      <p className="mt-4 max-w-2xl text-xs leading-relaxed text-faint">{C.tierNote}</p>
    </div>
  );
}
