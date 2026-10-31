"use client";

import { ddragonImg, maxOrder, shardIcon, STAT_SHARD_ROWS } from "@riftlens/riot";
import { useState } from "react";
import type { MatchTimelinePayload } from "@/app/actions";
import { PlayerPicker } from "./player-picker";
import type { DetailLabels, PlayerMeta } from "./types";

const KEYS = ["", "Q", "W", "E", "R"];
const KEY_COLOR: Record<string, string> = { Q: "var(--color-win)", W: "#5fd4c4", E: "#f6a560", R: "var(--color-fg)" };
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line p-4">
      <h3 className="eyebrow mb-3">{title}</h3>
      {children}
    </section>
  );
}

export function BuildView({ data, players, me, labels }: { data: MatchTimelinePayload; players: PlayerMeta[]; me: string; labels: DetailLabels }) {
  const D = labels.d;
  const tl = data.timeline!;
  const [pid, setPid] = useState(players.find((p) => p.puuid === me)?.participantId ?? 1);
  const player = players.find((p) => p.participantId === pid)!;

  // Compras agrupadas por minuto
  const groups: { minute: number; items: { item: number; sold?: boolean; count: number }[] }[] = [];
  for (const it of tl.items[pid] ?? []) {
    const minute = Math.floor(it.t / 60_000);
    let g = groups[groups.length - 1];
    if (!g || g.minute !== minute) groups.push((g = { minute, items: [] }));
    const same = g.items.find((x) => x.item === it.item && !!x.sold === !!it.sold);
    if (same) same.count++;
    else g.items.push({ item: it.item, sold: it.sold, count: 1 });
  }

  const skills = (tl.skills[pid] ?? []).map((s) => KEYS[s.slot] ?? "");
  const order = maxOrder(skills.join(""));
  const runeImg = (id: number) => (data.runes?.[id] ? ddragonImg.rune(data.runes[id]!.icon) : null);
  const primary = data.runeTrees?.find((t) => t.id === player.primaryStyle);
  const secondary = data.runeTrees?.find((t) => t.id === player.subStyle);
  const chosen = new Set(player.perks);

  const RuneDot = ({ id, big = false }: { id: number; big?: boolean }) => {
    const src = runeImg(id);
    const on = chosen.has(id);
    return src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={data.runes?.[id]?.name ?? ""}
        title={data.runes?.[id]?.name}
        className={`rounded-full ${big ? "size-10" : "size-7"} ${on ? "bg-panel-3 ring-1 ring-gold/70" : "opacity-25 grayscale"}`}
      />
    ) : null;
  };

  return (
    <div className="space-y-4">
      <PlayerPicker players={players} selected={[pid]} onSelect={setPid} />

      <Section title={D.itemBuild}>
        {groups.length === 0 ? (
          <p className="text-sm text-faint">{D.noTimeline}</p>
        ) : (
          <ol className="flex flex-wrap items-start gap-x-1.5 gap-y-4">
            {groups.map((g, i) => (
              <li key={i} className="flex items-start gap-1.5">
                {i > 0 && (
                  <svg viewBox="0 0 16 16" aria-hidden className="mt-2.5 size-3 text-faint">
                    <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                )}
                <div className="flex flex-col items-center gap-1">
                  <div className="flex gap-0.5 rounded-lg bg-panel-2 p-1">
                    {g.items.map((it, j) => (
                      <span key={j} className="relative" title={`${data.items?.[it.item] ?? it.item}${it.sold ? ` (${D.sold})` : ""}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={ddragonImg.item(data.version!, it.item)} alt="" width={28} height={28} className={`rounded-md ${it.sold ? "opacity-30 grayscale" : ""}`} />
                        {it.count > 1 && <span className="tabular absolute -bottom-1 -right-1 rounded bg-bg px-0.5 text-[9px] leading-3">{it.count}</span>}
                        {it.sold && <span className="absolute inset-x-0 top-1/2 h-px -rotate-45 bg-loss" />}
                      </span>
                    ))}
                  </div>
                  <span className="tabular text-[10px] text-faint">{fill(D.minShort, { m: g.minute })}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section title={D.skillOrder}>
        {order && (
          <p className="mb-3 flex items-center gap-1.5 text-sm">
            {order.split(">").map((k, i) => (
              <span key={k} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-faint">›</span>}
                <span className="font-semibold" style={{ color: KEY_COLOR[k] }}>
                  {k}
                </span>
              </span>
            ))}
          </p>
        )}
        <ol className="flex flex-wrap gap-1">
          {skills.map((k, i) => (
            <li key={i} className="flex flex-col items-center gap-0.5">
              <span
                className={`flex size-7 items-center justify-center rounded-md text-xs font-semibold ${k === "R" ? "bg-fg text-bg" : "bg-panel-2"}`}
                style={k === "R" ? undefined : { color: KEY_COLOR[k] }}
              >
                {k}
              </span>
              <span className="tabular text-[9px] text-faint">{i + 1}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section title={D.runes}>
        {player.perks.length < 6 || !primary || !secondary ? (
          <p className="text-sm text-faint">{D.noRunes}</p>
        ) : (
          <div className="flex flex-wrap justify-center gap-x-10 gap-y-6">
            <div className="flex flex-col items-center gap-3">
              {primary.slots.map((row, r) => (
                <div key={r} className="flex gap-2">
                  {row.map((id) => (
                    <RuneDot key={id} id={id} big={r === 0} />
                  ))}
                </div>
              ))}
              <p className="text-xs text-muted">{primary.name}</p>
            </div>
            <div className="flex flex-col items-center gap-3">
              {secondary.slots.slice(1).map((row, r) => (
                <div key={r} className="flex gap-2">
                  {row.map((id) => (
                    <RuneDot key={id} id={id} />
                  ))}
                </div>
              ))}
              <p className="text-xs text-muted">{secondary.name}</p>
            </div>
            {player.shards.length === 3 && (
              <div className="flex flex-col items-center gap-3">
                {STAT_SHARD_ROWS.map((row, r) => (
                  <div key={r} className="flex gap-2">
                    {row.map((id, j) => {
                      const src = shardIcon(id);
                      const on = player.shards[r] === id;
                      return src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={j} src={src} alt="" className={`size-6 rounded-full p-0.5 ${on ? "bg-panel-3 ring-1 ring-gold/70" : "opacity-25 grayscale"}`} />
                      ) : null;
                    })}
                  </div>
                ))}
                <p className="text-xs text-muted">{D.shards}</p>
              </div>
            )}
          </div>
        )}
      </Section>
    </div>
  );
}
