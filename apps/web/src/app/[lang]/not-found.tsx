import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/server";

export default async function NotFound() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-xl flex-1 px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">{dict.notFound.title}</h1>
        <p className="mt-2 text-muted">{dict.notFound.text}</p>
        <Link href={localePath(locale, "/")} className="mt-6 inline-block text-accent hover:underline">
          {dict.notFound.back}
        </Link>
      </main>
    </>
  );
}
