import { InfoEditionV1AdminClient } from "@/components/admin/InfoEditionV1AdminClient";
import { ADMIN_MAIN_CLASS } from "@/components/admin/admin-layout";
import { cookies } from "next/headers";
import { LOCALE_COOKIE_NAME, parseLocale, type AppLocale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";

export const metadata = { title: "内容生成系统" };

export default async function AdminInfoEditionV1Page({
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
  const ie = m.admin.infoEditionV1;

  return (
    <div className={ADMIN_MAIN_CLASS}>
      <h1 className="text-[15px] font-medium tracking-tight text-adminFg">{ie.title}</h1>
      <InfoEditionV1AdminClient />
    </div>
  );
}
