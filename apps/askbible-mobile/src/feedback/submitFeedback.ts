import { createMobileSupabaseClient } from "../auth/googleOAuthSession";
import { isSupabaseAuthConfigured } from "../config/supabaseAuth";
import { isNetworkAvailable } from "../network/isNetworkAvailable";

export type SubmitFeedbackInput = {
  type: "idea" | "bug" | "content" | "other";
  message: string;
  email?: string;
  page?: string;
  locale?: string;
};

export type SubmitFeedbackResult = { ok: true; id: string } | { ok: false; error: string };

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** App 直写 Supabase `feedback_submissions`（insert-only RLS）。 */
export async function submitFeedbackToSupabase(input: SubmitFeedbackInput): Promise<SubmitFeedbackResult> {
  const message = input.message.trim();
  if (!message) return { ok: false, error: "empty" };
  if (!isSupabaseAuthConfigured()) return { ok: false, error: "supabase_not_configured" };
  if (!(await isNetworkAvailable())) return { ok: false, error: "network" };

  const supabase = createMobileSupabaseClient();
  if (!supabase) return { ok: false, error: "supabase_not_configured" };

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
  if (error) {
    if (__DEV__) console.warn("[feedback] insert", error.message);
    return { ok: false, error: error.message || "submit_failed" };
  }
  return { ok: true, id };
}
