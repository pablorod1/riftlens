import { ddragonImg, type ChampionInfo, type ChampionLore, type StaticData } from "@riftlens/riot";
import Image from "next/image";
import { t } from "@/i18n/config";
import type { Dictionary } from "@/i18n/server";

/** Cabecera de la ficha: arte del campeón, nombre, habilidades y las cifras clave (children). */
export function ChampionHero({ champ, data, lore, dict, children }: { champ: ChampionInfo; data: StaticData; lore: ChampionLore | null; dict: Dictionary; children?: React.ReactNode }) {
  const L = dict.lab;
  return (
    <header className="relative isolate mt-4 rounded-3xl border border-line bg-panel">
      <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden rounded-3xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ddragonImg.splash(champ.id)} alt="" className="h-full w-full object-cover object-[70%_20%] opacity-35 sm:object-[center_20%]" />
        <div className="absolute inset-0 bg-gradient-to-r from-panel via-panel/85 to-panel/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-panel via-transparent to-transparent" />
      </div>
      <div className="flex flex-col gap-8 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-5">
          <Image src={ddragonImg.champion(data.version, champ.id)} alt="" width={88} height={88} priority className="rounded-2xl ring-1 ring-line-strong" />
          <div className="min-w-0">
            <h1 className="text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">{champ.name}</h1>
            <p className="mt-1 font-serif text-lg italic text-muted">{champ.title}</p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {champ.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-line-strong bg-panel/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                  {tag}
                </span>
              ))}
              {lore && (
                <span className="ml-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-faint" title={`${L.difficulty}: ${lore.info.difficulty}/10`}>
                  {L.difficulty}
                  <span className="flex gap-0.5">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className={`h-1.5 w-3 rounded-full ${lore.info.difficulty > i * 3.4 ? "bg-accent" : "bg-panel-3"}`} />
                    ))}
                  </span>
                </span>
              )}
            </div>
            {lore && (
              <ul className="mt-4 flex gap-1.5" aria-label={L.abilities}>
                {lore.abilities.map((a) => (
                  <li key={a.key} className="group relative">
                    <span className="relative block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.icon} alt={a.name} width={38} height={38} tabIndex={0} className="rounded-lg ring-1 ring-line-strong outline-none focus-visible:ring-accent" />
                      <span className="absolute -bottom-1 -right-1 rounded bg-bg px-1 text-[9px] font-semibold text-muted ring-1 ring-line">{a.key}</span>
                    </span>
                    {/* Ficha emergente al pasar el ratón o con el foco */}
                    <span
                      role="tooltip"
                      className="pointer-events-none invisible absolute left-0 top-12 z-30 w-72 max-w-[calc(100vw-3rem)] rounded-xl border border-line-strong bg-panel p-3 text-left opacity-0 shadow-2xl shadow-black/60 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium">{a.name}</span>
                        <span className="text-[10px] font-semibold text-faint">{a.key === "P" ? L.passive : a.key}</span>
                      </span>
                      {a.cooldown && <span className="tabular mt-0.5 block text-[10px] text-faint">{t(L.cooldown, { cd: a.cooldown })}</span>}
                      <span className="mt-1.5 line-clamp-6 block text-xs leading-relaxed text-muted">{a.description}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {children}
      </div>
    </header>
  );
}

/** Índice fijo de secciones de la ficha. */
export function SectionNav({ items }: { items: { id: string; label: string }[] }) {
  return (
    <nav className="sticky top-14 z-20 -mx-5 mt-6 border-b border-line bg-bg/80 px-5 backdrop-blur-xl">
      <ul className="no-scrollbar flex gap-1 overflow-x-auto py-2">
        {items.map((i) => (
          <li key={i.id}>
            <a href={`#${i.id}`} className="block shrink-0 rounded-md px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-panel-2 hover:text-fg">
              {i.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
