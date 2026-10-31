import { getDictionary } from "@/i18n/server";

export async function ApiKeyNotice() {
  const dict = await getDictionary();
  return (
    <div className="rounded-xl border border-loss/40 bg-loss-bg p-5 text-sm">
      <p className="font-semibold text-loss">{dict.apiKey.title}</p>
      <p className="mt-1 text-muted">{dict.apiKey.text}</p>
    </div>
  );
}
