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
import { getNatureMediaBaseUrl } from "../bible/chapter-audio-url";
import { toAbsoluteUrl } from "../config/askbibleBaseUrl";
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
import {
  HOME_SCENE_THUMB_GAP,
  homeSceneStripContentWidth,
  HomeSceneThumb,
} from "../home/HomeSceneThumb";
import { trackTelemetry } from "../telemetry/client";
import { parchmentSans } from "../fonts/parchmentType";
import { theme } from "../theme";
import { ScenesPageListenShortcuts } from "./ScenesPageListenShortcuts";
import {
  resolveNaturePosterPlaybackModule,
  resolveNaturePosterPlaybackUri,
} from "../media/bundledNatureMedia";
import { useNatureResourcePackSync } from "../media/useNatureResourcePackSync";
import {
  bumpNatureSceneUsage,
  readNatureSceneUsageMap,
  sortNatureScenesByUsage,
  type NatureSceneUsageMap,
} from "../nature/natureSceneUsage";

export function ScenesScreen() {
  const naturePackRev = useNatureResourcePackSync();
  const baseUrl = getNatureMediaBaseUrl();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const sceneStripSwipeExclude = useShellSwipeExcludeHandlers();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<NatureSettingsV2 | null>(null);
  const [activeId, setActiveId] = useState("");
  const [sceneUsageMap, setSceneUsageMap] = useState<NatureSceneUsageMap>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, usage] = await Promise.all([fetchNatureSettings(), readNatureSceneUsageMap()]);
      setSettings(data);
      setSceneUsageMap(usage);
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

  useEffect(() => {
    if (naturePackRev <= 0) return;
    void load();
  }, [naturePackRev, load]);


  const pickScene = useCallback(
    async (id: string) => {
      const usage = await bumpNatureSceneUsage(id);
      setSceneUsageMap(usage);
      await writeNatureActiveSceneId(id);
      setActiveId(id);
      trackTelemetry("scene_view", { scene_id: id });
      router.navigate("/");
    },
    [router],
  );

  const videos = useMemo(
    () => sortNatureScenesByUsage(settings?.videos ?? [], sceneUsageMap),
    [settings, sceneUsageMap],
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
                videos.length > 0
                  ? { minWidth: homeSceneStripContentWidth(videos.length) + 16 }
                  : null,
              ]}
            >
              {videos.map((v) => {
                const selected = v.id === activeId;
                const thumbModule = resolveNaturePosterPlaybackModule(v.id);
                const thumbRemote = v.thumbSrc?.trim() ? toAbsoluteUrl(baseUrl, v.thumbSrc.trim()) : "";
                const thumbUri = resolveNaturePosterPlaybackUri(v.id, thumbRemote) || thumbRemote;
                const label =
                  typeof v.title === "string" ? v.title.trim() : resolveLocalizedField(v.title);
                return (
                  <HomeSceneThumb
                    key={v.id}
                    selected={selected}
                    thumbModule={thumbModule}
                    thumbUri={thumbUri}
                    fallbackLabel={label}
                    onPress={() => void pickScene(v.id)}
                  />
                );
              })}
            </ScrollView>
          </ShellSwipeExclude>
        )}

        <ScenesPageListenShortcuts />
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
  strip: {
    flexDirection: "row",
    direction: "ltr",
    gap: HOME_SCENE_THUMB_GAP,
    paddingVertical: 4,
    paddingRight: 16,
  },
  pressed: { opacity: 0.88 },
});
