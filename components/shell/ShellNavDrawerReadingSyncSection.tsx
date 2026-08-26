"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MemberReadingSyncDetailSheet } from "@/components/member/MemberReadingSyncDetailSheet";
import { useAskbibleUser } from "@/components/auth/AskbibleUserProvider";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { AppLocale } from "@/lib/i18n/config";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";
import { formatMemberReadingSyncMetaTime } from "@/lib/member-reading-sync/client/member-reading-sync-meta-format";
import {
  MEMBER_READING_SYNC_META_UPDATED_EVENT,
  readMemberReadingSyncMetaWeb,
} from "@/lib/member-reading-sync/client/run-member-reading-sync-web";

function uiText(locale: AppLocale, zh: string, en: string): string {
  if (locale === "en") return en;
  if (locale === "zh-TW") return toZhTwText(zh);
  return zh;
}

/** 抽屉「读经同步」行 + 详情弹层（对齐 App `ShellNavDrawerReadingSyncSection`）。 */
export function ShellNavDrawerReadingSyncSection() {
  const { locale } = useLocale();
  const { user } = useAskbibleUser();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const refreshMeta = useCallback(async () => {
    const meta = await readMemberReadingSyncMetaWeb();
    setLastSyncedAt(meta.lastSyncedAt);
  }, []);

  useEffect(() => {
    if (!user) return;
    void refreshMeta();
  }, [user, refreshMeta, sheetOpen]);

  useEffect(() => {
    if (!user) return;
    const onMetaUpdated = () => {
      void refreshMeta();
    };
    window.addEventListener(MEMBER_READING_SYNC_META_UPDATED_EVENT, onMetaUpdated);
    return () => window.removeEventListener(MEMBER_READING_SYNC_META_UPDATED_EVENT, onMetaUpdated);
  }, [user, refreshMeta]);

  const detail = useMemo(() => {
    const synced = formatMemberReadingSyncMetaTime(lastSyncedAt, locale);
    if (synced) {
      return locale === "en" ? `Last ${synced}` : uiText(locale, `上次 ${synced}`, `Last ${synced}`);
    }
    return uiText(locale, "尚未同步", "Not synced yet");
  }, [lastSyncedAt, locale]);

  if (!user) return null;

  return (
    <>
      <div className="h-1" aria-hidden />
      <button
        type="button"
        className="shell-nav-drawer-row shell-nav-drawer-row-stack w-full"
        onClick={() => setSheetOpen(true)}
      >
        <span className="shell-nav-drawer-row-text">{uiText(locale, "读经同步", "Reading sync")}</span>
        <span className="shell-nav-drawer-row-detail">{detail}</span>
      </button>
      <MemberReadingSyncDetailSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}
