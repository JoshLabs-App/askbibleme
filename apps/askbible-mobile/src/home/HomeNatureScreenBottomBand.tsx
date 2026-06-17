import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
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
  HOME_SCENE_STRIP_EDGE_PAD,
  SCENE_LOOP_ALL_ID,
  ambientIconColor,
  ambientStripContentWidth,
  displayTitle,
} from "./homeNatureScreenConstants";
import {
  homeSceneStripContentWidth,
  HomeSceneThumb,
} from "./HomeSceneThumb";
import { homeNatureScreenStyles as styles } from "./homeNatureScreenStyles";
import { NATURE_AMBIENT_SCENE_SLOTS } from "./useHomeNatureScreenLoad";

type Props = {
  locale: AppLocale;
  baseUrl: string;
  sceneStripBottomPad: number;
  landscapeScenePickerOpen: boolean;
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
  enableLoopAllScenes: () => void;
  selectScene: (id: string, opts?: { keepLoopMode?: boolean; source?: "user" | "auto" }) => void;
  showLandscapeVideo: boolean;
  onLandscapeSceneSelect: (id: string) => void;
};

export function HomeNatureScreenBottomBand({
  locale,
  baseUrl,
  sceneStripBottomPad,
  landscapeScenePickerOpen,
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
  enableLoopAllScenes,
  selectScene,
  showLandscapeVideo,
  onLandscapeSceneSelect,
}: Props) {
  const sceneStripSwipeExclude = useShellSwipeExcludeHandlers();

  const renderSceneThumb = (item: NatureVideoEntry) => {
    const selected = !loopAllScenesEnabled && item.id === sceneId;
    const thumbModule = resolveNaturePosterPlaybackModule(item.id);
    const posterRel = (item.previewFrameSrc || item.thumbSrc)?.trim() ?? "";
    const thumbRemote = posterRel ? toAbsoluteUrl(baseUrl, posterRel) : "";
    const thumbUri = resolveNaturePosterPlaybackUri(item.id, thumbRemote) || thumbRemote;
    const onPick = () =>
      showLandscapeVideo && landscapeScenePickerOpen
        ? onLandscapeSceneSelect(item.id)
        : selectScene(item.id);
    return (
      <HomeSceneThumb
        key={item.id}
        selected={selected}
        thumbModule={thumbModule}
        thumbUri={thumbUri}
        fallbackLabel={displayTitle(item.title)}
        onPress={onPick}
      />
    );
  };

  return (
    <View
      style={[styles.bottomBand, { paddingBottom: sceneStripBottomPad, zIndex: landscapeScenePickerOpen ? 25 : 10 }]}
      pointerEvents="box-none"
    >
      <ShellSwipeExclude style={styles.ambientScrollWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          alwaysBounceHorizontal
          directionalLockEnabled
          nestedScrollEnabled
          contentContainerStyle={[
            styles.ambientRow,
            {
              minWidth: Math.max(
                ambientStripContentWidth(NATURE_AMBIENT_SCENE_SLOTS.length),
                ambientStripViewportWidth,
              ),
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
            return (
              <Pressable
                key={slot.id}
                onPress={() => {
                  if (!enabled) return;
                  toggleAmbientSlot(slot.id);
                }}
                style={({ pressed }) => [
                  styles.ambientChip,
                  selected && styles.ambientChipSelected,
                  !enabled && styles.ambientChipDisabled,
                  pressed && enabled ? styles.ambientChipPressed : null,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: !enabled }}
                accessibilityLabel={
                  enabled
                    ? `${label}${selected ? resolveUiText(locale, "（已选中）", " (selected)") : ""}`
                    : `${label}${resolveUiText(locale, "（未上传）", " (not uploaded)")}`
                }
              >
                <MaterialCommunityIcons
                  name={slot.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                  size={22}
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
          fadeLeftPx={22}
          fadeRightPx={22}
          fallbackScrimColor="rgba(0,0,0,0.5)"
          onTouchStart={sceneStripSwipeExclude.onTouchStart}
          onScrollBeginDrag={sceneStripSwipeExclude.onScrollBeginDrag}
          contentContainerStyle={[
            styles.sceneRow,
            sceneList.length > 0
              ? {
                  minWidth: Math.max(
                    homeSceneStripContentWidth(sceneList.length + 2) + HOME_SCENE_STRIP_EDGE_PAD * 2,
                    sceneStripViewportWidth,
                  ),
                }
              : null,
          ]}
          style={styles.sceneListScroll}
          onLayout={(e) => {
            const w = Math.round(e.nativeEvent.layout.width);
            if (w > 0) onSceneStripLayout(w);
          }}
        >
          <HomeSceneThumb
            key={SCENE_LOOP_ALL_ID}
            selected={loopAllScenesEnabled}
            thumbModule={null}
            fallbackLabel="∞"
            onPress={() => {
              enableLoopAllScenes();
              if (!sceneId && sceneList.length > 0) {
                const firstId = sceneList[0]?.id;
                if (firstId) selectScene(firstId, { keepLoopMode: true });
              }
            }}
          />
          {sceneList.map(renderSceneThumb)}
        </EdgeFadeHorizontalScrollView>
      </ShellSwipeExclude>
    </View>
  );
}
