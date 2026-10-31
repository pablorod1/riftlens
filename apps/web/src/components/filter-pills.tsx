import Image from "next/image";
import Link from "next/link";

export interface Pill {
  key: string;
  label: string;
  href: string;
  icon?: string | null;
  active: boolean;
}

/** Grupo de enlaces tipo segmento (filtros en la URL: se pueden compartir y funcionan sin JS). */
export function FilterPills({ pills, label }: { pills: Pill[]; label: string }) {
  return (
    <nav aria-label={label} className="no-scrollbar flex gap-0.5 overflow-x-auto rounded-xl border border-line bg-panel p-1">
      {pills.map((p) => (
        <Link
          key={p.key}
          href={p.href}
          aria-current={p.active ? "page" : undefined}
          scroll={false}
          className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            p.active ? "bg-panel-3 text-fg" : "text-faint hover:text-muted"
          }`}
        >
          {p.icon && <Image src={p.icon} alt="" width={14} height={14} className={p.active ? "opacity-90" : "opacity-50"} />}
          {p.label}
        </Link>
      ))}
    </nav>
  );
}
