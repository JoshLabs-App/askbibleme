import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, Text, View } from "react-native";
import { resolveUiText } from "../i18n/site-copy";
import type { AppLocale } from "../i18n/config";
import { ShellSwipeExclude } from "../shell/ShellSwipeExclude";
import { MusicRepeatAllIcon, MusicRepeatOneIcon } from "./MusicHomeControlIcons";
import { musicCopy } from "./musicCopy";
import { musicHomePlaybackControlsStyles as styles } from "./musicHomePlaybackControlsStyles";
import type { MusicRepeatMode } from "./musicPlaybackTypes";

type Props = {
  locale: AppLocale;
  compactLandscape: boolean;
  musicRepeatMode: MusicRepeatMode;
  sleepTimerMinutes: number;
  sleepTimerBadge: string | null;
  onPrev: () => void;
  onNext: () => void;
  onToggleRepeatOne: () => void;
  onToggleRepeatAll: () => void;
  onCycleSleepTimer: () => void;
};

export function MusicHomeTransportButtonRow({
  locale,
  compactLandscape,
  musicRepeatMode,
  sleepTimerMinutes,
  sleepTimerBadge,
  onPrev,
  onNext,
  onToggleRepeatOne,
  onToggleRepeatAll,
  onCycleSleepTimer,
}: Props) {
  return (
    <ShellSwipeExclude style={[styles.controls, compactLandscape && styles.controlsLandscape]}>
      <Pressable
        onPress={onPrev}
        hitSlop={14}
        style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={musicCopy.prev}
      >
        <MaterialIcons name="skip-previous" size={26} color="rgba(255,255,255,0.72)" />
      </Pressable>
      <Pressable
        testID="music-repeat-one"
        onPress={onToggleRepeatOne}
        hitSlop={10}
        style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={
          musicRepeatMode === "one"
            ? resolveUiText(locale, "单曲循环已开启", "Repeat one on")
            : resolveUiText(locale, "单曲循环已关闭", "Repeat one off")
        }
      >
        <MusicRepeatOneIcon
          color={musicRepeatMode === "one" ? "rgba(255,255,255,0.98)" : "rgba(255,255,255,0.58)"}
        />
      </Pressable>
      <Pressable
        testID="music-repeat-all"
        onPress={onToggleRepeatAll}
        hitSlop={10}
        style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={
          musicRepeatMode === "all"
            ? resolveUiText(locale, "全部循环已开启", "Repeat all on")
            : resolveUiText(locale, "全部循环已关闭", "Repeat all off")
        }
      >
        <MusicRepeatAllIcon
          color={musicRepeatMode === "all" ? "rgba(255,255,255,0.98)" : "rgba(255,255,255,0.58)"}
        />
      </Pressable>
      <Pressable
        onPress={onCycleSleepTimer}
        style={({ pressed }) => [
          styles.timerIconBtn,
          sleepTimerMinutes > 0 && styles.timerIconBtnOn,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityState={{ selected: sleepTimerMinutes > 0 }}
        accessibilityLabel={
          sleepTimerMinutes > 0 ? `睡眠定时 ${sleepTimerMinutes} 分钟，点按切换` : musicCopy.sleepTimerOff
        }
      >
        <MaterialIcons
          name="timer"
          size={17}
          color={sleepTimerMinutes > 0 ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.62)"}
        />
        {sleepTimerBadge ? (
          <View style={styles.timerBadge}>
            <Text style={styles.timerBadgeText}>{sleepTimerBadge}</Text>
          </View>
        ) : null}
      </Pressable>
      <Pressable
        onPress={onNext}
        hitSlop={14}
        style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={musicCopy.next}
      >
        <MaterialIcons name="skip-next" size={26} color="rgba(255,255,255,0.72)" />
      </Pressable>
    </ShellSwipeExclude>
  );
}
