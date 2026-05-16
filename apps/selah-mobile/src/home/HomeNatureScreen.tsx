import { useRouter } from "expo-router";
import { Video, ResizeMode } from "expo-av";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ElementRef } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchNatureSettings } from "../api/fetchNatureSettings";
import { getSelahBaseUrl, toAbsoluteUrl } from "../config/selahBaseUrl";
import { resolveNaturePlayback } from "../nature/resolveNaturePlayback";
import { strings } from "../strings";
import type { NatureSettingsV2, NatureVideoEntry } from "../types/nature";

function displayTitle(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "object" && raw !== null && "zh-CN" in (raw as object)) {
    const o = raw as { "zh-CN"?: string; en?: string };
    return (o["zh-CN"] || o.en || "").trim();
  }
  return "";
}

function orderedSceneVideos(videos: NatureVideoEntry[], activeId: string): NatureVideoEntry[] {
  const active = activeId.trim();
  if (!active) return videos;
  const hit = videos.find((v) => v.id === active);
  if (!hit) return videos;
  return [hit, ...videos.filter((v) => v.id !== active)];
}

export function HomeNatureScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const baseUrl = useMemo(() => getSelahBaseUrl(), []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<NatureSettingsV2 | null>(null);
  const [localActiveId, setLocalActiveId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchNatureSettings();
      setSettings(data);
      setLocalActiveId(data.activeVideoId?.trim() || data.videos[0]?.id || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const playback = useMemo(() => {
    if (!settings) return null;
    return resolveNaturePlayback(
      {
        ...settings,
        activeVideoId: localActiveId || settings.activeVideoId,
      },
      { prefer1080: true },
    );
  }, [settings, localActiveId]);

  const videoUri = playback?.videoSrc ? toAbsoluteUrl(baseUrl, playback.videoSrc) : "";
  const posterUri = playback?.posterSrc ? toAbsoluteUrl(baseUrl, playback.posterSrc) : "";
  const clampedRate = Math.min(2, Math.max(0.5, settings?.playbackRate ?? 1));

  const videoRef = useRef<ElementRef<typeof Video>>(null);

  const currentRow = useMemo(() => {
    if (!settings?.videos.length) return null;
    const id = (localActiveId || settings.activeVideoId).trim();
    return settings.videos.find((v) => v.id === id) ?? settings.videos[0] ?? null;
  }, [settings, localActiveId]);

  const sceneList = useMemo(() => {
    if (!settings?.videos.length) return [];
    return orderedSceneVideos(settings.videos, (localActiveId || settings.activeVideoId).trim());
  }, [settings, localActiveId]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#94a3b8" />
        <Text style={styles.loadingText}>{strings.home.loading}</Text>
        <Text style={styles.apiHint}>{baseUrl}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>{strings.home.loadError}</Text>
        <Text style={styles.errorDetail}>{error}</Text>
        <Pressable onPress={() => void load()} style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.9 }]}>
          <Text style={styles.retryText}>{strings.home.retry}</Text>
        </Pressable>
        <Text style={styles.apiHint}>{baseUrl}</Text>
      </View>
    );
  }

  if (!settings || !playback || !videoUri) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>{strings.nature.emptyTitle}</Text>
        <Text style={styles.emptyBody}>{strings.nature.emptyHint}</Text>
        <Pressable onPress={() => void load()} style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.9 }]}>
          <Text style={styles.retryText}>{strings.home.retry}</Text>
        </Pressable>
      </View>
    );
  }

  const title = displayTitle(currentRow?.title) || strings.nature.scenes;

  const sceneId = (localActiveId || settings.activeVideoId).trim();

  return (
    <View style={styles.root}>
      <Video
        ref={videoRef}
        key={`${sceneId}|${clampedRate}|${videoUri}`}
        source={{ uri: videoUri }}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.COVER}
        isLooping
        isMuted
        shouldPlay
        usePoster={Boolean(posterUri)}
        posterSource={posterUri ? { uri: posterUri } : undefined}
        rate={clampedRate}
        onLoad={() => {
          void videoRef.current?.playAsync().catch(() => {});
        }}
      />

      <View style={[styles.scrimTop, { height: insets.top + 52 }]} pointerEvents="box-none">
        <Pressable
          onPress={() => router.push("/relax")}
          style={({ pressed }) => [styles.relaxPill, { top: insets.top + 6 }, pressed && { opacity: 0.85 }]}
          hitSlop={12}
        >
          <Text style={styles.relaxPillText}>{strings.nav.relax}</Text>
        </Pressable>
      </View>

      <View style={[styles.bottomBand, { paddingBottom: 8 + insets.bottom }]}>
        <Text style={styles.filmTitle} numberOfLines={1}>
          {title}
        </Text>
        <FlatList
          horizontal
          data={sceneList}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sceneRow}
          renderItem={({ item }) => {
            const selected = item.id === sceneId;
            const thumb =
              toAbsoluteUrl(baseUrl, item.previewFrameSrc?.trim() || "") ||
              toAbsoluteUrl(baseUrl, item.thumbSrc?.trim() || "");
            return (
              <Pressable
                onPress={() => setLocalActiveId(item.id)}
                style={[styles.thumbWrap, selected && styles.thumbSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                {thumb ? (
                  <Image source={{ uri: thumb }} style={styles.thumbImg} resizeMode="cover" />
                ) : (
                  <View style={[styles.thumbImg, styles.thumbFallback]}>
                    <Text style={styles.thumbFallbackText}>{displayTitle(item.title).slice(0, 1) || "·"}</Text>
                  </View>
                )}
              </Pressable>
            );
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#020617",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    backgroundColor: "#020617",
  },
  loadingText: {
    marginTop: 14,
    fontSize: 14,
    color: "#94a3b8",
  },
  errorTitle: {
    fontSize: 15,
    color: "#e2e8f0",
    textAlign: "center",
    lineHeight: 22,
  },
  errorDetail: {
    marginTop: 8,
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#f1f5f9",
    textAlign: "center",
  },
  emptyBody: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 22,
    color: "#94a3b8",
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 22,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: "#f1f5f9",
  },
  retryText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  apiHint: {
    marginTop: 16,
    fontSize: 11,
    color: "#475569",
    textAlign: "center",
  },
  scrimTop: {
    ...StyleSheet.absoluteFillObject,
    bottom: undefined,
    backgroundColor: "rgba(2, 6, 23, 0.35)",
  },
  relaxPill: {
    position: "absolute",
    right: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(248, 250, 252, 0.2)",
  },
  relaxPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#f8fafc",
  },
  bottomBand: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 10,
    paddingHorizontal: 12,
    backgroundColor: "rgba(2, 6, 23, 0.45)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(248, 250, 252, 0.08)",
  },
  filmTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(248, 250, 252, 0.92)",
    marginBottom: 8,
    paddingHorizontal: 6,
  },
  sceneRow: {
    gap: 8,
    paddingBottom: 2,
  },
  thumbWrap: {
    width: 56,
    height: 56,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  thumbSelected: {
    borderColor: "#7dd3fc",
  },
  thumbImg: {
    width: "100%",
    height: "100%",
  },
  thumbFallback: {
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbFallbackText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#94a3b8",
  },
});
