import { ddragonImg, shardIcon, STAT_SHARD_ROWS, type StaticData } from "@riftlens/riot";

/** Página de runas completa: las elegidas resaltadas y el resto atenuadas. */
export function RunePage({ data, page, size = 28 }: { data: StaticData; page: { primaryStyle: number; subStyle: number; perks: number[]; shards: number[] }; size?: number }) {
  const primary = data.runeTrees.find((t) => t.id === page.primaryStyle);
  const secondary = data.runeTrees.find((t) => t.id === page.subStyle);
  const chosen = new Set(page.perks);
  const img = (id: number, big = false, on = chosen.has(id)) => {
    const r = data.runes[id];
    if (!r) return null;
    const s = big ? size + 10 : size;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={id}
        src={ddragonImg.rune(r.icon)}
        alt={r.name}
        title={r.name}
        width={s}
        height={s}
        className={`rounded-full ${on ? "bg-panel-3 ring-1 ring-gold/70" : "opacity-20 grayscale"}`}
      />
    );
  };
  if (!primary || !secondary) return null;
  return (
    <div className="flex flex-wrap justify-center gap-x-8 gap-y-5">
      <div className="flex flex-col items-center gap-2.5">
        {primary.slots.map((row, i) => (
          <div key={i} className="flex gap-1.5">
            {row.map((id) => img(id, i === 0))}
          </div>
        ))}
        <p className="text-[11px] text-muted">{primary.name}</p>
      </div>
      <div className="flex flex-col items-center gap-2.5">
        {secondary.slots.slice(1).map((row, i) => (
          <div key={i} className="flex gap-1.5">
            {row.map((id) => img(id))}
          </div>
        ))}
        <p className="text-[11px] text-muted">{secondary.name}</p>
      </div>
      {page.shards.length === 3 && (
        <div className="flex flex-col items-center gap-2.5">
          {STAT_SHARD_ROWS.map((row, i) => (
            <div key={i} className="flex gap-1.5">
              {row.map((id, j) => {
                const src = shardIcon(id);
                const on = page.shards[i] === id;
                return src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={j} src={src} alt="" width={size - 6} height={size - 6} className={`rounded-full p-0.5 ${on ? "bg-panel-3 ring-1 ring-gold/70" : "opacity-20 grayscale"}`} />
                ) : null;
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
