"use client";

import { useMemo, useState } from "react";
import { useAskbibleUser } from "@/components/auth/AskbibleUserProvider";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { ContentCorrectionSubmitContext } from "@/lib/content-corrections/types";
import { PARCHMENT_CONTROL_SURFACE_CLASS } from "@/lib/shell/parchment-control-surface";

const MAX_MESSAGE_CHARS = 800;
const fieldClassName = PARCHMENT_CONTROL_SURFACE_CLASS.field;

type Props = {
  context: ContentCorrectionSubmitContext;
  /** explore 文章区 / 读后讲解·发现版 */
  tone?: "explore" | "edition";
};

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string }
  | { kind: "success"; id: string };

export function ContentCorrectionEntry({ context, tone = "explore" }: Props) {
  const { user } = useAskbibleUser();
  const { locale, t } = useLocale();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [state, setState] = useState<SubmitState>({ kind: "idle" });

  const remain = Math.max(0, MAX_MESSAGE_CHARS - message.length);

  const contextHint = useMemo(() => {
    if (context.scope === "explore_article") {
      return context.articleTitle || context.articleSlug || "";
    }
    const edition =
      context.scope === "guide_edition"
        ? t("pages.read.postReadingEditionGuideTag")
        : t("pages.read.postReadingEditionInfoTag");
    const loc =
      context.bookId && context.chapter != null ? `${context.bookId} ${context.chapter}` : "";
    return [edition, loc].filter(Boolean).join(" · ");
  }, [context, t]);

  function closeSheet() {
    setOpen(false);
    if (state.kind === "success") {
      setMessage("");
      setEmail(user?.email ?? "");
      setState({ kind: "idle" });
    }
  }

  function openSheet() {
    setState({ kind: "idle" });
    setOpen(true);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state.kind === "submitting") return;
    if (!message.trim()) {
      setState({ kind: "error", message: t("contentCorrection.errorEmpty") });
      return;
    }
    setState({ kind: "submitting" });
    try {
      const res = await fetch("/api/content-corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: context.scope,
          message: message.trim(),
          email: email.trim() || undefined,
          locale,
          articleSlug: context.articleSlug,
          articleTitle: context.articleTitle,
          bookId: context.bookId,
          chapter: context.chapter,
          roleId: context.roleId ?? undefined,
          roleLabel: context.roleLabel ?? undefined,
          publishedAt: context.publishedAt ?? undefined,
          platform: "web",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        setState({
          kind: "error",
          message: data.error || t("contentCorrection.errorSubmit"),
        });
        return;
      }
      setState({ kind: "success", id: data.id });
    } catch {
      setState({ kind: "error", message: t("contentCorrection.errorNetwork") });
    }
  }

  const linkClassName =
    tone === "edition"
      ? "read-chapter-content-correction-link"
      : "explore-content-correction-link";

  return (
    <>
      <button type="button" className={linkClassName} onClick={openSheet}>
        {t("contentCorrection.link")}
      </button>

      {open ? (
        <div className={PARCHMENT_CONTROL_SURFACE_CLASS.modalBackdrop} role="presentation">
          <button
            type="button"
            className={PARCHMENT_CONTROL_SURFACE_CLASS.modalDim}
            aria-label={t("contentCorrection.cancel")}
            onClick={state.kind === "submitting" ? undefined : closeSheet}
            disabled={state.kind === "submitting"}
          />
          <div
            className={`${PARCHMENT_CONTROL_SURFACE_CLASS.sheet} mx-auto w-full max-w-lg px-4 py-4 sm:max-w-md`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="content-correction-title"
          >
            <h2
              id="content-correction-title"
              className="text-center font-serif text-[17px] font-medium text-[#2b1d15] dark:text-[#f4ebe1]"
            >
              {t("contentCorrection.sheetTitle")}
            </h2>
            <p className="mt-2 text-center text-[13px] leading-relaxed text-[rgba(43,29,21,0.72)] dark:text-[rgba(244,235,225,0.72)]">
              {t("contentCorrection.sheetIntro")}
            </p>
            {contextHint ? (
              <p className="mt-2 text-center text-[12px] text-[rgba(77,53,34,0.55)] dark:text-[rgba(244,235,225,0.5)]">
                {contextHint}
              </p>
            ) : null}

            {state.kind === "success" ? (
              <p className="mt-4 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-900 dark:text-emerald-100">
                {t("contentCorrection.success")}
              </p>
            ) : (
              <form className="mt-4 space-y-3" onSubmit={onSubmit}>
                <label className="block">
                  <span className={PARCHMENT_CONTROL_SURFACE_CLASS.label}>
                    {t("contentCorrection.messageLabel")}
                  </span>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={MAX_MESSAGE_CHARS}
                    required
                    rows={5}
                    placeholder={t("contentCorrection.messagePlaceholder")}
                    className={`${fieldClassName} resize-y leading-relaxed`}
                    disabled={state.kind === "submitting"}
                  />
                  <p className="mt-1 text-right text-[11px] text-[rgba(77,53,34,0.55)]">
                    {t("contentCorrection.remainingChars", { count: String(remain) })}
                  </p>
                </label>

                <label className="block">
                  <span className={PARCHMENT_CONTROL_SURFACE_CLASS.label}>
                    {t("contentCorrection.emailLabel")}
                  </span>
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("contentCorrection.emailPlaceholder")}
                    className={fieldClassName}
                    disabled={state.kind === "submitting"}
                  />
                </label>

                {state.kind === "error" ? (
                  <p className="rounded-lg border border-red-300/40 bg-red-500/10 px-3 py-2 text-[13px] text-red-900 dark:text-red-100">
                    {state.message}
                  </p>
                ) : null}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    className={`${PARCHMENT_CONTROL_SURFACE_CLASS.btn} flex-1`}
                    onClick={closeSheet}
                    disabled={state.kind === "submitting"}
                  >
                    {t("contentCorrection.cancel")}
                  </button>
                  <button
                    type="submit"
                    className={`${PARCHMENT_CONTROL_SURFACE_CLASS.btnPrimary} flex-1`}
                    disabled={state.kind === "submitting"}
                  >
                    {state.kind === "submitting"
                      ? t("contentCorrection.submitting")
                      : t("contentCorrection.submit")}
                  </button>
                </div>
              </form>
            )}

            {state.kind === "success" ? (
              <button
                type="button"
                className={`${PARCHMENT_CONTROL_SURFACE_CLASS.btnPrimary} mt-4 w-full`}
                onClick={closeSheet}
              >
                {t("contentCorrection.done")}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
