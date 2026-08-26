import { Pressable, Text, View } from "react-native";
import {
  HOME_VERSE_ROTATION_SEC_OPTIONS,
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
  const label = tNatureHomeSettings("verseRotationSection");

  const apply = async (next: number) => {
    if (next === rotationSec) return;
    setRotationSec(next);
    await writeHomeVerseRotationSec(next);
    onPrefsChanged();
  };

  return (
    <NatureHomeSettingsIconRow icon="autorenew" accessibilityLabel={label}>
      <View style={styles.rotationChoicesRow}>
        <Text style={styles.rotationLabel}>播放</Text>
        <View style={styles.rotationChoicesWrap}>
          {HOME_VERSE_ROTATION_SEC_OPTIONS.map((sec) => {
            const selected = rotationSec === sec;
            return (
              <Pressable
                key={sec}
                onPress={() => void apply(sec)}
                style={[styles.rotationChoice, selected && styles.rotationChoiceOn]}
                accessibilityRole="button"
                accessibilityLabel={`${label} ${sec}`}
                accessibilityState={{ selected }}
              >
                <Text style={styles.rotationChoiceText}>{sec}s</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </NatureHomeSettingsIconRow>
  );
}
