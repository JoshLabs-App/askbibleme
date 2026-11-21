"use client";

import { endpointBase } from "@/lib/endpoints";

export type SubmitFeedbackWebInput = {
  type: "idea" | "bug" | "content" | "other";
  message: string;
  email?: string;
  page?: string;
  locale?: string;
};

export type SubmitFeedbackWebResult = { ok: true; id: string } | { ok: false; error: string };

export async function submitFeedbackWeb(
  input: SubmitFeedbackWebInput,
): Promise<SubmitFeedbackWebResult> {
  const message = input.message.trim();
  if (!message) return { ok: false, error: "empty" };

  try {
    const base = endpointBase("api").replace(/\/+$/, "");
    const res = await fetch(`${base}/v1/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        type: input.type,
        message,
        email: input.email?.trim() || null,
        page: input.page?.trim() || null,
        locale: input.locale?.trim() || null,
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
