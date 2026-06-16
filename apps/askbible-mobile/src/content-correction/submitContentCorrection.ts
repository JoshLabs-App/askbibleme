import { Platform } from "react-native";
import { getAskBibleBaseUrl, toAbsoluteUrl } from "../config/askbibleBaseUrl";
import { isMobileOfflineFirst } from "../config/mobileBundledOnly";
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

export async function submitContentCorrection(
  input: SubmitContentCorrectionInput,
): Promise<SubmitContentCorrectionResult> {
  const message = input.message.trim();
  if (!message) return { ok: false, error: "empty" };
  if (message.length > MAX_MESSAGE_CHARS) return { ok: false, error: "too_long" };

  if (isMobileOfflineFirst()) return { ok: false, error: "offline" };
  if (!(await isNetworkAvailable())) return { ok: false, error: "offline" };

  const submitUrl = toAbsoluteUrl(getAskBibleBaseUrl(), "/api/content-corrections");
  const { context } = input;

  try {
    const res = await fetch(submitUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope: context.scope,
        message,
        email: input.email?.trim() || undefined,
        locale: input.locale,
        articleSlug: context.articleSlug,
        articleTitle: context.articleTitle,
        bookId: context.bookId,
        chapter: context.chapter,
        roleId: context.roleId ?? undefined,
        roleLabel: context.roleLabel ?? undefined,
        publishedAt: context.publishedAt ?? undefined,
        platform: Platform.OS,
        appVersion: getMobileAppVersionLabel(),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
    if (!res.ok || !data.id) {
      return { ok: false, error: data.error || "submit_failed" };
    }
    return { ok: true, id: data.id };
  } catch {
    return { ok: false, error: "network" };
  }
}
