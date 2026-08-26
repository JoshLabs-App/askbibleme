import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import type { AppLocale } from "../i18n/config";
import { resolveUiText } from "../i18n/site-copy";
import { MemberReadingSyncDetailSheet } from "../member-sync/MemberReadingSyncDetailSheet";
import {
  getMemberReadingSyncDebugEvents,
  isMemberReadingSyncDebugEnabled,
  subscribeMemberReadingSyncDebug,
} from "../member-sync/memberReadingSyncDebug";
import {
  formatMemberReadingSyncMetaTime,
  summarizeMemberReadingSyncEvents,
} from "../member-sync/memberReadingSyncDebugFormat";
import { readMemberReadingSyncMeta } from "../member-sync/memberReadingSyncApi";
import { ShellNavDrawerMenuRow } from "./ShellNavDrawerMenuRow";
import { shellNavDrawerStyles as styles } from "./shellNavDrawerStyles";

type Props = {
  locale: AppLocale;
};

export function ShellNavDrawerReadingSyncSection({ locale }: Props) {
  const debugEnabled = isMemberReadingSyncDebugEnabled();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [events, setEvents] = useState(() => getMemberReadingSyncDebugEvents());
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    void readMemberReadingSyncMeta().then((meta) => {
      setLastSyncedAt(meta.lastSyncedAt);
      setLastError(meta.lastError ?? null);
    });
  }, [events, sheetOpen]);

  useEffect(() => {
    if (!debugEnabled) return;
    return subscribeMemberReadingSyncDebug(() => {
      setEvents(getMemberReadingSyncDebugEvents());
    });
  }, [debugEnabled]);

  const detail = useMemo(() => {
    if (debugEnabled) {
      return summarizeMemberReadingSyncEvents(events);
    }
    const synced = formatMemberReadingSyncMetaTime(lastSyncedAt);
    if (synced) return resolveUiText(locale, `上次 ${synced}`, `Last ${synced}`);
    if (lastError) return resolveUiText(locale, "同步未完成", "Sync incomplete");
    return resolveUiText(locale, "尚未同步", "Not synced yet");
  }, [debugEnabled, events, lastSyncedAt, lastError, locale]);

  return (
    <>
      <View style={styles.compactGap} />
      <ShellNavDrawerMenuRow
        label={resolveUiText(locale, "读经同步", "Reading sync")}
        detail={detail}
        onPress={() => setSheetOpen(true)}
      />
      <MemberReadingSyncDetailSheet
        visible={sheetOpen}
        locale={locale}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
}
