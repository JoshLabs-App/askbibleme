"use client";

import type { ContentCorrectionSubmitContext } from "@/lib/content-corrections/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";

const MAX_MESSAGE_CHARS = 800;

export type SubmitContentCorrectionWebResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `cc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function submitContentCorrectionWeb(input: {
  context: ContentCorrectionSubmitContext;
  message: string;
  email?: string;
  locale: string;
}): Promise<SubmitContentCorrectionWebResult> {
  const message = input.message.trim();
  if (!message) return { ok: false, error: "empty" };
  if (message.length > MAX_MESSAGE_CHARS) return { ok: false, error: "too_long" };
  if (!isSupabaseAuthConfigured()) return { ok: false, error: "not_configured" };
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return { ok: false, error: "not_configured" };

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
    platform: "web",
    app_version: null,
  });
  if (error) return { ok: false, error: error.message || "submit_failed" };
  return { ok: true, id };
}
