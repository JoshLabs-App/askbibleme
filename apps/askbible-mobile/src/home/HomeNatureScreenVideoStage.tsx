import { useSyncExternalStore } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import {
  isIosMusicBackgroundMinimal,
  subscribeIosMusicBackgroundMinimal,
} from "../audio/iosMusicBackgroundQuarantine";
import {
  getShellVerseWantPlaying,
  subscribeShellVerseWantPlaying,
} from "../audio/shellVerseWantPlaying";
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
  const verseWant = useSyncExternalStore(
    subscribeShellVerseWantPlaying,
    getShellVerseWantPlaying,
    () => false,
  );
  // 安卓金句：只暂停解码，不卸 VideoView（卸掉会切静帧抖动）。音乐已静音 mixWithOthers，可与视频同播；读经仍须卸挂。
  const androidPauseCoverVideo =
    Platform.OS === "android" && verseWant && !scriptureAudioActive;
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
          playbackActive={homeFocused && !androidPauseCoverVideo}
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
