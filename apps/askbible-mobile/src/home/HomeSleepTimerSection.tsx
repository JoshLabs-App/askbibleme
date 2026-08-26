import { Pressable, Text, View } from "react-native";
import {
  useMusicPlayback,
  type ShellSleepTimerMinutes,
} from "../music/MusicPlaybackContext";
import { tNatureHomeSettings } from "./natureHomeSettingsCopy";
import { natureHomeSettingsPanelStyles as panelStyles } from "./natureHomeSettingsPanelStyles";

const SLEEP_OPTIONS: ShellSleepTimerMinutes[] = [15, 30, 60, 120];

const SLEEP_LABEL_KEYS = {
  15: "sleepM15",
  30: "sleepM30",
  60: "sleepM60",
  120: "sleepM120",
} as const;

type Props = {
  segmentStyle?: object;
  segBtnStyle?: object;
  segBtnOnStyle?: object;
  segTextStyle?: object;
  segTextOnStyle?: object;
  onSelect?: (minutes: 0 | ShellSleepTimerMinutes) => void;
};

export function HomeSleepTimerSection({
  segmentStyle,
  segBtnStyle,
  segBtnOnStyle,
  segTextStyle,
  segTextOnStyle,
  onSelect,
}: Props) {
  const { sleepTimerMinutes, setSleepTimerMinutes } = useMusicPlayback();

  return (
    <View style={panelStyles.rotationChoicesWrap} accessibilityRole="radiogroup">
      {SLEEP_OPTIONS.map((minutes) => {
        const selected = sleepTimerMinutes === minutes;
        const label = tNatureHomeSettings(SLEEP_LABEL_KEYS[minutes]);
        return (
          <Pressable
            key={minutes}
            onPress={() => {
              const next = selected ? 0 : minutes;
              setSleepTimerMinutes(next);
              onSelect?.(next);
            }}
            style={[panelStyles.rotationChoice, segBtnStyle, selected && [panelStyles.rotationChoiceOn, segBtnOnStyle]]}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${label} min`}
          >
            <Text style={[panelStyles.rotationChoiceText, segTextStyle, selected && segTextOnStyle]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
