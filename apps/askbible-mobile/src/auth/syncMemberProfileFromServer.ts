import { getAskBibleBaseUrl, toAbsoluteUrl } from "../config/askbibleBaseUrl";
import { fetchWithTimeout } from "../api/fetchWithTimeout";
import { mapLanguageTagToAppLocale, parseLocale, type AppLocale } from "../i18n/config";
import { setLocale as persistLocale } from "../i18n/locale-store";
import type { MemberUser } from "../auth/memberSession";

type RemoteMemberUser = {
  id?: string;
  email?: string;
  name?: string;
  locale?: string | null;
};

function profileLocaleToAppLocale(raw: string | null | undefined): AppLocale | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  if (trimmed === "en" || trimmed === "zh-CN" || trimmed === "zh-TW") {
    return parseLocale(trimmed);
  }
  return mapLanguageTagToAppLocale(trimmed);
}

export function applyMemberProfileLocale(raw: string | null | undefined): AppLocale | null {
  const next = profileLocaleToAppLocale(raw);
  if (!next) return null;
  void persistLocale(next);
  return next;
}

export function parseRemoteMemberUser(raw: RemoteMemberUser | null | undefined): MemberUser | null {
  if (!raw || typeof raw.id !== "string" || typeof raw.email !== "string") return null;
  return {
    id: raw.id,
    email: raw.email,
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : raw.email,
    locale: typeof raw.locale === "string" ? raw.locale : raw.locale ?? null,
  };
}

/** 登录后从服务端拉取 askbible_profiles，合并 display_name / locale 到本地。 */
export async function pullMemberProfileFromServer(sessionToken: string): Promise<MemberUser | null> {
  const base = getAskBibleBaseUrl();
  try {
    const res = await fetchWithTimeout(toAbsoluteUrl(base, "/api/mobile/auth/session"), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      timeoutMs: 10_000,
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as { user?: RemoteMemberUser | null } | null;
    const user = parseRemoteMemberUser(data?.user);
    if (!user) return null;
    applyMemberProfileLocale(user.locale);
    return user;
  } catch (err) {
    if (__DEV__) {
      console.warn("[syncMemberProfile] fetch failed", base, err);
    }
    return null;
  }
}
