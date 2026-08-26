import { Platform } from "react-native";
import { createMobileSupabaseClient } from "../auth/googleOAuthSession";
import { isSupabaseAuthConfigured } from "../config/supabaseAuth";
import type { AppLocale } from "../i18n/config";
import { isNetworkAvailable } from "../network/isNetworkAvailable";
import { getMobileAppVersionLabel } from "../shell/mobileAppVersion";
import type { ContentCorrectionContext } from "./types";

const MAX_MESSAGE_CHARS = 800;

export type SubmitContentCorrectionInput = {
  context: ContentCorrectionContext;
  message: string;
  email?: string;
  locale: AppLocale;
};

export type SubmitContentCorrectionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `cc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** App 直写 Supabase `content_corrections`（insert-only RLS）。 */
export async function submitContentCorrection(
  input: SubmitContentCorrectionInput,
): Promise<SubmitContentCorrectionResult> {
  const message = input.message.trim();
  if (!message) return { ok: false, error: "empty" };
  if (message.length > MAX_MESSAGE_CHARS) return { ok: false, error: "too_long" };
  if (!isSupabaseAuthConfigured()) return { ok: false, error: "offline" };
  if (!(await isNetworkAvailable())) return { ok: false, error: "offline" };

  const supabase = createMobileSupabaseClient();
  if (!supabase) return { ok: false, error: "offline" };

  const { context } = input;
  const id = newId();
  const { error } = await supabase.from("content_corrections").insert({
    id,
    created_at: new Date().toISOString(),
    scope: context.scope,
    message,
    email: input.email?.trim() || null,
    locale: input.locale,
    article_slug: context.articleSlug ?? null,
    article_title: context.articleTitle ?? null,
    book_id: context.bookId ?? null,
    chapter: typeof context.chapter === "number" ? context.chapter : null,
    role_id: context.roleId ?? null,
    role_label: context.roleLabel ?? null,
    published_at: context.publishedAt ?? null,
    platform: Platform.OS,
    app_version: getMobileAppVersionLabel(),
  });
  if (error) {
    if (__DEV__) console.warn("[contentCorrection] insert", error.message);
    return { ok: false, error: error.message || "submit_failed" };
  }
  return { ok: true, id };
}
