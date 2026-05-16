import Link from "next/link";
import { cookies } from "next/headers";
import { AdminGoldenVersesThemePickerClient } from "@/components/admin/AdminGoldenVersesThemePickerClient";
import { ADMIN_MAIN_CLASS } from "@/components/admin/admin-layout";
import { LOCALE_COOKIE_NAME, parseLocale, type AppLocale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";

export const metadata = { title: "金句" };

export default async function AdminGoldenVersesPage({
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
  const g = m.admin.goldenVerses;

  return (
    <div className={ADMIN_MAIN_CLASS}>
      <h1 className="text-lg font-medium tracking-tight text-adminFg">{g.title}</h1>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-adminMuted">{g.intro}</p>
      <p className="mt-3 max-w-2xl text-[12px] leading-relaxed text-adminMuted">
        <Link href="/admin/read/golden-verse-themes" className="font-medium text-adminFg underline underline-offset-2">
          {g.openThemesPage}
        </Link>
        {g.themesLinkSuffix}
      </p>
      <p className="mt-2 max-w-2xl whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-adminMuted">
        {g.fileLines}
      </p>
      <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-adminMuted">{g.randomNote}</p>

      <AdminGoldenVersesThemePickerClient />
    </div>
  );
}
