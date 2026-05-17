import Link from "next/link";
import { cookies } from "next/headers";
import { AdminReaderVerseThemesClient } from "@/components/admin/AdminReaderVerseThemesClient";
import { ADMIN_MAIN_CLASS } from "@/components/admin/admin-layout";
import { LOCALE_COOKIE_NAME, parseLocale, type AppLocale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";

export const metadata = { title: "金句主题" };

export default async function AdminGoldenVerseThemesPage({
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
  const gt = m.admin.goldenVerseThemes;

  return (
    <div className={ADMIN_MAIN_CLASS}>
      <h1 className="text-lg font-medium tracking-tight text-adminFg">{gt.title}</h1>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-adminMuted">{gt.intro}</p>
      <p className="mt-2 text-[13px] text-adminMuted">
        <Link href="/admin/read/verse-repeat-rank" className="font-medium text-adminFg underline underline-offset-2">
          {m.admin.verseRepeatRank.title}
        </Link>
      </p>
      <AdminReaderVerseThemesClient />
    </div>
  );
}
