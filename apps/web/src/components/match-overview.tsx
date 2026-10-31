import type { ProfileMatch } from "@riftlens/core";
import { kda } from "@riftlens/core";
import type { MatchParticipant } from "@riftlens/db";
import { isApex, regionByPlatform, type ObjectiveKind, type StaticData, type Tier } from "@riftlens/riot";
import Link from "next/link";
import { t, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/server";
import { formatInt, pct, summonerPath, thousands } from "@/lib/format";
import { computeImpact } from "@/lib/impact";
import { ChampionIcon, ItemIcon, RuneIcon, SpellIcon } from "./icons";
import { ObjectiveIcon } from "./objective-icon";

const OBJECTIVES: { key: string; kind: ObjectiveKind }[] = [
  { key: "tower", kind: "tower" },
  { key: "inhibitor", kind: "inhibitor" },
  { key: "dragon", kind: "dragon" },
  { key: "horde", kind: "horde" },
  { key: "riftHerald", kind: "herald" },
  { key: "baron", kind: "baron" },
  { key: "atakhan", kind: "atakhan" },
];

const teamColor = (teamId: number) => (teamId === 100 ? "var(--color-win)" : "var(--color-loss)");

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <span className="block h-1 w-full overflow-hidden rounded-full bg-panel-3">
      <span className="block h-full rounded-full" style={{ width: `${(value / Math.max(1, max)) * 100}%`, background: color }} />
    </span>
  );
}

