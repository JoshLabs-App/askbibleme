import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { resolveUiText } from "../i18n/site-copy";
import { useLocale } from "../i18n/LocaleProvider";
import { useMusicPlayback } from "../music/MusicPlaybackContext";
import { cycleShellSleepTimerMinutes } from "../music/musicSleepTimer";
import { ShellMaterialIcon } from "../shell/ShellMaterialIcon";
import { SPLASH_BACKGROUND as LOGO_COLOR } from "../shell/splash-branding.generated";
import {
  NATURE_HOME_TEXT_SCALE_STEPS,
  platformDefaultTextScaleIndex,
  readNatureHomeTextScaleIndex,
  writeNatureHomeTextScaleIndex,
} from "./natureHomePrefs";
import { tNatureHomeSettings } from "./natureHomeSettingsCopy";
import { homeNatureScreenStyles as styles } from "./homeNatureScreenStyles";

const IDLE = "rgba(255,255,255,0.78)";
const ICON_SIZE = 26;

type Props = {
  prefsVersion: number;
  onPrefsChanged: () => void;
};

export function HomeVerseScaleTimerControl({ prefsVersion, onPrefsChanged }: Props) {
  const { locale } = useLocale();
  const { sleepTimerMinutes, setSleepTimerMinutes } = useMusicPlayback();
  const [scaleIndex, setScaleIndex] = useState(platformDefaultTextScaleIndex);
  const atMin = scaleIndex <= 0;
  const atMax = scaleIndex >= NATURE_HOME_TEXT_SCALE_STEPS.length - 1;
  const timerOn = sleepTimerMinutes > 0;

  useEffect(() => {
    let cancelled = false;
    void readNatureHomeTextScaleIndex().then((next) => {
      if (!cancelled) setScaleIndex(next);
    });
    return () => {
      cancelled = true;
    };
  }, [prefsVersion]);

  const bumpScale = useCallback(
    async (delta: -1 | 1) => {
      const next = Math.max(0, Math.min(NATURE_HOME_TEXT_SCALE_STEPS.length - 1, scaleIndex + delta));
      if (next === scaleIndex) return;
      void Haptics.selectionAsync();
      setScaleIndex(next);
      await writeNatureHomeTextScaleIndex(next);
      onPrefsChanged();
    },
    [onPrefsChanged, scaleIndex],
  );

  return (
    <View style={styles.scaleTimerRow} pointerEvents="box-none">
        <Pressable
          disabled={atMin}
          onPress={() => void bumpScale(-1)}
          hitSlop={10}
          style={({ pressed }) => [
            styles.scaleTimerHit,
            atMin && styles.scaleTimerHitDisabled,
            pressed && !atMin ? styles.scaleTimerHitPressed : null,
          ]}
          accessibilityRole="button"
          accessibilityLabel={tNatureHomeSettings("textScaleSmallerAria")}
          accessibilityState={{ disabled: atMin }}
        >
          <ShellMaterialIcon name="remove" size={ICON_SIZE} color={IDLE} />
        </Pressable>
        <Pressable
          disabled={atMax}
          onPress={() => void bumpScale(1)}
          hitSlop={10}
          style={({ pressed }) => [
            styles.scaleTimerHit,
            atMax && styles.scaleTimerHitDisabled,
            pressed && !atMax ? styles.scaleTimerHitPressed : null,
          ]}
          accessibilityRole="button"
          accessibilityLabel={tNatureHomeSettings("textScaleLargerAria")}
          accessibilityState={{ disabled: atMax }}
        >
          <ShellMaterialIcon name="add" size={ICON_SIZE} color={IDLE} />
        </Pressable>
        <Pressable
          onPress={() => {
            void Haptics.selectionAsync();
            setSleepTimerMinutes(cycleShellSleepTimerMinutes(sleepTimerMinutes));
          }}
          hitSlop={10}
          style={({ pressed }) => [styles.scaleTimerHit, pressed ? styles.scaleTimerHitPressed : null]}
          accessibilityRole="button"
          accessibilityState={{ selected: timerOn }}
          accessibilityLabel={
            timerOn
              ? resolveUiText(locale, `定时 ${sleepTimerMinutes} 分钟，点按切换`, `Timer ${sleepTimerMinutes} min, tap to cycle`)
              : tNatureHomeSettings("sleepSection")
          }
        >
          <ShellMaterialIcon name="timer" size={ICON_SIZE} color={timerOn ? LOGO_COLOR : IDLE} />
          {timerOn ? (
            <View style={styles.quickControlTimerBadge}>
              <Text style={styles.quickControlTimerBadgeText}>{String(sleepTimerMinutes)}</Text>
            </View>
          ) : null}
        </Pressable>
    </View>
  );
}
