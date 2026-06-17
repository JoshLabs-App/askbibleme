import { useMemo, useState } from "react";
import { useLocale } from "../i18n/LocaleProvider";
import { readParchmentTheme as c } from "../read/readParchmentTheme";
import { submitContentCorrection } from "./submitContentCorrection";
import { MAX_CONTENT_CORRECTION_MESSAGE_CHARS } from "./ContentCorrectionEntryStyles";
import type { ContentCorrectionContext } from "./types";

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; code: string }
  | { kind: "success"; id: string };

export function useContentCorrectionEntry(context: ContentCorrectionContext, tone: "explore" | "edition") {
  const { locale, t } = useLocale();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>({ kind: "idle" });

  const remain = Math.max(0, MAX_CONTENT_CORRECTION_MESSAGE_CHARS - message.length);
  const linkColor = tone === "edition" ? c.muted : c.faint;

  const contextHint = useMemo(() => {
    if (context.scope === "explore_article") {
      return context.articleTitle || context.articleSlug || "";
    }
    const edition =
      context.scope === "guide_edition"
        ? t("pages.read.postReadingEditionGuideTag")
        : t("pages.read.postReadingEditionInfoTag");
    const loc =
      context.bookId && context.chapter != null
        ? `${context.bookId} ${context.chapter}`
        : "";
    return [edition, loc].filter(Boolean).join(" · ");
  }, [context, t]);

  function closeSheet() {
    setOpen(false);
    if (submitState.kind === "success") {
      setMessage("");
      setEmail("");
      setSubmitState({ kind: "idle" });
    }
  }

  function openSheet() {
    setSubmitState({ kind: "idle" });
    setOpen(true);
  }

  async function onSubmit() {
    if (submitState.kind === "submitting") return;
    if (!message.trim()) {
      setSubmitState({ kind: "error", code: "empty" });
      return;
    }
    setSubmitState({ kind: "submitting" });
    const result = await submitContentCorrection({
      context,
      message,
      email,
      locale,
    });
    if (!result.ok) {
      setSubmitState({ kind: "error", code: result.error });
      return;
    }
    setSubmitState({ kind: "success", id: result.id });
  }

  function errorText(code: string): string {
    if (code === "empty") return t("contentCorrection.errorEmpty");
    if (code === "offline" || code === "network") return t("contentCorrection.errorNetwork");
    if (code !== "submit_failed" && code !== "too_long") return code;
    return t("contentCorrection.errorSubmit");
  }

  return {
    open,
    message,
    setMessage,
    email,
    setEmail,
    submitState,
    remain,
    linkColor,
    contextHint,
    closeSheet,
    openSheet,
    onSubmit,
    errorText,
    t,
  };
}
