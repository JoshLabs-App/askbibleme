"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";

export type SubmitFeedbackWebInput = {
  type: "idea" | "bug" | "content" | "other";
  message: string;
  email?: string;
  page?: string;
  locale?: string;
};

export type SubmitFeedbackWebResult = { ok: true; id: string } | { ok: false; error: string };

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function submitFeedbackWeb(input: SubmitFeedbackWebInput): Promise<SubmitFeedbackWebResult> {
  const message = input.message.trim();
  if (!message) return { ok: false, error: "empty" };
  if (!isSupabaseAuthConfigured()) return { ok: false, error: "not_configured" };
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return { ok: false, error: "not_configured" };

  const id = newId();
  const { error } = await supabase.from("feedback_submissions").insert({
    id,
    created_at: new Date().toISOString(),
    type: input.type,
    message,
    email: input.email?.trim() || null,
    page: input.page?.trim() || null,
    locale: input.locale?.trim() || null,
  });
  if (error) return { ok: false, error: error.message || "submit_failed" };
  return { ok: true, id };
}
