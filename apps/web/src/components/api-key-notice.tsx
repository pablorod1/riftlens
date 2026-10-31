import Link from "next/link";
import { getDictionary } from "@/i18n/server";

function Notice({ tone, title, text, children }: { tone: string; title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <span className="mx-auto mb-5 block size-2 rounded-full" style={{ background: tone, boxShadow: `0 0 24px 4px ${tone}` }} />
      <p className="text-lg font-semibold tracking-tight">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
      {children}
    </div>
  );
}

export async function ApiKeyNotice() {
  const dict = await getDictionary();
  return <Notice tone="var(--color-loss)" title={dict.apiKey.title} text={dict.apiKey.text} />;
}

/** Riot ha devuelto 429 o la espera superaría el máximo: mejor avisar que cargar sin fin. */
export async function RateLimitNotice({ retryHref }: { retryHref: string }) {
  const dict = await getDictionary();
  return (
    <Notice tone="var(--color-gold)" title={dict.rateLimited.title} text={dict.rateLimited.text}>
      <Link href={retryHref} className="mt-6 inline-block rounded-lg border border-line px-4 py-2 text-sm transition-colors hover:border-line-strong">
        {dict.rateLimited.retry}
      </Link>
    </Notice>
  );
}
