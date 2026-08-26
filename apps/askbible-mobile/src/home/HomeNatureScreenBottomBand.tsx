import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useEffect, useRef } from "react";
import { Pressable, ScrollView, View } from "react-native";
import type { NatureAmbientSceneSlotId } from "../nature/ambientSceneSlots";
import { BUNDLED_AMBIENT_SCENE_AUDIO } from "../nature/bundledAmbientSceneAudio";
import { toAbsoluteUrl } from "../config/askbibleBaseUrl";
import { resolveUiText, toZhTwText } from "../i18n/site-copy";
import type { AppLocale } from "../i18n/config";
import { resolveNaturePosterPlaybackModule, resolveNaturePosterPlaybackUri } from "../media/bundledNatureMedia";
import { EdgeFadeHorizontalScrollView } from "../ui/EdgeFadeHorizontalScrollView";
import { ShellSwipeExclude, useShellSwipeExcludeHandlers } from "../shell/ShellSwipeExclude";
import type { NatureVideoEntry } from "../types/nature";
import {
  AMBIENT_ICON_SIZE,
  HOME_AMBIENT_CHIP_INSET,
  HOME_SCENE_STRIP_EDGE_PAD,
  HOME_SCENE_STRIP_LANDSCAPE_EDGE_PAD,
  HOME_SCENE_THUMB_LANDSCAPE_SLOT_PAD,
  ambientIconColor,
  ambientStripContentWidth,
  ambientStripScrollX,
  displayTitle,
} from "./homeNatureScreenConstants";
import {
  HOME_SCENE_THUMB_SIZE,
  HOME_SCENE_THUMB_SLOT_WIDTH,
  homeSceneStripContentWidth,
  HomeSceneThumb,
} from "./HomeSceneThumb";
import { homeNatureScreenStyles as styles } from "./homeNatureScreenStyles";
import { HomeNatureAlbumStrip } from "./HomeNatureAlbumStrip";
import { HomeVerseScaleTimerControl } from "./HomeVerseScaleTimerControl";
import { NATURE_AMBIENT_SCENE_SLOTS } from "./useHomeNatureScreenLoad";

type Props = {
  locale: AppLocale;
  baseUrl: string;
  landscapeLayout?: boolean;
  /** 横屏沉浸时藏起来但不卸，避免播放选中态丢了 */
  hidden?: boolean;
  sceneStripBottomPad: number;
  activeAmbientSlotId: NatureAmbientSceneSlotId | "";
  toggleAmbientSlot: (slotId: NatureAmbientSceneSlotId) => void;
  ambientStripViewportWidth: number;
  onAmbientStripLayout: (width: number) => void;
  sceneScrollRef: React.RefObject<ScrollView | null>;
  sceneList: NatureVideoEntry[];
  sceneStripViewportWidth: number;
  onSceneStripLayout: (width: number) => void;
  loopAllScenesEnabled: boolean;
  sceneId: string;
  selectScene: (id: string, opts?: { keepLoopMode?: boolean; source?: "user" | "auto" }) => void;
  goldenVerseOn: boolean;
  goldenVersePreparing?: boolean;
  onToggleGoldenVerse: () => void;
  liveVideoActive: boolean;
  onToggleLiveVideo: () => void;
  prefsVersion: number;
  onPrefsChanged: () => void;
  sceneToolsOpen: boolean;
  onToggleSceneTools: () => void;
  onUserActivity?: () => void;
};

