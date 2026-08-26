"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { ContentCorrectionEntry } from "@/components/content-correction/ContentCorrectionEntry";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { InfoEditionReaderVariant } from "@/lib/bible/info-edition-v1-publish";
import type { InfoEditionV1PublishedChapter } from "@/lib/bible/info-edition-v1-published-types";
import { fetchStaticInfoEditionChapter } from "@/lib/read/static-info-edition-client";

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
  roleId?: string | null;
  /** 父级已选中该版本时展示并触发加载 */
  isActive: boolean;
  initialPublished?: InfoEditionV1PublishedChapter | null;
  onBack?: () => void;
};

type PanelPhase = "idle" | "loading" | "ready" | "error";

function hasPublishedMarkdown(ch?: InfoEditionV1PublishedChapter | null): boolean {
  return Boolean(ch?.markdown?.trim());
}

function matchesRequestedRole(
  published: InfoEditionV1PublishedChapter | null | undefined,
  roleId: string | null,
): boolean {
  const wanted = roleId?.trim();
  if (!wanted) return true;
  return published?.roleId?.trim() === wanted;
}

/** 读经页：讲解版 / 发现版面板（静态 published JSON，无 API / 无现场生成）。 */
export function ReadChapterInfoEditionBlock({
  variant,
  bookId,
  chapter,
  roleId = null,
  isActive,
  initialPublished = null,
  onBack,
}: Props) {
  const { t } = useLocale();
  const initialReady = hasPublishedMarkdown(initialPublished) && matchesRequestedRole(initialPublished, roleId);
  const [phase, setPhase] = useState<PanelPhase>(initialReady ? "ready" : "idle");
  const [published, setPublished] = useState<InfoEditionV1PublishedChapter | null>(
    initialReady ? initialPublished : null,
  );
  const [err, setErr] = useState<string | null>(null);
  const loadStartedRef = useRef(false);
  const roleSnapshotRef = useRef<string>(roleId?.trim() ?? "");

  const disclaimer =
    variant === "guide"
      ? t("pages.read.guideEditionDisclaimer")
      : t("pages.read.infoEditionDisclaimer");
  const ariaLabel =
    variant === "guide"
      ? t("pages.read.guideEditionAriaLabel")
      : t("pages.read.infoEditionAriaLabel");

  useEffect(() => {
    const nextRole = roleId?.trim() ?? "";
    if (roleSnapshotRef.current === nextRole) return;
    roleSnapshotRef.current = nextRole;
    loadStartedRef.current = false;
    if (hasPublishedMarkdown(initialPublished) && matchesRequestedRole(initialPublished, roleId)) {
      setPublished(initialPublished);
      setPhase("ready");
      setErr(null);
      return;
    }
    setPublished(null);
    setErr(null);
    setPhase("idle");
  }, [initialPublished, roleId]);

  const loadPublished = useCallback(async () => {
    setErr(null);
    setPhase("loading");
    try {
      const next = await fetchStaticInfoEditionChapter(bookId, chapter, variant, { roleId });
      if (next?.markdown?.trim()) {
        setPublished(next);
        setPhase("ready");
        setErr(null);
        return;
      }
      setErr(t("pages.read.infoEditionLoadFailed"));
      setPhase("error");
    } catch {
      setErr(t("pages.read.infoEditionLoadFailed"));
      setPhase("error");
    }
  }, [bookId, chapter, roleId, t, variant]);

  useEffect(() => {
    if (!isActive) return;
    if (phase === "ready") return;
    if (initialReady && initialPublished) {
      setPublished(initialPublished);
      setPhase("ready");
      return;
    }
    if (phase === "error") return;
    if (loadStartedRef.current) return;
    loadStartedRef.current = true;
    void loadPublished();
  }, [initialPublished, initialReady, isActive, loadPublished, phase]);

  if (!isActive) return null;

  const showPanel = phase === "loading" || phase === "ready" || phase === "error";

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
          <header className="read-chapter-info-edition-header">
            <p className="read-chapter-info-edition-disclaimer">{disclaimer}</p>
            <ContentCorrectionEntry
              tone="edition"
              context={{
                scope: variant === "guide" ? "guide_edition" : "info_edition",
                bookId,
                chapter,
                roleId: published?.roleId ?? roleId,
                roleLabel: published?.roleLabel ?? null,
                publishedAt: published?.publishedAt ?? null,
              }}
            />
          </header>

          {phase === "error" && err ? (
            <div className="read-chapter-info-edition-panel read-chapter-info-edition-panel--error">
              <p className="read-chapter-info-edition-error-text">{err}</p>
              <button type="button" onClick={() => void loadPublished()} className="read-chapter-info-edition-retry">
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
              <ReadChapterInfoEditionMarkdown
                content={published.markdown}
                hideKeyScenes={variant === "info"}
              />
              {onBack ? (
                <button
                  type="button"
                  onClick={onBack}
                  className="read-chapter-info-edition-back"
                  aria-label={t("pages.read.postReadingBack")}
                >
                  {t("pages.read.postReadingBack")}
                </button>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
