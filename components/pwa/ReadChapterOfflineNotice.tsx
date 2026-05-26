"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { isLikelyOffline, readReadChapterOfflineSnapshot } from "@/lib/pwa/read-chapter-offline-cache";

type Props = {
  translationId: string;
  bookId: string;
  chapter: number;
};

/**
 * 离线且当前章有本机快照时，显示一句安静提示（不替代正文；正文仍来自 SSR 或 SW 页面缓存）。
 */
export function ReadChapterOfflineNotice({ translationId, bookId, chapter }: Props) {
  const { t } = useLocale();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isLikelyOffline()) {
      setShow(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const snap = await readReadChapterOfflineSnapshot(translationId, bookId, chapter);
      if (!cancelled) setShow(Boolean(snap?.verses?.length));
    })();
    const onOnline = () => setShow(false);
    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
    };
  }, [translationId, bookId, chapter]);

  if (!show) return null;

  return (
    <p className="mb-3 text-[12px] leading-relaxed text-amber-950/55 dark:text-stone-400" role="status">
      {t("chrome.offlineReadHint")}
    </p>
  );
}
