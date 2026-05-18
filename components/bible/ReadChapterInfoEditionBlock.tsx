"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { InfoEditionReaderVariant } from "@/lib/bible/info-edition-v1-publish";
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
  variant: InfoEditionReaderVariant;
  bookId: string;
  chapter: number;
  /** 父级已选中该版本时展示并触发加载 */
  isActive: boolean;
  initialPublished?: InfoEditionV1PublishedChapter | null;
};

type PanelPhase = "idle" | "loading" | "ready" | "error";

function hasPublishedMarkdown(ch?: InfoEditionV1PublishedChapter | null): boolean {
  return Boolean(ch?.markdown?.trim());
}

function formatInfoEditionError(
  raw: string | undefined,
  t: (key: string, vars?: Record<string, string>) => string,
): string {
  if (!raw?.trim()) return t("pages.read.infoEditionLoadFailed");
  if (/EACCES|permission denied|EPERM|EROFS|不可写|mkdir|Render 提示/i.test(raw)) {
    return raw;
  }
  return raw;
}

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function apiFailureMessage(j: Record<string, unknown>, res: Response): string | undefined {
  if (typeof j.error === "string" && j.error.trim()) return j.error.trim();
  if (j.ok === false && typeof j.message === "string") return j.message.trim();
  if (!res.ok) return `HTTP ${res.status}`;
  if (j.ok === false) return "请求未成功";
  return undefined;
}

function editionQuery(variant: InfoEditionReaderVariant): string {
  return `edition=${encodeURIComponent(variant)}`;
}

/** 读经页：讲解版 / 发现版面板（由父级选择后按需加载） */
export function ReadChapterInfoEditionBlock({
  variant,
  bookId,
  chapter,
  isActive,
  initialPublished = null,
}: Props) {
  const { t } = useLocale();
  const initialReady = hasPublishedMarkdown(initialPublished);
  const [phase, setPhase] = useState<PanelPhase>(initialReady ? "ready" : "idle");
  const [published, setPublished] = useState<InfoEditionV1PublishedChapter | null>(
    initialReady ? initialPublished : null,
  );
  const [err, setErr] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartedRef = useRef<number | null>(null);
  const loadStartedRef = useRef(false);
  const POLL_MAX_MS = 4 * 60 * 1000;

  const sectionKicker =
    variant === "guide"
      ? t("pages.read.guideEditionSectionKicker")
      : t("pages.read.infoEditionSectionKicker");
  const disclaimer =
    variant === "guide"
      ? t("pages.read.guideEditionDisclaimer")
      : t("pages.read.infoEditionDisclaimer");
  const ariaLabel =
    variant === "guide"
      ? t("pages.read.guideEditionAriaLabel")
      : t("pages.read.infoEditionAriaLabel");
  const defaultRole =
    variant === "guide"
      ? t("pages.read.guideEditionDefaultRole")
      : t("pages.read.infoEditionDefaultRole");

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPoll(), [stopPoll]);

  const applyCachePayload = useCallback(
    (j: Record<string, unknown>, options?: { openOnFailed?: boolean }): boolean => {
      const status = typeof j.status === "string" ? j.status : "";
      if (status === "ready" && j.published && typeof j.published === "object") {
        setPublished(j.published as InfoEditionV1PublishedChapter);
        setPhase("ready");
        setErr(null);
        return true;
      }
      if (status === "failed") {
        const e = formatInfoEditionError(
          typeof j.error === "string" ? j.error : undefined,
          t,
        );
        setErr(e);
        setPhase("error");
        if (options?.openOnFailed ?? true) {
          /* panel visible while active */
        }
        return true;
      }
      return false;
    },
    [t],
  );

  const pollUntilReady = useCallback(() => {
    stopPoll();
    pollStartedRef.current = Date.now();
    pollRef.current = setInterval(() => {
      if (pollStartedRef.current && Date.now() - pollStartedRef.current > POLL_MAX_MS) {
        stopPoll();
        setErr(t("pages.read.infoEditionTimeout"));
        setPhase("error");
        return;
      }
      void (async () => {
        const res = await fetch(
          `/api/read/info-edition-v1?bookId=${encodeURIComponent(bookId)}&chapter=${chapter}&${editionQuery(variant)}`,
          { cache: "no-store" },
        );
        const j = await parseJson(res);
        if (!res.ok || j.ok === false) {
          stopPoll();
          setErr(formatInfoEditionError(apiFailureMessage(j, res), t));
          setPhase("error");
          return;
        }
        if (applyCachePayload(j)) stopPoll();
      })();
    }, 2000);
  }, [applyCachePayload, bookId, chapter, stopPoll, t, variant]);

  const loadOrGenerate = useCallback(async () => {
    setErr(null);
    setPhase("loading");

    const qs = `bookId=${encodeURIComponent(bookId)}&chapter=${chapter}&${editionQuery(variant)}`;
    const getRes = await fetch(`/api/read/info-edition-v1?${qs}`, { cache: "no-store" });
    const getJ = await parseJson(getRes);
    if (!getRes.ok || getJ.ok === false) {
      setErr(formatInfoEditionError(apiFailureMessage(getJ, getRes), t));
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
      body: JSON.stringify({ bookId, chapter, edition: variant }),
    });
    const postJ = await parseJson(postRes);
    if (!postRes.ok || postJ.ok === false) {
      stopPoll();
      if (postJ.status === "failed" && applyCachePayload(postJ)) return;
      setErr(formatInfoEditionError(apiFailureMessage(postJ, postRes), t));
      setPhase("error");
      return;
    }
    if (applyCachePayload(postJ)) return;
    if (postJ.status === "pending") {
      pollUntilReady();
      return;
    }
    setErr(formatInfoEditionError(apiFailureMessage(postJ, postRes), t));
    setPhase("error");
  }, [applyCachePayload, bookId, chapter, pollUntilReady, stopPoll, t, variant]);

  useEffect(() => {
    if (!isActive) {
      stopPoll();
      return;
    }
    if (phase === "ready") return;
    if (initialReady && initialPublished) {
      setPublished(initialPublished);
      setPhase("ready");
      return;
    }
    if (phase === "loading") {
      pollUntilReady();
      return;
    }
    if (phase === "error") return;
    if (loadStartedRef.current) return;
    loadStartedRef.current = true;
    void loadOrGenerate();
  }, [initialPublished, initialReady, isActive, loadOrGenerate, phase, pollUntilReady, stopPoll]);

  if (!isActive) return null;

  const showPanel = phase === "loading" || phase === "ready" || phase === "error";
  const roleLabel = published?.roleLabel ?? defaultRole;

  return (
    <section className="read-chapter-info-edition-invite" aria-label={ariaLabel}>
      {showPanel ? (
        <section
          className={
            variant === "guide"
              ? "read-chapter-info-edition read-chapter-info-edition--discover"
              : "read-chapter-info-edition read-chapter-info-edition--consult"
          }
        >
          <div className="read-chapter-info-edition-divider" role="separator" aria-hidden>
            <span className="read-chapter-info-edition-divider-line" />
            <span className="read-chapter-info-edition-divider-label">
              <span className="read-chapter-info-edition-kicker">{sectionKicker}</span>
              <span className="read-chapter-info-edition-role">{roleLabel}</span>
            </span>
            <span className="read-chapter-info-edition-divider-line" />
          </div>

          <p className="read-chapter-info-edition-disclaimer">{disclaimer}</p>

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
