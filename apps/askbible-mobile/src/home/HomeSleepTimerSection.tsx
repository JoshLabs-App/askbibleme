import { Pressable, StyleSheet, Text, View } from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import {
  useMusicPlayback,
  type ShellSleepTimerMinutes,
} from "../music/MusicPlaybackContext";
import { tNatureHomeSettings } from "./natureHomeSettingsCopy";

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

  const segText = [styles.segText, segTextStyle];
  const segTextOn = [styles.segText, segTextStyle, styles.segTextOn, segTextOnStyle];

  return (
    <View style={[styles.segment, segmentStyle]} accessibilityRole="radiogroup">
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
            style={[styles.segBtn, segBtnStyle, selected && [styles.segBtnOn, segBtnOnStyle]]}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${label} min`}
          >
            <Text style={selected ? segTextOn : segText}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: "row",
    backgroundColor: "#27272a",
    borderRadius: 8,
    padding: 3,
  },
  segBtn: {
    flex: 1,
    minHeight: 34,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  segBtnOn: { backgroundColor: "#3f3f46" },
  segText: {
    fontSize: 11,
    ...parchmentSans(600),
    fontVariant: ["tabular-nums"],
    color: "rgba(255,255,255,0.5)",
  },
  segTextOn: { color: "#fff" },
});
