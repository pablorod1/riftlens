import type { ChampionRow, StatsScope } from "@riftlens/core";
import type { ChampionDetail } from "@riftlens/db";
import { ddragonImg, POSITIONS, type Position, type StaticData } from "@riftlens/riot";
import { localePath, t, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/server";
import { positionIcon } from "@/lib/assets";
import { championSlug } from "@/lib/champions";
import { summonerPath } from "@/lib/format";
import { SpellIcon } from "../icons";
import { BuildToggle } from "./build-toggle";
import { BuildVariantView } from "./build-variant";
import { ItemsExplorer, PairsExplorer, type ChampRef, type ItemRow } from "./explorers";
import { BestPlayers, Duration, Objectives, PlayerBase, RuneStats, SkillLevels, Stats, Trends } from "./sections";
import { Card, pct1, Stat, wrColor } from "./ui";
import { YouCard } from "./you-card";

/** Cabecera ampliada: Δ winrate, esperado y puesto en el rol. */
export function DetailHeaderStats({ role, detail, rank, of, dict }: { role: ChampionRow; detail: ChampionDetail; rank: number; of: number; dict: Dictionary }) {
  const C = dict.champ;
  const delta = role.winrate - detail.gameAvgWr;
  return (
    <>
      <div title={C.wrDeltaHelp}>
        <dt className="eyebrow">{C.wrDelta}</dt>
        <dd className="tabular mt-1.5 text-2xl font-semibold" style={{ color: wrColor(0.5 + delta) }}>
          {delta >= 0 ? "+" : "−"}
          {Math.abs(delta * 100).toFixed(1)}
        </dd>
      </div>
      <div title={C.gameAvgHelp} className="hidden md:block">
        <dt className="eyebrow">{C.gameAvg}</dt>
        <dd className="tabular mt-1.5 text-2xl font-semibold text-muted">{pct1(detail.gameAvgWr)}</dd>
      </div>
      <div>
        <dt className="eyebrow">{C.roleRank}</dt>
        <dd className="tabular mt-1.5 text-2xl font-semibold">
          {rank}
          <span className="text-sm text-faint">/{of}</span>
        </dd>
      </div>
    </>
  );
}

export function DetailedView({
  role,
  detail,
  scope,
  data,
  dict,
  locale,
  championId,
  rank,
  of,
  region,
  bracketQuery,
  lab,
}: {
  role: ChampionRow;
  detail: ChampionDetail;
  scope: StatsScope;
  data: StaticData;
  dict: Dictionary;
  locale: Locale;
  championId: number;
  rank: number;
  of: number;
  region: string;
  bracketQuery: string;
  /** Laboratorio de matchups (tabla, comparador y fortalezas) */
  lab: React.ReactNode;
}) {
  const C = dict.champ;
  const L = dict.lab;
  const champ = data.champions[championId]!;
  const total = role.games;
  const roleName = dict.positions[role.position as Position] ?? role.position;

  // Frase resumen: rivales de línea con mayor y menor efecto propio (Δ2), con muestra mínima
  const lane = (detail.counters[role.position] ?? []).filter((r) => r.games >= Math.max(5, total * 0.01));
  const d2 = (r: (typeof lane)[number]) => r.wins / r.games - (role.winrate + (1 - r.otherWr) - 0.5);
  const names = (list: typeof lane) => {
    const n = list.map((r) => data.champions[r.championId]?.name).filter(Boolean) as string[];
    return n.length > 1 ? `${n.slice(0, -1).join(", ")} ${C.and} ${n[n.length - 1]}` : (n[0] ?? "");
  };
  const strong = [...lane].sort((a, b) => d2(b) - d2(a)).filter((r) => d2(r) > 0).slice(0, 3);
  const weak = [...lane].sort((a, b) => d2(a) - d2(b)).filter((r) => d2(r) < 0).slice(0, 3);

  // Referencias de campeón para los componentes de cliente (solo los que aparecen)
  const referenced = new Set<number>();
  for (const group of [detail.counters, detail.synergy]) for (const list of Object.values(group)) for (const r of list) referenced.add(r.championId);
  const champs: Record<number, ChampRef> = {};
  for (const id of referenced) {
    const c = data.champions[id];
    if (c) champs[id] = { name: c.name, icon: ddragonImg.champion(data.version, c.id), href: localePath(locale, `/champions/${championSlug(data, id)}${bracketQuery}`) };
  }

  const itemRows = (list: { item: number; games: number; wins: number; minute?: number }[]): ItemRow[] =>
    list.map((e) => ({ key: String(e.item), items: [e.item], games: e.games, wins: e.wins, minute: e.minute }));
  const winning = [...detail.items.all].filter((e) => e.games >= Math.max(5, total * 0.02)).sort((a, b) => b.wins / b.games - a.wins / a.games);
  const usedItems = new Set<number>([
    ...detail.items.starting.flatMap((s) => s.items),
    ...detail.items.early.map((e) => e.item),
    ...detail.items.all.map((e) => e.item),
    ...detail.items.byPosition.flat().map((e) => e.item),
  ]);
  const itemNames = Object.fromEntries([...usedItems].map((id) => [id, data.items[id]?.name ?? String(id)]));

  return (
    <div className="mt-6 space-y-6">
      <p className="max-w-3xl text-sm leading-relaxed text-muted">
        {t(C.summary, { champion: champ.name, role: roleName, wr: pct1(role.winrate), bracket: dict.champions.brackets[scope.bracket], patch: scope.patch, rank, of })}{" "}
        {strong.length > 0 && t(C.strongVs, { list: names(strong) })} {weak.length > 0 && t(C.weakVs, { list: names(weak) })}
      </p>

      <YouCard
        championId={championId}
        position={role.position}
        championName={champ.name}
        labels={{ title: C.you, help: t(C.youHelp, { role: roleName, bracket: dict.champions.brackets[scope.bracket] }), noGames: C.youNoGames, games: C.youGames, better: dict.coach.better, worse: dict.coach.worse }}
        metricLabels={dict.coach.metrics}
      />

      <div id="build" className="grid scroll-mt-28 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <Card title={C.build}>
            <BuildToggle
              labels={{ best: C.buildBest, common: C.buildCommon, help: C.buildHelp }}
              best={<BuildVariantView v={detail.builds.best} data={data} dict={dict} total={total} />}
              common={<BuildVariantView v={detail.builds.common} data={data} dict={dict} total={total} />}
            />
          </Card>
          <Card title={C.trends}>
            <Trends trend={detail.trend} dict={dict} />
          </Card>
        </div>
        <aside className="space-y-6">
          <Card title={C.spells}>
            <ul className="space-y-2.5">
              {detail.spells.map((s) => (
                <li key={s.spells.join()} className="flex items-center justify-between">
                  <span className="flex gap-1.5">
                    {s.spells.map((id) => (
                      <SpellIcon key={id} data={data} spellId={id} size={28} className="rounded-lg" />
                    ))}
                  </span>
                  <Stat e={s} total={total} />
                </li>
              ))}
            </ul>
          </Card>
          <Card title={C.objectives}>
            <Objectives detail={detail} dict={dict} total={total} />
          </Card>
          <Card title={C.duration}>
            <Duration duration={detail.duration} dict={dict} />
          </Card>
        </aside>
      </div>

      {lab}

      <div id="synergy" className="scroll-mt-28">
        <Card title={`${L.nav.synergy} · ${C.synergy}`} help={`${C.delta1Help} ${C.delta2Help}`}>
          <PairsExplorer
            counters={detail.counters}
            synergy={detail.synergy}
            champWr={role.winrate}
            totalGames={total}
            champs={champs}
            positions={POSITIONS.map((p) => ({ key: p, label: dict.positions[p], icon: positionIcon(p) }))}
            labels={{
              counters: C.counters,
              synergy: C.synergy,
              common: C.modeCommon,
              strong: C.modeStrong,
              weak: C.modeWeak,
              delta: C.modeDelta,
              vs: C.vsRole,
              with: C.withRole,
              d1: C.delta1,
              d1Help: C.delta1Help,
              d2: C.delta2,
              d2Help: C.delta2Help,
              pick: C.pickRateShort,
              games: C.gamesShort,
            }}
          />
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <div id="items" className="scroll-mt-28">
            <Card title={C.items}>
              <ItemsExplorer
                version={data.version}
                itemNames={itemNames}
                totalGames={total}
                labels={{ pick: C.pickRateShort, games: C.gamesShort, minute: C.avgMinute }}
                tabs={[
                  { key: "starting", label: C.itemTabs.starting, rows: detail.items.starting.map((s) => ({ key: s.items.join(","), items: s.items, games: s.games, wins: s.wins })) },
                  { key: "early", label: C.itemTabs.early, rows: itemRows(detail.items.early) },
                  ...detail.items.byPosition.map((list, i) => ({ key: `p${i}`, label: t(C.itemN1, { n: i + 1 }), rows: itemRows(list) })),
                  { key: "popular", label: C.itemTabs.popular, rows: itemRows(detail.items.all.slice(0, 24)) },
                  { key: "winning", label: C.itemTabs.winning, rows: itemRows(winning.slice(0, 24)) },
                ]}
              />
            </Card>
          </div>
          <Card title={C.skillsByLevel} help={C.skillsByLevelHelp}>
            <SkillLevels levels={detail.skillLevels} dict={dict} />
          </Card>
          <div id="runes" className="scroll-mt-28">
            <Card title={C.runeStats} help={C.runeStatsHelp}>
              <RuneStats stats={detail.runeStats} data={data} total={total} />
            </Card>
          </div>
        </div>
        <aside id="stats" className="scroll-mt-28 space-y-6">
          <Card title={C.stats} help={C.statsHelp}>
            <Stats stats={detail.stats} dict={dict} locale={locale} />
          </Card>
          <Card title={C.playerBase} help={C.playerBaseHelp}>
            <PlayerBase base={detail.playerBase} dict={dict} />
          </Card>
          <Card title={C.bestPlayers} help={C.bestPlayersHelp}>
            <BestPlayers players={detail.bestPlayers} dict={dict} hrefFor={(name, tag) => summonerPath(locale, region, name, tag)} />
          </Card>
        </aside>
      </div>
    </div>
  );
}
