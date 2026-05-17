import Link from "next/link";
import { cookies } from "next/headers";
import { AdminVerseRepeatRankClient } from "@/components/admin/AdminVerseRepeatRankClient";
import { ADMIN_MAIN_CLASS } from "@/components/admin/admin-layout";
import { LOCALE_COOKIE_NAME, parseLocale, type AppLocale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";

export const metadata = { title: "经节重复排行" };

export default async function AdminVerseRepeatRankPage({
  searchParams,
}: {
  searchParams?: Promise<{ locale?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const fromQuery = typeof sp.locale === "string" ? sp.locale : null;
  const cookieStore = await cookies();
  const locale: AppLocale =
    fromQuery === "en" || fromQuery === "zh-CN" ? fromQuery : parseLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  const m = getMessages(locale);
  const v = m.admin.verseRepeatRank;

  return (
    <div className={ADMIN_MAIN_CLASS}>
      <p className="text-[12px] text-adminMuted">
        <Link href="/admin/read/golden-verse-themes" className="underline underline-offset-2">
          {m.admin.goldenVerseThemes.title}
        </Link>
      </p>
      <h1 className="mt-2 text-lg font-medium tracking-tight text-adminFg">{v.title}</h1>
      <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-adminMuted">{v.intro}</p>
      <AdminVerseRepeatRankClient />
    </div>
  );
}
