import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { parchmentSans } from "../fonts/parchmentType";
import type { AppLocale } from "../i18n/config";
import { resolveUiText } from "../i18n/site-copy";
import { ParchmentModalCard } from "../shell/ParchmentControlSheet";
import { readMemberSession } from "../auth/memberSession";
import {
  clearMemberReadingSyncDebugEvents,
  getMemberReadingSyncDebugEvents,
  isMemberReadingSyncDebugEnabled,
  subscribeMemberReadingSyncDebug,
} from "./memberReadingSyncDebug";
import {
  formatMemberReadingSyncEventTime,
  formatMemberReadingSyncEventLine,
  formatMemberReadingSyncMetaTime,
  zhMemberReadingSyncBlobKeys,
} from "./memberReadingSyncDebugFormat";
import { readMemberReadingSyncMeta } from "./memberReadingSyncApi";
import { flushMemberReadingSyncNow } from "./runMemberReadingSync";

type Props = {
  visible: boolean;
  locale: AppLocale;
  onClose: () => void;
};

export function MemberReadingSyncDetailSheet({ visible, locale, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const debugEnabled = isMemberReadingSyncDebugEnabled();
  const [events, setEvents] = useState(() => getMemberReadingSyncDebugEvents());
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!visible) return;
    void readMemberReadingSyncMeta().then((meta) => setLastSyncedAt(meta.lastSyncedAt));
  }, [visible, events]);

  useEffect(() => {
    if (!debugEnabled) return;
    return subscribeMemberReadingSyncDebug(() => {
      setEvents(getMemberReadingSyncDebugEvents());
    });
  }, [debugEnabled]);

  useEffect(() => {
    if (visible && debugEnabled) {
      setEvents(getMemberReadingSyncDebugEvents());
    }
  }, [visible, debugEnabled]);

  const lastSyncedLabel = formatMemberReadingSyncMetaTime(lastSyncedAt);

  const runSync = () => {
    if (syncing) return;
    setSyncing(true);
    void (async () => {
      try {
        const session = await readMemberSession();
        if (!session?.sessionToken) return;
        await flushMemberReadingSyncNow(session.sessionToken, "manual-debug");
        const meta = await readMemberReadingSyncMeta();
        setLastSyncedAt(meta.lastSyncedAt);
      } finally {
        setSyncing(false);
      }
    })();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={resolveUiText(locale, "关闭", "Close")} />
        <ParchmentModalCard
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, 16),
              marginTop: insets.top + 24,
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.title}>{resolveUiText(locale, "读经同步", "Reading sync")}</Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button">
              <Text style={styles.close}>{resolveUiText(locale, "关闭", "Close")}</Text>
            </Pressable>
          </View>

          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>{resolveUiText(locale, "上次同步", "Last synced")}</Text>
            <Text style={styles.metaValue}>
              {lastSyncedLabel ?? resolveUiText(locale, "尚未同步", "Not synced yet")}
            </Text>
          </View>

          {debugEnabled ? (
            <ScrollView style={styles.logScroll} nestedScrollEnabled showsVerticalScrollIndicator>
              {events.length ? (
                events.map((event, index) => (
                  <View key={`${event.at}:${index}`} style={[styles.logRow, index > 0 && styles.logRowBorder]}>
                    <Text style={styles.logTime}>{formatMemberReadingSyncEventTime(event.at)}</Text>
                    <Text style={styles.logLine}>{formatMemberReadingSyncEventLine(event)}</Text>
                    {event.blobKeys?.length ? (
                      <Text style={styles.logBlobs} numberOfLines={3}>
                        {zhMemberReadingSyncBlobKeys(event.blobKeys) ?? event.blobKeys.join("、")}
                      </Text>
                    ) : null}
                  </View>
                ))
              ) : (
                <Text style={styles.emptyLog}>{resolveUiText(locale, "暂无同步记录", "No sync events yet")}</Text>
              )}
            </ScrollView>
          ) : (
            <Text style={styles.hint}>
              {resolveUiText(
                locale,
                "读经进度会在登录后自动与账号同步。如有异常，可尝试立即同步。",
                "Reading progress syncs to your account while signed in. Tap sync now if something looks wrong.",
              )}
            </Text>
          )}

          <View style={styles.actions}>
            {debugEnabled ? (
              <Pressable
                onPress={() => clearMemberReadingSyncDebugEvents()}
                style={({ pressed }) => [styles.actionBtn, styles.actionBtnSecondary, pressed && styles.pressed]}
              >
                <Text style={styles.actionBtnSecondaryText}>{resolveUiText(locale, "清空记录", "Clear log")}</Text>
              </Pressable>
            ) : null}
            <Pressable
              disabled={syncing}
              onPress={runSync}
              style={({ pressed }) => [styles.actionBtn, styles.actionBtnPrimary, pressed && styles.pressed, syncing && styles.disabled]}
            >
              <Text style={styles.actionBtnPrimaryText}>
                {syncing
                  ? resolveUiText(locale, "同步中…", "Syncing…")
                  : resolveUiText(locale, "立即同步", "Sync now")}
              </Text>
            </Pressable>
          </View>
        </ParchmentModalCard>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(28, 20, 16, 0.42)",
    justifyContent: "flex-end",
  },
  sheet: {
    marginHorizontal: 12,
    marginBottom: 12,
    maxHeight: "78%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(92, 64, 48, 0.12)",
  },
  title: {
    fontSize: 16,
    ...parchmentSans(600),
    color: "#1c1410",
  },
  close: {
    fontSize: 13,
    ...parchmentSans(500),
    color: "rgba(92, 64, 48, 0.72)",
  },
  metaBlock: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(92, 64, 48, 0.08)",
  },
  metaLabel: {
    fontSize: 11,
    ...parchmentSans(500),
    color: "rgba(92, 64, 48, 0.58)",
  },
  metaValue: {
    marginTop: 4,
    fontSize: 14,
    ...parchmentSans(600),
    color: "#3d2e24",
  },
  logScroll: {
    maxHeight: 280,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  logRow: {
    paddingVertical: 8,
  },
  logRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(92, 64, 48, 0.08)",
  },
  logTime: {
    fontSize: 10,
    ...parchmentSans(500),
    color: "rgba(92, 64, 48, 0.52)",
  },
  logLine: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
    ...parchmentSans(500),
    color: "#1c1410",
  },
  logBlobs: {
    marginTop: 2,
    fontSize: 10,
    lineHeight: 14,
    ...parchmentSans(400),
    color: "rgba(92, 64, 48, 0.62)",
  },
  emptyLog: {
    paddingVertical: 16,
    fontSize: 12,
    ...parchmentSans(500),
    color: "rgba(92, 64, 48, 0.58)",
    textAlign: "center",
  },
  hint: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 12,
    lineHeight: 18,
    ...parchmentSans(500),
    color: "rgba(92, 64, 48, 0.68)",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(92, 64, 48, 0.1)",
  },
  actionBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    paddingVertical: 11,
  },
  actionBtnPrimary: {
    backgroundColor: "#3d2e24",
  },
  actionBtnSecondary: {
    backgroundColor: "rgba(92, 64, 48, 0.08)",
  },
  actionBtnPrimaryText: {
    fontSize: 13,
    ...parchmentSans(600),
    color: "#f5efe4",
  },
  actionBtnSecondaryText: {
    fontSize: 13,
    ...parchmentSans(600),
    color: "#5c4030",
  },
  pressed: { opacity: 0.88 },
  disabled: { opacity: 0.55 },
});
