import { Pressable, View } from "react-native";
import type { NatureHomeTtsLevel } from "../home/natureHomePrefs";
import { TTS_LEVELS } from "./shellNavDrawerConstants";
import { shellNavDrawerStyles as styles } from "./shellNavDrawerStyles";

type Props = {
  value: NatureHomeTtsLevel;
  onChange: (level: NatureHomeTtsLevel) => void;
  labelForLevel: (level: NatureHomeTtsLevel) => string;
};

export function ShellNavDrawerTtsLevelPicker({ value, onChange, labelForLevel }: Props) {
  return (
    <View style={styles.ttsStepTrack} accessibilityRole="radiogroup">
      <View style={styles.ttsStepRail} pointerEvents="none" />
      {TTS_LEVELS.map((level) => {
        const selected = value === level;
        return (
          <Pressable
            key={level}
            onPress={() => onChange(level)}
            style={styles.ttsStepHit}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={labelForLevel(level)}
          >
            <View style={[styles.ttsStepThumb, selected && styles.ttsStepThumbActive]} />
          </Pressable>
        );
      })}
    </View>
  );
}
