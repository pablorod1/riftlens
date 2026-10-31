import { redirect } from "next/navigation";
import { localePath } from "@/i18n/config";
import { getLocale } from "@/i18n/server";

export default async function RankingsIndex() {
  redirect(localePath(await getLocale(), "/rankings/euw"));
}
