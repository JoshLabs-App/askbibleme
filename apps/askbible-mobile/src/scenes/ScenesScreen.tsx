import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  InteractionManager,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchNatureSettings, getBundledNatureSettings } from "../api/fetchNatureSettings";
import { getNatureRemoteAssetBaseUrl } from "../bible/chapter-audio-url";
import { toAbsoluteUrl } from "../config/askbibleBaseUrl";
import { isMobileBundledOnly, isMobileOfflineFirst } from "../config/mobileBundledOnly";
import { resolveLocalizedField, t } from "../i18n/site-copy";
import {
  readNatureActiveSceneId,
  writeNatureActiveSceneId,
} from "../nature/natureActiveScenePrefs";
import { ShellSwipeExclude } from "../shell/ShellSwipeExclude";
import type { NatureSettingsV2 } from "../types/nature";
import { HOME_SCENE_THUMB_GAP, HomeSceneThumb } from "../home/HomeSceneThumb";
import { trackTelemetry } from "../telemetry/client";
import { parchmentSans } from "../fonts/parchmentType";
import { theme } from "../theme";
import { ScenesPageListenShortcuts } from "./ScenesPageListenShortcuts";
import {
  resolveNaturePosterPlaybackModule,
  resolveNaturePosterPlaybackUri,
} from "../media/bundledNatureMedia";
import { ensureNatureResourcePackSync } from "../media/natureResourcePackSync";
import { useNatureResourcePackSync } from "../media/useNatureResourcePackSync";
import {
  bumpNatureSceneUsage,
  readNatureSceneUsageMap,
  sortNatureScenesByUsage,
  type NatureSceneUsageMap,
} from "../nature/natureSceneUsage";
import type { NatureVideoEntry } from "../types/nature";

const bundledOnBoot = getBundledNatureSettings();

function sceneTitleText(raw: NatureVideoEntry["title"]): string {
  if (typeof raw === "string") return raw.trim();
  if (raw && typeof raw === "object") {
    return resolveLocalizedField(raw as { "zh-CN"?: string; en?: string });
  }
  return "";
}

export function ScenesScreen() {
  const scenesFocused = useIsFocused();
  const naturePackRev = useNatureResourcePackSync(scenesFocused);
  const baseUrl = getNatureRemoteAssetBaseUrl();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(() => bundledOnBoot.videos.length === 0);
  const [settings, setSettings] = useState<NatureSettingsV2 | null>(() =>
    bundledOnBoot.videos.length > 0 ? bundledOnBoot : null,
  );
  const [activeId, setActiveId] = useState(() => {
    if (bundledOnBoot.videos.length === 0) return "";
    return bundledOnBoot.activeVideoId?.trim() || bundledOnBoot.videos[0]?.id || "";
  });
  const [sceneUsageMap, setSceneUsageMap] = useState<NatureSceneUsageMap>({});

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const [data, usage, stored] = await Promise.all([
        fetchNatureSettings(),
        readNatureSceneUsageMap(),
        readNatureActiveSceneId(),
      ]);
      setSettings(data);
      setSceneUsageMap(usage);
      const id = stored || data.activeVideoId?.trim() || data.videos[0]?.id || "";
      setActiveId(id);
    } catch {
      if (!opts?.silent) setSettings(null);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let prefsTask: { cancel: () => void } | null = null;
    let loadTask: { cancel: () => void } | null = null;

    if (bundledOnBoot.videos.length > 0) {
      setLoading(false);
      prefsTask = InteractionManager.runAfterInteractions(() => {
        void readNatureSceneUsageMap().then(setSceneUsageMap);
        void readNatureActiveSceneId().then((stored) => {
          const id = stored || bundledOnBoot.activeVideoId?.trim() || bundledOnBoot.videos[0]?.id || "";
          if (id) setActiveId(id);
        });
      });
    }
    if (isMobileBundledOnly()) {
      return () => prefsTask?.cancel();
    }
    const silent = bundledOnBoot.videos.length > 0;
    const runLoad = () => void load({ silent });
    if (isMobileOfflineFirst()) {
      runLoad();
      return () => prefsTask?.cancel();
    }
    loadTask = InteractionManager.runAfterInteractions(runLoad);
    return () => {
      prefsTask?.cancel();
      loadTask?.cancel();
    };
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        void ensureNatureResourcePackSync();
      });
      return () => task.cancel();
    }, []),
  );

  useEffect(() => {
    if (naturePackRev <= 0) return;
    const task = InteractionManager.runAfterInteractions(() => {
      void load({ silent: true });
    });
    return () => task.cancel();
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
            <View style={styles.strip}>
              {videos.map((v) => {
                const selected = v.id === activeId;
                const thumbModule = resolveNaturePosterPlaybackModule(v.id);
                const posterRel = (v.previewFrameSrc || v.thumbSrc)?.trim() ?? "";
                const thumbRemote = posterRel ? toAbsoluteUrl(baseUrl, posterRel) : "";
                const thumbUri = resolveNaturePosterPlaybackUri(v.id, thumbRemote) || thumbRemote;
                const label = sceneTitleText(v.title);
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
            </View>
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
    flexWrap: "wrap",
    justifyContent: "center",
    gap: HOME_SCENE_THUMB_GAP,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  pressed: { opacity: 0.88 },
});
