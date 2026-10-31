import { ddragonImg, type StaticData } from "@riftlens/riot";
import Image from "next/image";

type Sz = { size?: number; className?: string };

function Slot({ size = 24, className = "" }: Sz) {
  return <span className={`inline-block rounded bg-panel-2 ${className}`} style={{ width: size, height: size }} />;
}

export function ChampionIcon({ data, championId, size = 32, className = "" }: Sz & { data: StaticData; championId: number }) {
  const c = data.champions[championId];
  if (!c) return <Slot size={size} className={className} />;
  return (
    <Image
      src={ddragonImg.champion(data.version, c.id)}
      alt={c.name}
      title={c.name}
      width={size}
      height={size}
      className={`rounded ${className}`}
    />
  );
}

export function ItemIcon({ data, itemId, size = 24, className = "" }: Sz & { data: StaticData; itemId: number }) {
  const it = data.items[itemId];
  if (!itemId || !it) return <Slot size={size} className={className} />;
  return (
    <Image
      src={ddragonImg.item(data.version, itemId)}
      alt={it.name}
      title={it.name}
      width={size}
      height={size}
      className={`rounded ${className}`}
    />
  );
}

export function SpellIcon({ data, spellId, size = 20, className = "" }: Sz & { data: StaticData; spellId: number }) {
  const s = data.spells[spellId];
  if (!s) return <Slot size={size} className={className} />;
  return (
    <Image
      src={ddragonImg.spell(data.version, s.id)}
      alt={s.name}
      title={s.name}
      width={size}
      height={size}
      className={`rounded ${className}`}
    />
  );
}

export function RuneIcon({ data, runeId, size = 20, className = "" }: Sz & { data: StaticData; runeId: number }) {
  const r = data.runes[runeId];
  if (!r) return <Slot size={size} className={className} />;
  return (
    <Image src={ddragonImg.rune(r.icon)} alt={r.name} title={r.name} width={size} height={size} className={className} />
  );
}
