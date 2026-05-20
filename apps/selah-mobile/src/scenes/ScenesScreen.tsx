import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchNatureSettings } from "../api/fetchNatureSettings";
import { getAskBibleBaseUrl, toAbsoluteUrl } from "../config/askbibleBaseUrl";
import { resolveLocalizedField, t } from "../i18n/site-copy";
import {
  readNatureActiveSceneId,
  writeNatureActiveSceneId,
} from "../nature/natureActiveScenePrefs";
import {
  ShellSwipeExclude,
  useShellSwipeExcludeHandlers,
} from "../shell/ShellSwipeExclude";
import type { NatureSettingsV2 } from "../types/nature";
import { HOME_SCENE_THUMB_GAP, HOME_SCENE_THUMB_SIZE, HomeSceneThumb } from "../home/HomeSceneThumb";
import { trackTelemetry } from "../telemetry/client";
import { parchmentSans } from "../fonts/parchmentType";
import { theme } from "../theme";

export function ScenesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const sceneStripSwipeExclude = useShellSwipeExcludeHandlers();
  const baseUrl = getAskBibleBaseUrl();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<NatureSettingsV2 | null>(null);
  const [activeId, setActiveId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchNatureSettings();
      setSettings(data);
      const stored = await readNatureActiveSceneId();
      const id = stored || data.activeVideoId?.trim() || data.videos[0]?.id || "";
      setActiveId(id);
    } catch {
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pickScene = useCallback(
    async (id: string) => {
      await writeNatureActiveSceneId(id);
      setActiveId(id);
      trackTelemetry("scene_view", { scene_id: id });
      router.navigate("/");
    },
    [router],
  );

  const videos = settings?.videos ?? [];
  const stripWidth = useMemo(
    () =>
      videos.length > 0
        ? videos.length * (HOME_SCENE_THUMB_SIZE + HOME_SCENE_THUMB_GAP) - HOME_SCENE_THUMB_GAP
        : 0,
    [videos.length],
  );

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: 16 + insets.top, paddingBottom: 100 + insets.bottom },
        ]}
      >
        {router.canGoBack() ? (
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <MaterialIcons name="arrow-back" size={22} color={theme.sand} />
          </Pressable>
        ) : null}
        <Text style={styles.title}>{t("scenesPage.title")}</Text>
        <Text style={styles.sub}>{t("scenesPage.subtitle")}</Text>

        {loading ? (
          <ActivityIndicator color={theme.sand} style={{ marginTop: 32 }} />
        ) : !videos.length ? (
          <Text style={styles.empty}>{t("scenesPage.emptyInline")}</Text>
        ) : (
          <ShellSwipeExclude style={styles.stripWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              alwaysBounceHorizontal
              directionalLockEnabled
              nestedScrollEnabled
              onTouchStart={sceneStripSwipeExclude.onTouchStart}
              onScrollBeginDrag={sceneStripSwipeExclude.onScrollBeginDrag}
              contentContainerStyle={[
                styles.strip,
                stripWidth > 0 ? { width: stripWidth } : null,
              ]}
            >
              {videos.map((v) => {
                const selected = v.id === activeId;
                const thumb = toAbsoluteUrl(
                  baseUrl,
                  v.previewFrameSrc?.trim() || v.thumbSrc?.trim() || "",
                );
                const label =
                  typeof v.title === "string" ? v.title.trim() : resolveLocalizedField(v.title);
                return (
                  <HomeSceneThumb
                    key={v.id}
                    selected={selected}
                    thumbUri={thumb || null}
                    fallbackLabel={label}
                    onPress={() => void pickScene(v.id)}
                  />
                );
              })}
            </ScrollView>
          </ShellSwipeExclude>
        )}

        <View style={styles.shortcuts}>
          <Pressable
            onPress={() => router.push("/relax")}
            style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}
          >
            <MaterialIcons name="spa" size={22} color={theme.ink} />
            <Text style={styles.shortcutText}>{t("nav.relax")}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.canvas },
  scroll: { paddingHorizontal: 20, maxWidth: 520, width: "100%", alignSelf: "center" },
  back: { alignSelf: "flex-start", marginBottom: 4, paddingVertical: 6 },
  title: { fontSize: 22, ...parchmentSans(600), color: theme.ink, textAlign: "center" },
  sub: { marginTop: 10, fontSize: 14, lineHeight: 22, color: theme.muted, textAlign: "center" },
  empty: { marginTop: 28, fontSize: 14, color: theme.muted, textAlign: "center" },
  stripWrap: { marginTop: 24, alignSelf: "stretch" },
  strip: { flexDirection: "row", gap: HOME_SCENE_THUMB_GAP, paddingVertical: 4 },
  shortcuts: {
    marginTop: 36,
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
    paddingTop: 20,
  },
  shortcut: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: theme.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
  },
  shortcutText: { fontSize: 14, ...parchmentSans(600), color: theme.ink },
  pressed: { opacity: 0.88 },
});
