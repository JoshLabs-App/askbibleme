import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { resolveUiText } from "../i18n/site-copy";
import type { AppLocale } from "../i18n/config";
import { ShellSwipeExclude } from "../shell/ShellSwipeExclude";
import { shellPlaybackTransportMetrics as tm } from "../shell/shellPlaybackTransportLayout";
import { MusicRepeatAllIcon, MusicRepeatOneIcon } from "./MusicHomeControlIcons";
import { musicCopy } from "./musicCopy";
import { musicHomePlaybackControlsStyles as styles } from "./musicHomePlaybackControlsStyles";
import type { MusicRepeatMode } from "./musicPlaybackTypes";

/** 深色底对照读经页：ink→白，muted→半透明白，播放键上图标→深色 */
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.48)";
const ON_PLAY = "#1C1410";

export type MusicHomeTransportSideSlot = {
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
  accessibilityLabel: string;
  icon: ReactNode;
};

type Props = {
  locale: AppLocale;
  playing: boolean;
  canTogglePlayback: boolean;
  onTogglePlay: () => void;
  playAccessibilityLabel?: string;
  pauseAccessibilityLabel?: string;
  musicRepeatMode?: MusicRepeatMode;
  onPrev?: () => void;
  onNext?: () => void;
  onToggleRepeatOne?: () => void;
  onToggleRepeatAll?: () => void;
  /** 首页：替换左右四键；可隐藏中间播放键，仅保留侧键开关。 */
  sides?: {
    start: MusicHomeTransportSideSlot;
    beforePlay: MusicHomeTransportSideSlot;
    afterPlay: MusicHomeTransportSideSlot;
    end?: MusicHomeTransportSideSlot;
  };
  /** 首页金句/专辑独立开关：不显示中间播放/暂停。 */
  hideCenterPlay?: boolean;
  /** 侧键触控边长（首页与 Tab 栏对齐时用 52） */
  sideButtonSize?: number;
};

function SideSlotButton({
  slot,
  chrome,
}: {
  slot: MusicHomeTransportSideSlot;
  chrome: object;
}) {
  return (
    <Pressable
      onPress={slot.onPress}
      hitSlop={8}
      disabled={slot.disabled}
      style={({ pressed }) => [
        chrome,
        pressed && !slot.disabled ? styles.pressed : null,
        slot.disabled ? styles.playBtnDisabled : null,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: slot.selected, disabled: slot.disabled }}
      accessibilityLabel={slot.accessibilityLabel}
    >
      {slot.icon}
    </Pressable>
  );
}

export function MusicHomeTransportButtonRow({
  locale,
  playing,
  canTogglePlayback,
  onTogglePlay,
  playAccessibilityLabel,
  pauseAccessibilityLabel,
  musicRepeatMode,
  onPrev,
  onNext,
  onToggleRepeatOne,
  onToggleRepeatAll,
  sides,
  hideCenterPlay = false,
  sideButtonSize,
}: Props) {
  const oneOn = musicRepeatMode === "one";
  const allOn = musicRepeatMode === "all";

  const playButton = (
    <Pressable
      onPress={onTogglePlay}
      hitSlop={8}
      style={({ pressed }) => [
        styles.playBtn,
        sides ? styles.playBtnHomeShadow : null,
        playing && styles.playBtnPlaying,
        !canTogglePlayback && styles.playBtnDisabled,
        pressed && canTogglePlayback && styles.playBtnPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={
        playing
          ? pauseAccessibilityLabel ?? musicCopy.pause
          : playAccessibilityLabel ?? musicCopy.play
      }
      accessibilityState={{ disabled: !canTogglePlayback, selected: playing }}
      disabled={!canTogglePlayback}
    >
      <MaterialIcons
        name={playing ? "pause" : "play-arrow"}
        size={tm.playIconSize}
        color={ON_PLAY}
        style={playing ? undefined : styles.playIcon}
      />
    </Pressable>
  );

  if (sides) {
    const sideChrome =
      sideButtonSize != null
        ? {
            width: sideButtonSize,
            height: sideButtonSize,
            alignItems: "center" as const,
            justifyContent: "center" as const,
            borderRadius: sideButtonSize / 2,
          }
        : styles.loopBtn;
    if (hideCenterPlay) {
      return (
        <ShellSwipeExclude style={homeSidesLayout.row}>
          <View style={homeSidesLayout.switchRow}>
            <SideSlotButton slot={sides.start} chrome={sideChrome} />
            <SideSlotButton slot={sides.beforePlay} chrome={sideChrome} />
            <SideSlotButton slot={sides.afterPlay} chrome={sideChrome} />
            {sides.end ? <SideSlotButton slot={sides.end} chrome={sideChrome} /> : null}
          </View>
        </ShellSwipeExclude>
      );
    }
    return (
      <ShellSwipeExclude style={homeSidesLayout.row}>
        <View style={homeSidesLayout.cluster}>
          <View style={homeSidesLayout.pair}>
            <SideSlotButton slot={sides.start} chrome={styles.loopBtn} />
            <SideSlotButton slot={sides.beforePlay} chrome={styles.loopBtn} />
          </View>
          {playButton}
          <View style={homeSidesLayout.pair}>
            <SideSlotButton slot={sides.afterPlay} chrome={styles.loopBtn} />
            {sides.end ? <SideSlotButton slot={sides.end} chrome={styles.loopBtn} /> : null}
          </View>
        </View>
      </ShellSwipeExclude>
    );
  }

  return (
    <ShellSwipeExclude style={styles.transport}>
      <Pressable
        testID="music-repeat-one"
        onPress={onToggleRepeatOne}
        hitSlop={8}
        style={({ pressed }) => [
          styles.loopBtn,
          oneOn && styles.loopBtnOn,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityState={{ selected: oneOn }}
        accessibilityLabel={
          oneOn
            ? resolveUiText(locale, "单曲循环已开启", "Repeat one on")
            : resolveUiText(locale, "单曲循环已关闭", "Repeat one off")
        }
      >
        <MusicRepeatOneIcon size={tm.loopIconSize} color={oneOn ? INK : MUTED} />
      </Pressable>

      <View style={styles.transportMain}>
        <Pressable
          onPress={onPrev}
          hitSlop={8}
          style={({ pressed }) => [styles.transportBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={musicCopy.prev}
        >
          <MaterialIcons name="skip-previous" size={tm.skipIconSize} color={INK} />
        </Pressable>
        {playButton}
        <Pressable
          onPress={onNext}
          hitSlop={8}
          style={({ pressed }) => [styles.transportBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={musicCopy.next}
        >
          <MaterialIcons name="skip-next" size={tm.skipIconSize} color={INK} />
        </Pressable>
      </View>

      <Pressable
        testID="music-repeat-all"
        onPress={onToggleRepeatAll}
        hitSlop={8}
        style={({ pressed }) => [
          styles.loopBtn,
          allOn && styles.loopBtnOn,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityState={{ selected: allOn }}
        accessibilityLabel={
          allOn
            ? resolveUiText(locale, "全部循环已开启", "Repeat all on")
            : resolveUiText(locale, "全部循环已关闭", "Repeat all off")
        }
      >
        <MusicRepeatAllIcon size={tm.loopIconSize} color={allOn ? INK : MUTED} />
      </Pressable>
    </ShellSwipeExclude>
  );
}

const homeSidesLayout = StyleSheet.create({
  row: {
    alignSelf: "stretch",
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  cluster: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: tm.transportMainGap,
  },
  pair: { flexDirection: "row", alignItems: "center", gap: 8 },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: tm.transportMainGap,
  },
});
