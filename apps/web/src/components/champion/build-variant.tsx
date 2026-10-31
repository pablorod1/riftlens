import type { BuildEntry, BuildVariant } from "@riftlens/db";
import type { StaticData } from "@riftlens/riot";
import { t } from "@/i18n/config";
import type { Dictionary } from "@/i18n/server";
import { ItemIcon, SpellIcon } from "../icons";
import { RunePage } from "./rune-page";
import { Stat } from "./ui";

const KEY_COLOR: Record<string, string> = { Q: "var(--color-win)", W: "#5fd4c4", E: "#f6a560", R: "var(--color-fg)" };

function Block({ title, children, support, total }: { title: string; children: React.ReactNode; support?: BuildEntry | null; total: number }) {
  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <p className="eyebrow">{title}</p>
        {support && <Stat e={support} total={total} />}
      </div>
      {children}
    </div>
  );
}

/** Una build completa (la más jugada o la de mayor winrate). */
export function BuildVariantView({ v, data, dict, total }: { v: BuildVariant; data: StaticData; dict: Dictionary; total: number }) {
  const C = dict.champ;
  const path = v.skillPath ?? "";
  return (
    <div className="grid gap-x-8 gap-y-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-7">
        {v.skills && (
          <Block title={C.skillPriority} support={v.support.skills} total={total}>
            <div className="flex items-center gap-2">
              {v.skills.split(">").map((k, i) => (
                <span key={k} className="flex items-center gap-2">
                  {i > 0 && <span className="text-faint">›</span>}
                  <span
                    className={`flex size-9 items-center justify-center rounded-lg text-sm font-semibold ${i === 0 ? "bg-fg text-bg" : "border border-line-strong"}`}
                    style={i === 0 ? undefined : { color: KEY_COLOR[k] }}
                  >
                    {k}
                  </span>
                </span>
              ))}
            </div>
          </Block>
        )}
        {path && (
          <Block title={C.skillPath} total={total}>
            <div className="overflow-x-auto">
              <table className="border-separate border-spacing-0.5">
                <tbody>
                  {(["Q", "W", "E", "R"] as const).map((k) => (
                    <tr key={k}>
                      <td className="pr-1.5 text-xs font-semibold" style={{ color: KEY_COLOR[k] }}>
                        {k}
                      </td>
                      {Array.from({ length: 15 }, (_, i) => (
                        <td key={i} className={`size-6 rounded text-center text-[10px] ${path[i] === k ? "bg-panel-3 font-semibold text-fg" : "bg-panel-2/50 text-transparent"}`}>
                          {i + 1}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Block>
        )}
        <div className="grid grid-cols-2 gap-6">
          {v.spells && (
            <Block title={dict.champions.spells} total={total}>
              <div className="flex items-center justify-between gap-3">
                <span className="flex gap-1.5">
                  {v.spells.map((id) => (
                    <SpellIcon key={id} data={data} spellId={id} size={32} className="rounded-lg" />
                  ))}
                </span>
                {v.support.spells && <Stat e={v.support.spells} total={total} />}
              </div>
            </Block>
          )}
          {v.starting.length > 0 && (
            <Block title={C.startingItems} total={total}>
              <div className="flex items-center justify-between gap-3">
                <span className="flex gap-1">
                  {v.starting.map((id, i) => (
                    <ItemIcon key={i} data={data} itemId={id} size={32} className="rounded-lg" />
                  ))}
                </span>
                {v.support.starting && <Stat e={v.support.starting} total={total} />}
              </div>
            </Block>
          )}
        </div>
      </div>

      <div className="space-y-7">
        {v.runes && (
          <Block title={dict.champions.runes} support={v.support.runes} total={total}>
            <RunePage data={data} page={v.runes} />
          </Block>
        )}
      </div>

      {v.core.length > 0 && (
        <div className="lg:col-span-2">
          <div className="grid gap-5 sm:grid-cols-[auto_repeat(3,minmax(0,1fr))]">
            <Block title={C.coreBuild} support={v.support.core} total={total}>
              <div className="flex items-center gap-1.5">
                {v.core.map((id, i) => (
                  <span key={id} className="flex items-center gap-1.5">
                    {i > 0 && (
                      <svg viewBox="0 0 16 16" aria-hidden className="size-3 text-faint">
                        <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    )}
                    <ItemIcon data={data} itemId={id} size={42} className="rounded-lg" />
                  </span>
                ))}
              </div>
            </Block>
            {v.next.map((options, i) =>
              options.length ? (
                <Block key={i} title={t(C.itemN, { n: i + 4 })} total={total}>
                  <ul className="space-y-1.5">
                    {options.map((o) => (
                      <li key={o.item} className="flex items-center gap-2">
                        <ItemIcon data={data} itemId={o.item} size={28} className="rounded-md" />
                        <Stat e={o} align="right" />
                      </li>
                    ))}
                  </ul>
                </Block>
              ) : null,
            )}
          </div>
        </div>
      )}
    </div>
  );
}
