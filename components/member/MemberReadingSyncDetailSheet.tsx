"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { AppLocale } from "@/lib/i18n/config";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";
import { formatMemberReadingSyncMetaTime } from "@/lib/member-reading-sync/client/member-reading-sync-meta-format";
import {
  MEMBER_READING_SYNC_META_UPDATED_EVENT,
  readMemberReadingSyncMetaWeb,
  runMemberReadingSyncWeb,
  type MemberReadingSyncOutcome,
} from "@/lib/member-reading-sync/client/run-member-reading-sync-web";

type Props = {
  open: boolean;
  onClose: () => void;
};

function uiText(locale: AppLocale, zh: string, en: string): string {
  if (locale === "en") return en;
  if (locale === "zh-TW") return toZhTwText(zh);
  return zh;
}

function outcomeMessage(locale: AppLocale, outcome: MemberReadingSyncOutcome): string | null {
  if (outcome === "ok") return null;
  if (outcome === "offline") return uiText(locale, "当前离线", "Offline");
  if (outcome === "unauthorized") return uiText(locale, "请先登录", "Sign in required");
  return uiText(locale, "同步未完成", "Sync incomplete");
}

/** 读经同步详情（对齐 App `MemberReadingSyncDetailSheet`）。 */
export function MemberReadingSyncDetailSheet({ open, onClose }: Props) {
  const { locale } = useLocale();
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const refreshMeta = useCallback(async () => {
    const meta = await readMemberReadingSyncMetaWeb();
    setLastSyncedAt(meta.lastSyncedAt);
  }, []);

  useEffect(() => {
    if (!open) return;
    void refreshMeta();
    setSyncError(null);
  }, [open, refreshMeta]);

  useEffect(() => {
    if (!open) return;
    const onMetaUpdated = () => {
      void refreshMeta();
    };
    window.addEventListener(MEMBER_READING_SYNC_META_UPDATED_EVENT, onMetaUpdated);
    return () => window.removeEventListener(MEMBER_READING_SYNC_META_UPDATED_EVENT, onMetaUpdated);
  }, [open, refreshMeta]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const runSync = () => {
    if (syncing) return;
    setSyncing(true);
    setSyncError(null);
    void (async () => {
      try {
        const outcome = await runMemberReadingSyncWeb("manual-debug");
        const meta = await readMemberReadingSyncMetaWeb();
        setLastSyncedAt(meta.lastSyncedAt);
        const message = outcomeMessage(locale, outcome);
        if (message) setSyncError(message);
      } finally {
        setSyncing(false);
      }
    })();
  };

  if (!open) return null;

  const lastSyncedLabel = formatMemberReadingSyncMetaTime(lastSyncedAt, locale);

  return (
    <div className="member-reading-sync-sheet-backdrop" role="presentation" onClick={onClose}>
      <div
        className="member-reading-sync-sheet-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-reading-sync-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="member-reading-sync-sheet-header">
          <h2 id="member-reading-sync-sheet-title" className="member-reading-sync-sheet-title">
            {uiText(locale, "读经同步", "Reading sync")}
          </h2>
          <button type="button" className="member-reading-sync-sheet-close" onClick={onClose}>
            {uiText(locale, "关闭", "Close")}
          </button>
        </header>

        <div className="member-reading-sync-sheet-meta">
          <p className="member-reading-sync-sheet-meta-label">
            {uiText(locale, "上次同步", "Last synced")}
          </p>
          <p className="member-reading-sync-sheet-meta-value">
            {lastSyncedLabel ?? uiText(locale, "尚未同步", "Not synced yet")}
          </p>
          {syncError ? <p className="member-reading-sync-sheet-meta-error">{syncError}</p> : null}
        </div>

        <p className="member-reading-sync-sheet-hint">
          {uiText(
            locale,
            "读经进度会在登录后自动与账号同步。如有异常，可尝试立即同步。",
            "Reading progress syncs to your account while signed in. Tap sync now if something looks wrong.",
          )}
        </p>

        <div className="member-reading-sync-sheet-actions">
          <button
            type="button"
            className="member-reading-sync-sheet-btn member-reading-sync-sheet-btn--primary"
            disabled={syncing}
            onClick={runSync}
          >
            {syncing
              ? uiText(locale, "同步中…", "Syncing…")
              : uiText(locale, "立即同步", "Sync now")}
          </button>
        </div>
      </div>
    </div>
  );
}
