import type { ProfileMatch } from "@riftlens/core";
import { kda } from "@riftlens/core";
import { regionByPlatform, queueName, type StaticData } from "@riftlens/riot";
import Link from "next/link";
import { duration, fmtKda, int, pct, summonerPath, thousands, timeAgo } from "@/lib/format";
import { ChampionIcon, ItemIcon, RuneIcon, SpellIcon } from "./icons";

const MULTI = { 2: "Doble", 3: "Triple", 4: "Cuádruple", 5: "Pentakill" } as Record<number, string>;

function outcome(m: ProfileMatch) {
  if (m.match.remake) return { label: "Remake", color: "var(--color-remake)", bg: "var(--color-panel)" } as const;
  return m.me.win
    ? ({ label: "Victoria", color: "var(--color-win)", bg: "var(--color-win-bg)" } as const)
    : ({ label: "Derrota", color: "var(--color-loss)", bg: "var(--color-loss-bg)" } as const);
}

export function MatchCard({ m, data, now }: { m: ProfileMatch; data: StaticData; now: number }) {
  const { me, match, participants } = m;
  const o = outcome(m);
  const minutes = match.gameDuration / 60;
  const teamKills = participants.filter((p) => p.teamId === me.teamId).reduce((s, p) => s + p.kills, 0);
  const kp = teamKills ? (me.kills + me.assists) / teamKills : 0;
  const region = regionByPlatform(match.platform);
  const teams = [100, 200].map((t) => participants.filter((p) => p.teamId === t));

  return (
    <details className="group overflow-hidden rounded-xl border border-line" style={{ background: o.bg }}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 border-l-4 sm:flex-nowrap px-3 py-3 [&::-webkit-details-marker]:hidden" style={{ borderColor: o.color }}>
        {/* Cola, resultado, tiempo */}
        <div className="w-24 shrink-0 text-xs">
          <p className="font-semibold" style={{ color: o.color }}>
            {queueName(match.queueId)}
          </p>
          <p className="text-muted">{timeAgo(match.gameCreation, now)}</p>
          <div className="my-1.5 h-px w-10 bg-line" />
          <p className="font-semibold">{o.label}</p>
          <p className="tabular text-muted">{duration(match.gameDuration)}</p>
        </div>

        {/* Campeón, hechizos, runas */}
        <div className="flex shrink-0 items-center gap-1">
          <div className="relative">
            <ChampionIcon data={data} championId={me.championId} size={48} className="rounded-full" />
            <span className="tabular absolute -bottom-1 -right-1 rounded-full bg-bg px-1 text-[10px]">{me.champLevel}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <SpellIcon data={data} spellId={me.spell1} size={22} />
            <SpellIcon data={data} spellId={me.spell2} size={22} />
          </div>
          <div className="flex flex-col gap-0.5">
            <RuneIcon data={data} runeId={me.keystone} size={22} className="rounded-full bg-bg" />
            <RuneIcon data={data} runeId={me.subStyle} size={22} className="p-0.5" />
          </div>
        </div>

        {/* KDA */}
        <div className="w-24 shrink-0 text-center">
          <p className="tabular font-bold">
            {me.kills} / <span className="text-loss">{me.deaths}</span> / {me.assists}
          </p>
          <p className="tabular text-xs text-muted">{fmtKda(kda(me.kills, me.deaths, me.assists))} KDA</p>
          {me.largestMultiKill >= 2 && (
            <span className="mt-1 inline-block rounded-full bg-loss/80 px-2 text-[10px] font-semibold">{MULTI[me.largestMultiKill]}</span>
          )}
        </div>

        {/* Estadísticas */}
        <div className="tabular hidden w-28 shrink-0 text-xs text-muted md:block">
          <p>P/Kill {pct(kp)}</p>
          <p>
            CS {me.cs} ({(me.cs / minutes).toFixed(1)})
          </p>
          <p>Visión {me.visionScore}</p>
        </div>

        {/* Objetos */}
        <div className="grid shrink-0 grid-cols-4 gap-0.5">
          {me.items.slice(0, 6).map((it, i) => (
            <ItemIcon key={i} data={data} itemId={it} size={26} />
          ))}
          <ItemIcon data={data} itemId={me.items[6] ?? 0} size={26} className="rounded-full" />
        </div>

        {/* Jugadores */}
        <div className="ml-auto hidden gap-2 xl:flex">
          {teams.map((team, i) => (
            <ul key={i} className="w-24 space-y-0.5">
              {team.map((p) => (
                <li key={p.puuid} className="flex items-center gap-1 text-[11px]">
                  <ChampionIcon data={data} championId={p.championId} size={15} />
                  <span className={`truncate ${p.puuid === me.puuid ? "font-semibold text-fg" : "text-muted"}`}>
                    {p.gameName ?? "—"}
                  </span>
                </li>
              ))}
            </ul>
          ))}
        </div>

        <span className="ml-auto text-muted transition-transform group-open:rotate-180 xl:ml-0" aria-hidden>
          ▾
        </span>
      </summary>

      {/* Detalle: marcador completo */}
      <div className="space-y-3 border-t border-line bg-panel p-3">
        {teams.map((team, i) => {
          const won = team[0]?.win;
          return (
            <table key={i} className="w-full text-xs">
              <thead>
                <tr className="text-left text-faint">
                  <th className="pb-1 font-semibold" style={{ color: match.remake ? undefined : won ? "var(--color-win)" : "var(--color-loss)" }}>
                    {match.remake ? "Equipo" : won ? "Victoria" : "Derrota"} ({i === 0 ? "azul" : "rojo"})
                  </th>
                  <th className="pb-1 text-center font-normal">KDA</th>
                  <th className="hidden pb-1 text-center font-normal sm:table-cell">Daño</th>
                  <th className="hidden pb-1 text-center font-normal sm:table-cell">Oro</th>
                  <th className="pb-1 text-center font-normal">CS</th>
                  <th className="hidden pb-1 font-normal md:table-cell">Objetos</th>
                </tr>
              </thead>
              <tbody>
                {team.map((p) => (
                  <tr key={p.puuid} className={p.puuid === me.puuid ? "bg-panel-2" : ""}>
                    <td className="py-0.5">
                      <div className="flex items-center gap-1.5">
                        <ChampionIcon data={data} championId={p.championId} size={24} />
                        {p.gameName && region ? (
                          <Link href={summonerPath(region.slug, p.gameName, p.tagLine ?? "")} className="truncate hover:text-accent">
                            {p.gameName}
                          </Link>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </div>
                    </td>
                    <td className="tabular text-center">
                      {p.kills}/{p.deaths}/{p.assists}
                    </td>
                    <td className="tabular hidden text-center sm:table-cell">{int.format(p.damage)}</td>
                    <td className="tabular hidden text-center sm:table-cell">{thousands(p.gold)}</td>
                    <td className="tabular text-center">{p.cs}</td>
                    <td className="hidden md:table-cell">
                      <div className="flex gap-0.5">
                        {p.items.map((it, j) => (
                          <ItemIcon key={j} data={data} itemId={it} size={20} />
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          );
        })}
      </div>
    </details>
  );
}
