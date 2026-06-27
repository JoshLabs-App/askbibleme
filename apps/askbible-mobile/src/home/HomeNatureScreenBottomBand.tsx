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
  HOME_SCENE_STRIP_LANDSCAPE_EDGE_PAD,
  HOME_SCENE_THUMB_LANDSCAPE_SLOT_PAD,
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
import { HomeNatureMusicPlayButton } from "./HomeNatureMusicPlayButton";
import { NATURE_AMBIENT_SCENE_SLOTS } from "./useHomeNatureScreenLoad";

type Props = {
  locale: AppLocale;
  baseUrl: string;
  landscapeLayout?: boolean;
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
  enableLoopAllScenes: () => void;
  selectScene: (id: string, opts?: { keepLoopMode?: boolean; source?: "user" | "auto" }) => void;
};

export function HomeNatureScreenBottomBand({
  locale,
  baseUrl,
  landscapeLayout = false,
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
  enableLoopAllScenes,
  selectScene,
}: Props) {
  const sceneStripSwipeExclude = useShellSwipeExcludeHandlers();
  const sceneEdgePad = landscapeLayout ? HOME_SCENE_STRIP_LANDSCAPE_EDGE_PAD : HOME_SCENE_STRIP_EDGE_PAD;
  const thumbSlotPad = landscapeLayout ? HOME_SCENE_THUMB_LANDSCAPE_SLOT_PAD : undefined;

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
        fallbackLabel={displayTitle(item.title)}
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
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.homeMusicPlayBtnWrap} pointerEvents="box-none">
        <HomeNatureMusicPlayButton />
      </View>
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
              paddingLeft: sceneEdgePad,
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
                    homeSceneStripContentWidth(sceneList.length + 2) + sceneEdgePad,
                    sceneStripViewportWidth,
                  ),
                  paddingLeft: sceneEdgePad,
                  paddingRight: sceneEdgePad,
                }
              : { paddingLeft: sceneEdgePad, paddingRight: sceneEdgePad },
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
            slotPad={thumbSlotPad}
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
