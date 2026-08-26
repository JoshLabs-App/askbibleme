import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { musicCopy } from "./musicCopy";
import { musicHomePlaybackControlsStyles as styles } from "./musicHomePlaybackControlsStyles";
import { SPLASH_BACKGROUND as LOGO_COLOR } from "../shell/splash-branding.generated";

type Props = {
  chromeVisible: boolean;
  sleepTimerMinutes: number;
  sleepTimerBadge: string | null;
  onCycleSleepTimer: () => void;
};

/** 音乐页右上角睡眠定时，与左上角菜单对称 */
export function MusicHomeSleepTimerButton({
  chromeVisible,
  sleepTimerMinutes,
  sleepTimerBadge,
  onCycleSleepTimer,
}: Props) {
  const insets = useSafeAreaInsets();
  if (!chromeVisible) return null;

  const on = sleepTimerMinutes > 0;

  return (
    <Pressable
      onPress={onCycleSleepTimer}
      hitSlop={8}
      style={({ pressed }) => [
        styles.timerBtn,
        {
          top: insets.top + 6,
          right: Math.max(insets.right, 8),
        },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={
        on ? `睡眠定时 ${sleepTimerMinutes} 分钟，点按切换` : musicCopy.sleepTimerOff
      }
    >
      <MaterialIcons name="timer" size={26} color={on ? LOGO_COLOR : "#FFFFFF"} />
      {sleepTimerBadge ? (
        <View style={styles.timerBadge}>
          <Text style={styles.timerBadgeText}>{sleepTimerBadge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
