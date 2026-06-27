import { Pressable, Text, View } from "react-native";
import {
  MAX_HOME_VERSE_ROTATION_SEC,
  MIN_HOME_VERSE_ROTATION_SEC,
  writeHomeVerseRotationSec,
} from "./homeVerseRotationPrefs";
import { tNatureHomeSettings } from "./natureHomeSettingsCopy";
import { NatureHomeSettingsIconRow } from "./NatureHomeSettingsIconRow";
import { natureHomeSettingsPanelStyles as styles } from "./natureHomeSettingsPanelStyles";

type Props = {
  rotationSec: number;
  setRotationSec: (sec: number) => void;
  onPrefsChanged: () => void;
};

export function HomeVerseRotationSection({ rotationSec, setRotationSec, onPrefsChanged }: Props) {
  const atMin = rotationSec <= MIN_HOME_VERSE_ROTATION_SEC;
  const atMax = rotationSec >= MAX_HOME_VERSE_ROTATION_SEC;
  const label = tNatureHomeSettings("verseRotationSection");
  const valueLabel = tNatureHomeSettings("verseRotationValue").replace("{n}", String(rotationSec));

  const apply = async (next: number) => {
    setRotationSec(next);
    await writeHomeVerseRotationSec(next);
    onPrefsChanged();
  };

  return (
    <NatureHomeSettingsIconRow icon="autorenew" accessibilityLabel={label}>
      <View
        style={styles.scaleRow}
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityHint={tNatureHomeSettings("verseRotationHint")}
        accessibilityValue={{ text: valueLabel }}
      >
        <Pressable
          disabled={atMin}
          onPress={() => void apply(rotationSec - 1)}
          style={[styles.scaleBtn, atMin && styles.scaleBtnDisabled]}
          accessibilityRole="button"
          accessibilityLabel={tNatureHomeSettings("verseRotationDecreaseAria")}
          accessibilityState={{ disabled: atMin }}
        >
          <Text style={styles.scaleOpText}>-</Text>
        </Pressable>
        <View style={styles.rotationValueWrap} importantForAccessibility="no-hide-descendants">
          <Text style={styles.rotationValueText}>{valueLabel}</Text>
        </View>
        <Pressable
          disabled={atMax}
          onPress={() => void apply(rotationSec + 1)}
          style={[styles.scaleBtn, atMax && styles.scaleBtnDisabled]}
          accessibilityRole="button"
          accessibilityLabel={tNatureHomeSettings("verseRotationIncreaseAria")}
          accessibilityState={{ disabled: atMax }}
        >
          <Text style={styles.scaleOpText}>+</Text>
        </Pressable>
      </View>
    </NatureHomeSettingsIconRow>
  );
}
