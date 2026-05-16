"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { InfoEditionV1PublishedChapter } from "@/lib/bible/info-edition-v1-published-types";

const ReadChapterInfoEditionMarkdown = dynamic(
  () =>
    import("@/components/bible/ReadChapterInfoEditionMarkdown").then(
      (mod) => mod.ReadChapterInfoEditionMarkdown,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="read-chapter-info-edition-panel-skeleton" aria-hidden />
    ),
  },
);

type Props = {
  bookId: string;
  chapter: number;
};

type PanelPhase = "idle" | "loading" | "ready" | "error";

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** 读经页：默认不加载；点击「查看相关信息」后生成或展示缓存 */
export function ReadChapterInfoEditionBlock({ bookId, chapter }: Props) {
  const { t } = useLocale();
  const [phase, setPhase] = useState<PanelPhase>("idle");
  const [open, setOpen] = useState(false);
  const [published, setPublished] = useState<InfoEditionV1PublishedChapter | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPoll(), [stopPoll]);

  const applyCachePayload = useCallback((j: Record<string, unknown>): boolean => {
    const status = typeof j.status === "string" ? j.status : "";
    if (status === "ready" && j.published && typeof j.published === "object") {
      setPublished(j.published as InfoEditionV1PublishedChapter);
      setPhase("ready");
      setOpen(true);
      setErr(null);
      return true;
    }
    if (status === "failed") {
      const e = typeof j.error === "string" ? j.error : t("pages.read.infoEditionLoadFailed");
      setErr(e);
      setPhase("error");
      setOpen(true);
      return true;
    }
    return status !== "pending";
  }, [t]);

  const pollUntilReady = useCallback(() => {
    stopPoll();
    pollRef.current = setInterval(() => {
      void (async () => {
        const res = await fetch(
          `/api/read/info-edition-v1?bookId=${encodeURIComponent(bookId)}&chapter=${chapter}`,
          { cache: "no-store" },
        );
        const j = await parseJson(res);
        if (!res.ok) {
          stopPoll();
          setErr(typeof j.error === "string" ? j.error : t("pages.read.infoEditionLoadFailed"));
          setPhase("error");
          return;
        }
        if (applyCachePayload(j)) stopPoll();
      })();
    }, 2000);
  }, [applyCachePayload, bookId, chapter, stopPoll, t]);

  const loadOrGenerate = useCallback(async () => {
    setErr(null);
    setPhase("loading");
    setOpen(true);

    const qs = `bookId=${encodeURIComponent(bookId)}&chapter=${chapter}`;
    const getRes = await fetch(`/api/read/info-edition-v1?${qs}`, { cache: "no-store" });
    const getJ = await parseJson(getRes);
    if (!getRes.ok) {
      setErr(typeof getJ.error === "string" ? getJ.error : t("pages.read.infoEditionLoadFailed"));
      setPhase("error");
      return;
    }
    if (applyCachePayload(getJ)) return;
    if (getJ.status === "pending") {
      pollUntilReady();
      return;
    }

    const postRes = await fetch(`/api/read/info-edition-v1`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId, chapter }),
    });
    const postJ = await parseJson(postRes);
    if (!postRes.ok) {
      setErr(typeof postJ.error === "string" ? postJ.error : t("pages.read.infoEditionLoadFailed"));
      setPhase("error");
      return;
    }
    if (applyCachePayload(postJ)) return;
    if (postJ.status === "pending") {
      pollUntilReady();
      return;
    }
    setErr(t("pages.read.infoEditionLoadFailed"));
    setPhase("error");
  }, [applyCachePayload, bookId, chapter, pollUntilReady, t]);

  const onPrimaryClick = () => {
    if (phase === "ready" && published) {
      setOpen((v) => !v);
      return;
    }
    if (phase === "loading") return;
    void loadOrGenerate();
  };

  const showPanel = open && (phase === "loading" || phase === "ready" || phase === "error");
  const roleLabel = published?.roleLabel ?? t("pages.read.infoEditionDefaultRole");

  return (
    <section className="read-chapter-info-edition-invite" aria-label={t("pages.read.infoEditionAriaLabel")}>
      <div className="read-chapter-info-edition-invite-row">
        <button
          type="button"
          onClick={onPrimaryClick}
          disabled={phase === "loading"}
          className="read-chapter-info-edition-trigger"
          aria-expanded={showPanel}
        >
          {phase === "loading"
            ? t("pages.read.infoEditionGenerating")
            : phase === "ready"
              ? open
                ? t("pages.read.infoEditionHide")
                : t("pages.read.infoEditionShow")
              : t("pages.read.viewRelatedInfo")}
        </button>
        {phase === "idle" ? (
          <p className="read-chapter-info-edition-invite-hint">{t("pages.read.infoEditionInviteHint")}</p>
        ) : null}
      </div>

      {showPanel ? (
        <section className="read-chapter-info-edition">
          <div className="read-chapter-info-edition-divider" role="separator" aria-hidden>
            <span className="read-chapter-info-edition-divider-line" />
            <span className="read-chapter-info-edition-divider-label">
              <span className="read-chapter-info-edition-kicker">{t("pages.read.infoEditionSectionKicker")}</span>
              <span className="read-chapter-info-edition-role">{roleLabel}</span>
            </span>
            <span className="read-chapter-info-edition-divider-line" />
          </div>

          <p className="read-chapter-info-edition-disclaimer">{t("pages.read.infoEditionDisclaimer")}</p>

          {phase === "error" && err ? (
            <div className="read-chapter-info-edition-panel read-chapter-info-edition-panel--error">
              <p className="read-chapter-info-edition-error-text">{err}</p>
              <button type="button" onClick={() => void loadOrGenerate()} className="read-chapter-info-edition-retry">
                {t("pages.read.infoEditionRetry")}
              </button>
            </div>
          ) : null}

          {phase === "loading" ? (
            <div className="read-chapter-info-edition-panel">
              <div className="read-chapter-info-edition-panel-skeleton" aria-hidden />
              <p className="read-chapter-info-edition-loading-text">{t("pages.read.infoEditionGenerating")}</p>
            </div>
          ) : null}

          {phase === "ready" && published ? (
            <div className="read-chapter-info-edition-panel">
              <ReadChapterInfoEditionMarkdown content={published.markdown} />
            </div>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
