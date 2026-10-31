import Link from "next/link";
import { SearchForm } from "@/components/search-form";
import { Logo, SiteHeader } from "@/components/site-header";

const FEATURES = [
  { title: "Perfil y rango", text: "Historial, rendimiento por campeón y LP en tiempo real.", ready: true },
  { title: "Rankings", text: "Aspirante, Gran Maestro y Maestro de cada región.", ready: true },
  { title: "Builds y matchups", text: "Objetos, runas y counters por elo y parche.", ready: false },
  { title: "Calculado para ti", text: "Counters ajustados a tu historial y un coach que te compara con el alto elo.", ready: false },
];

export default function Home() {
  return (
    <>
      <SiteHeader search={false} />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-4 pt-20 pb-16 sm:pt-28">
        <div className="scale-150">
          <Logo />
        </div>
        <h1 className="mt-8 text-center text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          Las estadísticas de siempre, <span className="text-accent">calculadas para ti</span>
        </h1>
        <p className="mt-3 text-center text-muted text-balance">
          Builds, matchups, tier lists, rankings y tu perfil en un solo sitio, con estadística honesta: cada winrate con
          su margen de error.
        </p>
        <div className="mt-10 w-full">
          <SearchForm />
          <p className="mt-2 text-center text-xs text-faint">
            Busca por Riot ID, p. ej. <span className="text-muted">Nombre#EUW</span>. Sin #, se usa el tag de la región.
          </p>
        </div>

        <div className="mt-16 grid w-full gap-3 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-line bg-panel p-4">
              <p className="flex items-center gap-2 font-semibold">
                {f.title}
                {!f.ready && <span className="rounded bg-panel-2 px-1.5 py-0.5 text-[10px] uppercase text-faint">pronto</span>}
              </p>
              <p className="mt-1 text-sm text-muted">{f.text}</p>
            </div>
          ))}
        </div>
        <Link href="/rankings/euw" className="mt-8 text-sm text-accent hover:underline">
          Ver ranking de EUW →
        </Link>
      </main>
    </>
  );
}
