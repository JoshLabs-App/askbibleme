import { InfoEditionV3AdminClient } from "@/components/admin/InfoEditionV3AdminClient";
import { ADMIN_MAIN_CLASS } from "@/components/admin/admin-layout";
import { cookies } from "next/headers";
import { LOCALE_COOKIE_NAME, parseLocale, type AppLocale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";

export const metadata = { title: "V3 找错对比" };

export default async function AdminInfoEditionV3Page({
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

  return (
    <div className={ADMIN_MAIN_CLASS}>
      <h1 className="text-[15px] font-medium tracking-tight text-adminFg">{m.admin.infoEditionV3.title}</h1>
      <InfoEditionV3AdminClient />
    </div>
  );
}
