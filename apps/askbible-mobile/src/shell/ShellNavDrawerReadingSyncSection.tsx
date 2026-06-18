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

  useEffect(() => {
    void readMemberReadingSyncMeta().then((meta) => setLastSyncedAt(meta.lastSyncedAt));
  }, [events]);

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
    return synced
      ? resolveUiText(locale, `上次 ${synced}`, `Last ${synced}`)
      : resolveUiText(locale, "尚未同步", "Not synced yet");
  }, [debugEnabled, events, lastSyncedAt, locale]);

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
