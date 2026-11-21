"use client";

import type { ContentCorrectionSubmitContext } from "@/lib/content-corrections/types";
import { endpointBase } from "@/lib/endpoints";

const MAX_MESSAGE_CHARS = 800;

export type SubmitContentCorrectionWebResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function submitContentCorrectionWeb(input: {
  context: ContentCorrectionSubmitContext;
  message: string;
  email?: string;
  locale: string;
}): Promise<SubmitContentCorrectionWebResult> {
  const message = input.message.trim();
  if (!message) return { ok: false, error: "empty" };
  if (message.length > MAX_MESSAGE_CHARS) return { ok: false, error: "too_long" };

  const { context } = input;
  try {
    const base = endpointBase("api").replace(/\/+$/, "");
    const res = await fetch(`${base}/v1/corrections`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
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
        platform: "web",
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; id?: string; error?: string };
    if (!res.ok || !data.ok || !data.id) {
      return { ok: false, error: data.error || "submit_failed" };
    }
    return { ok: true, id: data.id };
  } catch {
    return { ok: false, error: "submit_failed" };
  }
}
