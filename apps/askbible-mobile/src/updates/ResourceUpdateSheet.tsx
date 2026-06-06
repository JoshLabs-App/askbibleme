import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import type { AppLocale } from "../i18n/config";
import {
  applyMobileResourceUpdates,
  readMobileResourceUpdateState,
  subscribeMobileResourceUpdate,
  type MobileResourceUpdateItem,
} from "./mobileResourceUpdate";

type Props = {
  visible: boolean;
  zh: boolean;
  locale: AppLocale;
  items: MobileResourceUpdateItem[];
  onClose: () => void;
  onComplete: (failedCount: number) => void;
  downloadMusicUpdate?: () => Promise<boolean>;
};

function itemLabel(item: MobileResourceUpdateItem, zh: boolean): string {
  const base = zh ? item.labelZh : item.labelEn;
  if (item.kind === "scripture" && item.reason === "missing") {
    return zh ? `${base}（新译本）` : `${base} (new)`;
  }
  if (item.kind === "scripture" && item.reason === "outdated") {
    return zh ? `${base}（更新）` : `${base} (update)`;
  }
  return base || item.id;
}

export function ResourceUpdateSheet({
  visible,
  zh,
  items,
  onClose,
  onComplete,
  downloadMusicUpdate,
}: Props) {
  const [updateState, setUpdateState] = useState(() => readMobileResourceUpdateState());
  const [started, setStarted] = useState(false);

  useEffect(() => {
    return subscribeMobileResourceUpdate(() => {
      setUpdateState(readMobileResourceUpdateState());
    });
  }, []);

  useEffect(() => {
    if (!visible) {
      setStarted(false);
    }
  }, [visible]);

  const downloading = updateState.phase === "downloading";
  const done = updateState.phase === "done";
  const errored = updateState.phase === "error";

  const summary = useMemo(() => {
    if (downloading) {
      return zh
        ? `正在下载 ${updateState.overallPercent}%`
        : `Downloading ${updateState.overallPercent}%`;
    }
    if (done) return zh ? "更新完成" : "Update complete";
    if (errored) return zh ? "部分未完成" : "Partially complete";
    return zh ? `${items.length} 项可更新` : `${items.length} updates available`;
  }, [downloading, done, errored, items.length, updateState.overallPercent, zh]);

  const onStart = () => {
    if (started || downloading) return;
    setStarted(true);
    void (async () => {
      const result = await applyMobileResourceUpdates(items, { downloadMusicUpdate });
      onComplete(result.failed.length);
    })();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={downloading ? undefined : onClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>{zh ? "资源更新" : "Resource updates"}</Text>
          <Text style={styles.summary}>{summary}</Text>

          {downloading ? (
            <View style={styles.progressBlock}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${updateState.overallPercent}%` }]} />
              </View>
              {updateState.currentLabel ? (
                <Text style={styles.progressDetail} numberOfLines={2}>
                  {updateState.currentLabel}
                </Text>
              ) : null}
              <ActivityIndicator size="small" color="rgba(120, 75, 30, 0.9)" />
            </View>
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {items.map((item) => (
                <Text key={`${item.kind}:${item.id}`} style={styles.listItem}>
                  · {itemLabel(item, zh)}
                </Text>
              ))}
            </ScrollView>
          )}

          {updateState.error ? (
            <Text style={styles.errorText} numberOfLines={3}>
              {updateState.error}
            </Text>
          ) : null}

          <View style={styles.actions}>
            {!downloading && !done ? (
              <>
                <Pressable
                  onPress={onClose}
                  style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.btnPressed]}
                >
                  <Text style={styles.btnGhostText}>{zh ? "稍后" : "Later"}</Text>
                </Pressable>
                <Pressable
                  onPress={onStart}
                  style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.btnPressed]}
                >
                  <Text style={styles.btnPrimaryText}>{zh ? "全部下载" : "Download all"}</Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                onPress={onClose}
                disabled={downloading}
                style={({ pressed }) => [
                  styles.btn,
                  styles.btnPrimary,
                  styles.btnFull,
                  downloading && styles.btnDisabled,
                  pressed && !downloading && styles.btnPressed,
                ]}
              >
                <Text style={styles.btnPrimaryText}>
                  {downloading ? (zh ? "下载中…" : "Downloading…") : zh ? "完成" : "Done"}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  sheet: {
    borderRadius: 14,
    backgroundColor: "rgba(255, 248, 235, 0.98)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(120, 53, 15, 0.22)",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    maxHeight: "72%",
  },
  title: {
    fontSize: 17,
    color: "rgba(55, 53, 47, 0.92)",
    ...parchmentSans(700),
    marginBottom: 6,
  },
  summary: {
    fontSize: 13,
    color: "rgba(55, 53, 47, 0.72)",
    marginBottom: 12,
  },
  list: {
    maxHeight: 220,
    marginBottom: 8,
  },
  listContent: {
    gap: 6,
  },
  listItem: {
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(55, 53, 47, 0.82)",
  },
  progressBlock: {
    gap: 8,
    marginBottom: 12,
    alignItems: "stretch",
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(120, 53, 15, 0.12)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "rgba(255, 177, 1, 0.85)",
  },
  progressDetail: {
    fontSize: 12,
    color: "rgba(120, 95, 60, 0.9)",
  },
  errorText: {
    fontSize: 12,
    color: "rgba(180, 60, 40, 0.92)",
    marginBottom: 8,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  btn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  btnFull: {
    flex: 1,
  },
  btnPrimary: {
    backgroundColor: "rgba(255, 177, 1, 0.28)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 177, 1, 0.55)",
  },
  btnGhost: {
    backgroundColor: "rgba(255, 248, 235, 0.5)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(120, 53, 15, 0.18)",
  },
  btnPressed: {
    opacity: 0.82,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnPrimaryText: {
    fontSize: 14,
    color: "rgba(120, 75, 30, 0.96)",
    ...parchmentSans(600),
  },
  btnGhostText: {
    fontSize: 14,
    color: "rgba(55, 53, 47, 0.78)",
    ...parchmentSans(600),
  },
});
