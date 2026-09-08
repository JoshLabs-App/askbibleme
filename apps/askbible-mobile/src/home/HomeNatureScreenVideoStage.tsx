import { useSyncExternalStore } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import {
  isIosMusicBackgroundMinimal,
  subscribeIosMusicBackgroundMinimal,
} from "../audio/iosMusicBackgroundQuarantine";
import { t } from "../i18n/site-copy";
import { FullBleedCoverVideo } from "./FullBleedCoverVideo";
import type { NatureCoverPlayback } from "./natureCoverPlayback";
import type { HomeNatureVideoPowerPolicy } from "./useHomeNatureVideoPowerPolicy";
import { homeNatureScreenStyles as styles } from "./homeNatureScreenStyles";
import { CoverVideoPosterBackdrop } from "./CoverVideoPosterBackdrop";
import { resolveNatureHomePortraitCoverLayout } from "./natureHomePortraitCoverLayout";
import { FULL_BLEED_COVER_FALLBACK_BG, resolveLandscapeCoverLayerFrame } from "./fullBleedCoverVideoShared";

type Props = {
  videoBackdropStyle: object;
  videoStageMounted: boolean;
  sceneId: string;
  resolveScenePlayback: (id: string) => NatureCoverPlayback | null;
  posterUri: string;
  posterModule: number | null;
  forcePosterStage: boolean;
  clampedRate: number;
  showLandscapeVideo: boolean;
  homeFocused: boolean;
  /** @deprecated 前台金句不再停封面视频；保留参数以免调用方报错。 */
  verseAudioActive?: boolean;
  /** 读经朗读中：卸封面视频，避免 expo-video 抢会话打断章朗读。 */
  scriptureAudioActive?: boolean;
  /** @deprecated 前台音乐不再强制静帧；保留参数以免调用方报错。 */
  musicAudioActive?: boolean;
  handleSceneVideoReady: (id: string) => void;
  videoPowerPolicy: HomeNatureVideoPowerPolicy;
  showSceneLoader: boolean;
};

export function HomeNatureScreenVideoStage({
  videoBackdropStyle,
  videoStageMounted,
  sceneId,
  resolveScenePlayback,
  posterUri,
  posterModule,
  forcePosterStage,
  clampedRate,
  showLandscapeVideo,
  homeFocused,
  verseAudioActive: _verseAudioActive = false,
  scriptureAudioActive = false,
  handleSceneVideoReady,
  videoPowerPolicy,
  showSceneLoader,
}: Props) {
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const musicBgMinimal = useSyncExternalStore(
    subscribeIosMusicBackgroundMinimal,
    isIosMusicBackgroundMinimal,
    () => false,
  );
  /*
   * 金句播放时封面视频照常播——播放器本身是 `muted = true` + `audioMixingMode = "mixWithOthers"`
   * （见 FullBleedCoverVideoSlots.android.tsx），不参与音频焦点，不会跟金句抢。
   * 此前这里因金句在播就把 `playbackActive` 置 false，画面冻住像静帧，是早期保守措施的残留。
   * 读经朗读仍要卸挂 VideoView（见下面 `mountVideo`），那是另一回事。
   */
  const trimmedPosterFallback = (posterUri ?? "").trim();
  const hasPosterFallback = posterModule != null || trimmedPosterFallback.length > 0;
  const coverLayout = showLandscapeVideo
    ? resolveLandscapeCoverLayerFrame(viewportWidth, viewportHeight)
    : resolveNatureHomePortraitCoverLayout(viewportWidth, viewportHeight);
  const mountVideo = videoStageMounted && !musicBgMinimal && !scriptureAudioActive;

  return (
    <View pointerEvents="none" style={videoBackdropStyle} collapsable={false}>
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, { backgroundColor: FULL_BLEED_COVER_FALLBACK_BG }]}
      />
      {mountVideo ? (
        <FullBleedCoverVideo
          sceneId={sceneId}
          resolveScenePlayback={resolveScenePlayback}
          posterUri={posterUri || undefined}
          posterModule={posterModule}
          forcePosterMode={forcePosterStage}
          rate={clampedRate}
          layoutMode={showLandscapeVideo ? "landscape-cover" : "portrait-cover"}
          nativeFullCover={Platform.OS === "android"}
          onSceneVideoReady={handleSceneVideoReady}
          playbackActive={homeFocused}
          crossfadeAnimated={videoPowerPolicy.crossfadeAnimated}
        />
      ) : hasPosterFallback ? (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <CoverVideoPosterBackdrop
            posterModule={posterModule}
            posterUri={trimmedPosterFallback || undefined}
            portraitLayout={coverLayout}
            viewportWidth={viewportWidth}
            viewportHeight={viewportHeight}
          />
        </View>
      ) : null}
      {showSceneLoader && !musicBgMinimal && !hasPosterFallback ? (
        <View style={styles.sceneLoadOverlay} pointerEvents="none">
          <ActivityIndicator size="small" color="rgba(255,255,255,0.88)" />
          <Text style={styles.sceneLoadText}>{t("pages.homeNature.sceneLoading")}</Text>
        </View>
      ) : null}
    </View>
  );
}
