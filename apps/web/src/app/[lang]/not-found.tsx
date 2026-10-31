import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/server";

export default async function NotFound() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center px-5 py-28 text-center">
        <p className="font-serif text-7xl italic text-faint">404</p>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">{dict.notFound.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{dict.notFound.text}</p>
        <Link href={localePath(locale, "/")} className="mt-8 rounded-lg border border-line px-4 py-2 text-sm transition-colors hover:border-line-strong">
          {dict.notFound.back}
        </Link>
      </main>
    </>
  );
}
