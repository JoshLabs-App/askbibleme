import { ActivityIndicator, Image, Platform, StyleSheet, Text, View } from "react-native";
import { t } from "../i18n/site-copy";
import { FullBleedCoverVideo } from "./FullBleedCoverVideo";
import { isNatureSoftFocusBlurEnabled, type NatureSoftFocusPrefs } from "./natureHomePrefs";
import { NatureHomeSoftFocusLayer } from "./NatureHomeSoftFocusLayer";
import type { NatureCoverPlayback } from "./natureCoverPlayback";
import type { HomeNatureVideoPowerPolicy } from "./useHomeNatureVideoPowerPolicy";
import { homeNatureScreenStyles as styles } from "./homeNatureScreenStyles";

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
  handleSceneVideoReady: (id: string) => void;
  videoPowerPolicy: HomeNatureVideoPowerPolicy;
  hasVideoStage: boolean;
  settingsOpen: boolean;
  softFocus: NatureSoftFocusPrefs;
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
  handleSceneVideoReady,
  videoPowerPolicy,
  hasVideoStage,
  settingsOpen,
  softFocus,
  showSceneLoader,
}: Props) {
  const trimmedPosterFallback = posterUri.trim();
  const hasPosterFallback = posterModule != null || trimmedPosterFallback.length > 0;

  return (
    <View pointerEvents="none" style={videoBackdropStyle} collapsable={false}>
      {videoStageMounted ? (
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
          {posterModule != null ? (
            <Image source={posterModule} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : (
            <Image
              source={{ uri: trimmedPosterFallback }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
          )}
        </View>
      ) : null}
      {hasVideoStage &&
      (settingsOpen || isNatureSoftFocusBlurEnabled(softFocus) || softFocus.overlayOpacity > 0.02) ? (
        <NatureHomeSoftFocusLayer prefs={softFocus} posterUri={posterUri || undefined} />
      ) : null}
      {showSceneLoader ? (
        <View style={styles.sceneLoadOverlay} pointerEvents="none">
          <ActivityIndicator size="small" color="rgba(255,255,255,0.88)" />
          <Text style={styles.sceneLoadText}>{t("pages.homeNature.sceneLoading")}</Text>
        </View>
      ) : null}
    </View>
  );
}
