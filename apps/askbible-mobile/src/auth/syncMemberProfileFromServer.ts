import { mapLanguageTagToAppLocale, parseLocale, type AppLocale } from "../i18n/config";
import { setLocale as persistLocale } from "../i18n/locale-store";
import type { MemberUser } from "../auth/memberSession";
import { pullMemberProfileFromSupabase } from "./supabaseMemberAuth";

type RemoteMemberUser = {
  id?: string;
  email?: string;
  name?: string;
  locale?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
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
  const createdAt =
    typeof raw.createdAt === "string" && raw.createdAt.trim()
      ? raw.createdAt.trim()
      : typeof raw.created_at === "string" && raw.created_at.trim()
        ? raw.created_at.trim()
        : null;
  return {
    id: raw.id,
    email: raw.email,
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : raw.email,
    locale: typeof raw.locale === "string" ? raw.locale : raw.locale ?? null,
    createdAt,
  };
}

/** 登录后拉取 askbible_profiles（Supabase 直连，不经 askbible.me）。 */
export async function pullMemberProfileFromServer(sessionToken: string): Promise<MemberUser | null> {
  const fromSupabase = await pullMemberProfileFromSupabase(sessionToken);
  if (!fromSupabase) return null;
  applyMemberProfileLocale(fromSupabase.locale);
  return fromSupabase;
}
