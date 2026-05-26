import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import {
  inferAppLocaleFromAcceptLanguage,
  LOCALE_COOKIE_NAME,
  parseLocale,
  type AppLocale,
} from "@/lib/i18n/config";

/**
 * 请求级语言判定：优先尊重已存 cookie；首次访问再回退到 Accept-Language。
 */
export function resolveRequestLocale(
  cookieStore: ReadonlyRequestCookies,
  acceptLanguage: string | null | undefined,
): AppLocale {
  const cookieRaw = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  if (cookieRaw) return parseLocale(cookieRaw);
  return inferAppLocaleFromAcceptLanguage(acceptLanguage);
}