export function HomeNatureScreenBottomBand({
  locale,
  baseUrl,
  landscapeLayout = false,
  hidden = false,
  sceneStripBottomPad,
  activeAmbientSlotId,
  toggleAmbientSlot,
  ambientStripViewportWidth,
  onAmbientStripLayout,
  sceneScrollRef,
  sceneList,
  sceneStripViewportWidth,
  onSceneStripLayout,
  loopAllScenesEnabled,
  sceneId,
  selectScene,
  goldenVerseOn,
  goldenVersePreparing = false,
  onToggleGoldenVerse,
  liveVideoActive,
  onToggleLiveVideo,
  prefsVersion,
  onPrefsChanged,
  sceneToolsOpen,
  onToggleSceneTools,
  onUserActivity,
}: Props) {
  const sceneStripSwipeExclude = useShellSwipeExcludeHandlers();
  const ambientScrollRef = useRef<ScrollView>(null);
  const sceneEdgePad = landscapeLayout ? HOME_SCENE_STRIP_LANDSCAPE_EDGE_PAD : HOME_SCENE_STRIP_EDGE_PAD;
  const ambientLeftPad = sceneEdgePad - HOME_AMBIENT_CHIP_INSET;
  const sceneLeftPad =
    sceneEdgePad - (HOME_SCENE_THUMB_SLOT_WIDTH - HOME_SCENE_THUMB_SIZE) / 2;
  const thumbSlotPad = landscapeLayout ? HOME_SCENE_THUMB_LANDSCAPE_SLOT_PAD : undefined;

  useEffect(() => {
    if (!activeAmbientSlotId) return;
    const idx = NATURE_AMBIENT_SCENE_SLOTS.findIndex((slot) => slot.id === activeAmbientSlotId);
    if (idx < 0 || ambientStripViewportWidth < 1) return;
    ambientScrollRef.current?.scrollTo({
      x: ambientStripScrollX(
        idx,
        ambientStripViewportWidth,
        NATURE_AMBIENT_SCENE_SLOTS.length,
        sceneEdgePad,
        ambientLeftPad,
      ),
      animated: true,
    });
  }, [activeAmbientSlotId, ambientStripViewportWidth, sceneEdgePad, ambientLeftPad]);

  const renderSceneThumb = (item: NatureVideoEntry) => {
    const selected = !loopAllScenesEnabled && item.id === sceneId;
    const thumbModule = resolveNaturePosterPlaybackModule(item.id);
    const posterRel = (item.previewFrameSrc || item.thumbSrc)?.trim() ?? "";
    const thumbRemote = posterRel ? toAbsoluteUrl(baseUrl, posterRel) : "";
    const thumbUri = resolveNaturePosterPlaybackUri(item.id, thumbRemote) || thumbRemote;
    const onPick = () => selectScene(item.id);
    return (
      <HomeSceneThumb
        key={item.id}
        selected={selected}
        thumbModule={thumbModule}
        thumbUri={thumbUri}
        fallbackLabel={displayTitle(item.title, locale, item.id)}
        onPress={onPick}
        slotPad={thumbSlotPad}
      />
    );
  };

  return (
    <View
      style={[
        styles.bottomBand,
        landscapeLayout && styles.bottomBandLandscape,
        { paddingBottom: sceneStripBottomPad },
        hidden ? styles.bottomBandHidden : null,
      ]}
      pointerEvents={hidden ? "none" : "box-none"}
    >
      {sceneToolsOpen ? (
        <>
      <HomeVerseScaleTimerControl
        prefsVersion={prefsVersion}
        onPrefsChanged={onPrefsChanged}
      />
      <ShellSwipeExclude style={styles.ambientScrollWrap}>
        <ScrollView
          ref={ambientScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          alwaysBounceHorizontal
          directionalLockEnabled
          nestedScrollEnabled
          contentContainerStyle={[
            styles.ambientRow,
            {
              minWidth: Math.max(
                ambientStripContentWidth(
                  NATURE_AMBIENT_SCENE_SLOTS.length,
                  sceneEdgePad,
                  ambientLeftPad,
                ),
                ambientStripViewportWidth,
              ),
              paddingLeft: ambientLeftPad,
              paddingRight: sceneEdgePad,
            },
          ]}
          style={styles.ambientScroll}
          onLayout={(e) => {
            const w = Math.round(e.nativeEvent.layout.width);
            if (w > 0) onAmbientStripLayout(w);
          }}
        >
          {NATURE_AMBIENT_SCENE_SLOTS.map((slot) => {
            const enabled = typeof BUNDLED_AMBIENT_SCENE_AUDIO[slot.id] === "number";
            const selected = activeAmbientSlotId === slot.id;
            const label = locale === "en" ? slot.labelEn : locale === "zh-TW" ? toZhTwText(slot.label) : slot.label;
            const canPress = enabled || selected;
            return (
              <Pressable
                key={slot.id}
                onPress={() => {
                  if (!canPress) return;
                  toggleAmbientSlot(slot.id);
                }}
                style={({ pressed }) => [
                  styles.ambientChip,
                  !selected && enabled && styles.ambientChipIdle,
                  selected && styles.ambientChipSelected,
                  !enabled && !selected && styles.ambientChipDisabled,
                  pressed && canPress ? styles.ambientChipPressed : null,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: !canPress }}
                accessibilityLabel={
                  canPress
                    ? `${label}${selected ? resolveUiText(locale, "（已选中）", " (selected)") : ""}`
                    : `${label}${resolveUiText(locale, "（未上传）", " (not uploaded)")}`
                }
              >
                <MaterialCommunityIcons
                  name={slot.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                    size={AMBIENT_ICON_SIZE}
                  color={ambientIconColor(selected, enabled)}
                />
              </Pressable>
            );
          })}
        </ScrollView>
      </ShellSwipeExclude>
      <ShellSwipeExclude style={styles.sceneList}>
        <EdgeFadeHorizontalScrollView
          ref={sceneScrollRef}
          showsHorizontalScrollIndicator={false}
          alwaysBounceHorizontal
          directionalLockEnabled
          nestedScrollEnabled
          fadeLeftPx={0}
          fadeRightPx={sceneEdgePad}
          fallbackScrimColor="rgba(0,0,0,0.5)"
          onTouchStart={sceneStripSwipeExclude.onTouchStart}
          onScrollBeginDrag={sceneStripSwipeExclude.onScrollBeginDrag}
          contentContainerStyle={[
            styles.sceneRow,
            landscapeLayout && styles.sceneRowLandscape,
            sceneList.length > 0
              ? {
                  minWidth: Math.max(
                    homeSceneStripContentWidth(sceneList.length + 2) + sceneLeftPad + sceneEdgePad,
                    sceneStripViewportWidth,
                  ),
                  paddingLeft: sceneLeftPad,
                  paddingRight: sceneEdgePad,
                }
              : { paddingLeft: sceneLeftPad, paddingRight: sceneEdgePad },
          ]}
          style={styles.sceneListScroll}
          onLayout={(e) => {
            const w = Math.round(e.nativeEvent.layout.width);
            if (w > 0) onSceneStripLayout(w);
          }}
        >
          <HomeSceneThumb
            key="scene-blur-toggle"
            selected={!liveVideoActive}
            thumbModule={null}
            icon="blur"
            fallbackLabel={resolveUiText(locale, "模糊", "Blur")}
            slotPad={thumbSlotPad}
            onPress={onToggleLiveVideo}
          />
          {sceneList.map(renderSceneThumb)}
        </EdgeFadeHorizontalScrollView>
      </ShellSwipeExclude>
        </>
      ) : null}
      <View style={{ alignSelf: "stretch", width: "100%" }}>
        <HomeNatureAlbumStrip
          goldenVerseOn={goldenVerseOn}
          goldenVersePreparing={goldenVersePreparing}
          onToggleGoldenVerse={onToggleGoldenVerse}
          onUserActivity={onUserActivity}
        />
      </View>
    </View>
  );
}
