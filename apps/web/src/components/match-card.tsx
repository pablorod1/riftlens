import type { ProfileMatch } from "@riftlens/core";
import { kda } from "@riftlens/core";
import { regionByPlatform, type StaticData } from "@riftlens/riot";
import Link from "next/link";
import { t, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/server";
import { duration, fmtKda, formatInt, pct, summonerPath, thousands, timeAgo } from "@/lib/format";
import { ChampionIcon, ItemIcon, RuneIcon, SpellIcon } from "./icons";
import { MatchAnalysisView } from "./match-analysis";

type Outcome = { label: string; color: string; tint: string };

function outcome(m: ProfileMatch, p: Dictionary["profile"]): Outcome {
  if (m.match.remake) return { label: p.remake, color: "var(--color-remake)", tint: "transparent" };
  return m.me.win
    ? { label: p.victory, color: "var(--color-win)", tint: "var(--color-win-bg)" }
    : { label: p.defeat, color: "var(--color-loss)", tint: "var(--color-loss-bg)" };
}

export function MatchCard({
  m,
  data,
  now,
  dict,
  locale,
}: {
  m: ProfileMatch;
  data: StaticData;
  now: number;
  dict: Dictionary;
  locale: Locale;
}) {
  const { me, match, participants } = m;
  const p = dict.profile;
  const o = outcome(m, p);
  const queue = dict.queues[String(match.queueId) as keyof Dictionary["queues"]] ?? dict.queues.other;
  const minutes = match.gameDuration / 60;
  const teamKills = participants.filter((x) => x.teamId === me.teamId).reduce((sum, x) => sum + x.kills, 0);
  const kp = teamKills ? (me.kills + me.assists) / teamKills : 0;
  const region = regionByPlatform(match.platform);
  const teams = [100, 200].map((team) => participants.filter((x) => x.teamId === team));
  const maxDamage = Math.max(1, ...participants.map((x) => x.damage));
  const ratio = kda(me.kills, me.deaths, me.assists);

  return (
    <details className="match group relative overflow-hidden rounded-xl border border-line bg-panel transition-colors hover:border-line-strong">
      <summary
        className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-3 py-3 pl-5 pr-4 lg:flex-nowrap lg:gap-x-5 [&::-webkit-details-marker]:hidden"
        style={{ background: `linear-gradient(90deg, ${o.tint}, transparent 45%)` }}
      >
        <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ background: o.color }} />

        <div className="w-[104px] shrink-0">
          <p className="text-sm font-semibold" style={{ color: o.color }}>
            {o.label}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted">{queue}</p>
          <p className="tabular mt-0.5 truncate text-[11px] text-faint">
            {duration(match.gameDuration)} · {timeAgo(match.gameCreation, now, locale, "short")}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <div className="relative">
            <ChampionIcon data={data} championId={me.championId} size={46} className="rounded-xl" />
            <span className="tabular absolute -bottom-1 -right-1 rounded-md border border-line bg-bg px-1 text-[10px] leading-4 text-muted">
              {me.champLevel}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-0.5">
            <SpellIcon data={data} spellId={me.spell1} size={21} className="rounded-md" />
            <RuneIcon data={data} runeId={me.keystone} size={21} className="rounded-full bg-panel-3" />
            <SpellIcon data={data} spellId={me.spell2} size={21} className="rounded-md" />
            <RuneIcon data={data} runeId={me.subStyle} size={21} className="p-0.5 opacity-80" />
          </div>
        </div>

        <div className="w-[112px] shrink-0">
          <p className="tabular text-[15px] font-medium">
            {me.kills}
            <span className="text-faint"> / </span>
            <span className="text-loss">{me.deaths}</span>
            <span className="text-faint"> / </span>
            {me.assists}
          </p>
          <p className="tabular mt-0.5 flex items-center gap-1.5 whitespace-nowrap text-xs text-muted">
            {t(p.kda, { kda: fmtKda(ratio, p.perfect) })}
            {me.largestMultiKill >= 2 && (
              <span className="rounded border border-gold/40 px-1 text-[10px] leading-4 text-gold">
                {p.multikill[String(me.largestMultiKill) as keyof typeof p.multikill]}
              </span>
            )}
          </p>
        </div>

        <div className="tabular hidden w-[104px] shrink-0 space-y-0.5 text-[11px] text-muted sm:block">
          <p>{t(p.kp, { pct: pct(kp) })}</p>
          <p>{t(p.cs, { cs: me.cs, perMin: (me.cs / minutes).toFixed(1) })}</p>
          <p>{t(p.vision, { n: me.visionScore })}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {me.items.slice(0, 6).map((it, i) => (
            <ItemIcon key={i} data={data} itemId={it} size={24} className="rounded-md" />
          ))}
          <ItemIcon data={data} itemId={me.items[6] ?? 0} size={24} className="ml-1 rounded-full" />
        </div>

        <svg viewBox="0 0 16 16" aria-hidden className="ml-auto size-4 shrink-0 text-faint transition-transform duration-300 group-open:rotate-180">
          <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>

      <div className="grid gap-6 border-t border-line px-5 py-5 lg:grid-cols-2">
        {!match.remake && me.position && region && (
          <div className="lg:col-span-2">
            <MatchAnalysisView matchId={match.matchId} puuid={me.puuid} region={region.slug} lang={locale} labels={dict.analysis} />
          </div>
        )}
        {teams.map((team, i) => {
          const won = team[0]?.win;
          const kills = team.reduce((s, x) => s + x.kills, 0);
          return (
            <div key={i}>
              <div className="mb-2 flex items-baseline justify-between">
                <p className="text-xs font-medium" style={{ color: match.remake ? undefined : won ? "var(--color-win)" : "var(--color-loss)" }}>
                  {match.remake ? p.team : won ? p.victory : p.defeat}
                  <span className="ml-1.5 font-normal text-faint">{i === 0 ? p.blue : p.red}</span>
                </p>
                <p className="tabular text-[11px] text-faint">{kills} K</p>
              </div>
              <ul className="space-y-1">
                {team.map((pl) => (
                  <li
                    key={pl.puuid}
                    className={`grid grid-cols-[22px_minmax(0,1fr)_64px_72px] items-center gap-2.5 rounded-md px-1.5 py-1 text-xs ${
                      pl.puuid === me.puuid ? "bg-panel-3" : ""
                    }`}
                  >
                    <ChampionIcon data={data} championId={pl.championId} size={22} className="rounded-md" />
                    {pl.gameName && region ? (
                      <Link href={summonerPath(locale, region.slug, pl.gameName, pl.tagLine ?? "")} className="truncate hover:text-accent">
                        {pl.gameName}
                      </Link>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                    <span className="tabular text-right text-muted">
                      {pl.kills}/{pl.deaths}/{pl.assists}
                    </span>
                    <span className="flex items-center gap-1.5" title={`${p.damage}: ${formatInt(pl.damage, locale)} · ${p.gold}: ${thousands(pl.gold)}`}>
                      <span className="h-1 flex-1 overflow-hidden rounded-full bg-panel-3">
                        <span className="block h-full rounded-full bg-fg/60" style={{ width: `${(pl.damage / maxDamage) * 100}%` }} />
                      </span>
                      <span className="tabular w-7 text-right text-[10px] text-faint">{thousands(pl.damage)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </details>
  );
}
