import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-xl flex-1 px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">No encontrado</h1>
        <p className="mt-2 text-muted">No existe ningún invocador o página con esa dirección. Revisa el Riot ID y la región.</p>
        <Link href="/" className="mt-6 inline-block text-accent hover:underline">
          Volver al inicio
        </Link>
      </main>
    </>
  );
}