/** Marcador completo de una partida (todo con datos guardados, sin llamar a Riot). */
export function MatchOverview({
  m,
  data,
  dict,
  locale,
  ranks,
}: {
  m: ProfileMatch;
  data: StaticData;
  dict: Dictionary;
  locale: Locale;
  ranks: Record<string, { tier: string; division: string }>;
}) {
  const D = dict.matchDetails;
  const { match, participants, me } = m;
  const region = regionByPlatform(match.platform);
  const impact = computeImpact(participants);
  const minutes = match.gameDuration / 60;
  const maxDealt = Math.max(1, ...participants.map((p) => p.damage));
  const maxTaken = Math.max(1, ...participants.map((p) => p.damageTaken));
  const teams = [100, 200].map((id) => participants.filter((p) => p.teamId === id));
  const totals = teams.map((team) => ({ kills: team.reduce((s, p) => s + p.kills, 0), gold: team.reduce((s, p) => s + p.gold, 0) }));
  const hasWards = participants.some((p) => (p.wardsPlaced ?? 0) > 0);

  const row = (p: MatchParticipant) => {
    const imp = impact.get(p.puuid);
    const teamKills = totals[p.teamId === 100 ? 0 : 1]!.kills;
    const rank = ranks[p.puuid];
    const ratio = kda(p.kills, p.deaths, p.assists);
    return (
      <li
        key={p.puuid}
        className={`grid grid-cols-[minmax(0,1fr)_48px_92px_86px] items-center gap-2.5 md:grid-cols-[minmax(0,1fr)_52px_96px_120px_64px_56px_86px] px-3 py-2 ${
          p.puuid === me.puuid ? "bg-panel-3/70" : ""
        }`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <div className="relative shrink-0">
            <ChampionIcon data={data} championId={p.championId} size={34} className="rounded-lg" />
            <span className="tabular absolute -bottom-1 -right-1 rounded border border-line bg-bg px-0.5 text-[9px] leading-3 text-muted">{p.champLevel}</span>
          </div>
          <div className="hidden grid-cols-2 gap-0.5 sm:grid">
            <SpellIcon data={data} spellId={p.spell1} size={15} className="rounded" />
            <RuneIcon data={data} runeId={p.keystone} size={15} className="rounded-full bg-panel-3" />
            <SpellIcon data={data} spellId={p.spell2} size={15} className="rounded" />
            <RuneIcon data={data} runeId={p.subStyle} size={15} className="opacity-70" />
          </div>
          <div className="min-w-0">
            {p.gameName && region ? (
              <Link href={summonerPath(locale, region.slug, p.gameName, p.tagLine ?? "")} className="block truncate text-xs font-medium hover:text-accent">
                {p.gameName}
              </Link>
            ) : (
              <span className="block text-xs text-faint">—</span>
            )}
            <span className="block truncate text-[10px] text-faint">
              {rank ? `${dict.tiers[rank.tier as Tier] ?? rank.tier}${isApex(rank.tier) ? "" : ` ${rank.division}`}` : " "}
            </span>
          </div>
        </div>

        <div className="text-center" title={D.impactHelp}>
          <p className="tabular text-sm font-semibold">{imp ? imp.score.toFixed(1) : "—"}</p>
          {imp?.badge ? (
            <span className={`inline-block rounded px-1 text-[9px] font-semibold leading-4 ${imp.badge === "mvp" ? "bg-gold/20 text-gold" : "bg-accent/15 text-accent-strong"}`}>
              {imp.badge === "mvp" ? D.mvp : D.ace}
            </span>
          ) : (
            <span className="tabular text-[10px] text-faint">{imp ? t(D.rankN, { n: imp.rank }) : ""}</span>
          )}
        </div>

        <div className="text-center">
          <p className="tabular text-xs">
            {p.kills}/<span className="text-loss">{p.deaths}</span>/{p.assists}
            <span className="ml-1 text-faint">({pct(teamKills ? (p.kills + p.assists) / teamKills : 0)})</span>
          </p>
          <p className="tabular text-[11px] font-medium" style={{ color: ratio >= 4 ? "var(--color-gold)" : ratio >= 3 ? "var(--color-accent)" : "var(--color-muted)" }}>
            {Number.isFinite(ratio) ? `${ratio.toFixed(2)}:1` : dict.profile.perfect}
          </p>
        </div>

        <div className="hidden space-y-1 md:block" title={D.damageHelp}>
          <div className="tabular flex justify-between text-[10px]">
            <span>{formatInt(p.damage, locale)}</span>
            <span className="text-faint">{formatInt(p.damageTaken, locale)}</span>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <Bar value={p.damage} max={maxDealt} color="var(--color-loss)" />
            <Bar value={p.damageTaken} max={maxTaken} color="var(--color-faint)" />
          </div>
        </div>

        <div className="tabular hidden text-center text-[11px] md:block" title={D.wardsHelp}>
          {hasWards ? (
            <>
              <p>{p.controlWards ?? 0}</p>
              <p className="text-faint">
                {p.wardsPlaced ?? 0} / {p.wardsKilled ?? 0}
              </p>
            </>
          ) : (
            <p className="text-faint">{p.visionScore}</p>
          )}
        </div>

        <div className="tabular hidden text-center text-[11px] md:block">
          <p>{p.cs}</p>
          <p className="text-faint">{t(D.perMin, { n: (p.cs / minutes).toFixed(1) })}</p>
        </div>

        <div className="grid grid-cols-4 justify-end gap-0.5">
          {p.items.slice(0, 6).map((it, i) => (
            <ItemIcon key={i} data={data} itemId={it} size={20} className="rounded" />
          ))}
          <ItemIcon data={data} itemId={p.items[6] ?? 0} size={20} className="rounded-full" />
        </div>
      </li>
    );
  };

  const header = (team: MatchParticipant[], i: number) => {
    const won = team[0]?.win;
    return (
      <div className="grid grid-cols-[minmax(0,1fr)_48px_92px_86px] items-center gap-2.5 md:grid-cols-[minmax(0,1fr)_52px_96px_120px_64px_56px_86px] px-3 pt-3 pb-1.5">
        <p className="text-xs font-semibold" style={{ color: match.remake ? undefined : teamColor(won ? 100 : 200) }}>
          {match.remake ? dict.profile.team : won ? dict.profile.victory : dict.profile.defeat}
          <span className="ml-1.5 font-normal text-faint">{i === 0 ? dict.profile.blue : dict.profile.red}</span>
        </p>
        <span className="eyebrow text-center" title={D.impactHelp}>
          {D.impact}
        </span>
        <span className="eyebrow text-center">KDA</span>
        <span className="eyebrow hidden text-center md:block" title={D.damageHelp}>
          {D.damage}
        </span>
        <span className="eyebrow hidden text-center md:block" title={D.wardsHelp}>
          {hasWards ? D.wards : dict.profile.vision.replace("{n}", "").trim()}
        </span>
        <span className="eyebrow hidden text-center md:block">CS</span>
        <span className="eyebrow text-right">{dict.profile.items}</span>
      </div>
    );
  };

  const objectives = (teamId: number) => {
    const o = match.teams?.[String(teamId)];
    if (!o) return null;
    return (
      <ul className="flex flex-wrap items-center gap-x-3 gap-y-1" style={{ color: teamColor(teamId) }}>
        {OBJECTIVES.filter(({ key }) => key in o).map(({ key, kind }) => (
          <li key={key} className="flex items-center gap-1" title={D.objectives[kind]}>
            <ObjectiveIcon kind={kind} />
            <span className="tabular text-xs text-fg">{o[key]}</span>
          </li>
        ))}
      </ul>
    );
  };

  const split = (a: number, b: number) => (a + b ? (a / (a + b)) * 100 : 50);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[480px]">
        {header(teams[0]!, 0)}
        <ul>{teams[0]!.map(row)}</ul>

        <div className="my-2 grid items-center gap-4 border-y border-line px-3 py-3 md:grid-cols-[1fr_minmax(0,1.6fr)_1fr]">
          <div>{objectives(100)}</div>
          <div className="space-y-1.5">
            {[
              { label: D.totalKills, a: totals[0]!.kills, b: totals[1]!.kills, fmt: (n: number) => String(n) },
              { label: D.totalGold, a: totals[0]!.gold, b: totals[1]!.gold, fmt: (n: number) => thousands(n) },
            ].map((bar) => (
              <div key={bar.label} className="relative flex h-5 overflow-hidden rounded-md text-[10px] font-medium">
                <div className="flex items-center bg-win/70 pl-2" style={{ width: `${split(bar.a, bar.b)}%` }}>
                  <span className="tabular">{bar.fmt(bar.a)}</span>
                </div>
                <div className="flex flex-1 items-center justify-end bg-loss/70 pr-2">
                  <span className="tabular">{bar.fmt(bar.b)}</span>
                </div>
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] text-fg/90">{bar.label}</span>
              </div>
            ))}
          </div>
          <div className="md:justify-self-end">{objectives(200)}</div>
        </div>

        {header(teams[1]!, 1)}
        <ul>{teams[1]!.map(row)}</ul>
      </div>
    </div>
  );
}
