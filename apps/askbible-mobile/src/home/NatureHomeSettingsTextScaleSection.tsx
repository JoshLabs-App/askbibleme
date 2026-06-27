import { Pressable, Text, View } from "react-native";
import {
  NATURE_HOME_TEXT_SCALE_STEPS,
  SUPER_LARGE_TEXT_SCALE_INDEX,
  platformDefaultTextScaleIndex,
  textScaleAtIndex,
  writeNatureHomeTextScaleIndex,
} from "./natureHomePrefs";
import { tNatureHomeSettings } from "./natureHomeSettingsCopy";
import { NatureHomeSettingsIconRow } from "./NatureHomeSettingsIconRow";
import { natureHomeSettingsPanelStyles as styles } from "./natureHomeSettingsPanelStyles";

type Props = {
  scaleIndex: number;
  setScaleIndex: (index: number) => void;
  onPrefsChanged: () => void;
};

export function NatureHomeSettingsTextScaleSection({ scaleIndex, setScaleIndex, onPrefsChanged }: Props) {
  const defaultScaleIndex = platformDefaultTextScaleIndex();
  const atMin = scaleIndex <= 0;
  const atMax = scaleIndex >= NATURE_HOME_TEXT_SCALE_STEPS.length - 1;
  const atDefault = scaleIndex === defaultScaleIndex;
  const superLargeIndex = Math.min(NATURE_HOME_TEXT_SCALE_STEPS.length - 1, SUPER_LARGE_TEXT_SCALE_INDEX);
  const atSuperLarge = scaleIndex >= superLargeIndex;
  const scaleA11y = `${tNatureHomeSettings("verseSizeSection")} ${Math.round(textScaleAtIndex(scaleIndex) * 100)}%`;

  return (
    <NatureHomeSettingsIconRow icon="format-size" accessibilityLabel={scaleA11y}>
      <View
        style={styles.scaleRow}
        accessibilityRole="adjustable"
        accessibilityLabel={scaleA11y}
        accessibilityValue={{ text: `${Math.round(textScaleAtIndex(scaleIndex) * 100)}%` }}
      >
        <Pressable
          disabled={atDefault}
          onPress={async () => {
            setScaleIndex(defaultScaleIndex);
            await writeNatureHomeTextScaleIndex(defaultScaleIndex);
            onPrefsChanged();
          }}
          style={[styles.scaleBtn, atDefault && styles.scaleBtnDefaultOn]}
          accessibilityRole="button"
          accessibilityLabel={tNatureHomeSettings("textScaleDefaultAria")}
          accessibilityState={{ disabled: atDefault, selected: atDefault }}
        >
          <Text style={styles.scaleDefaultText}>T</Text>
        </Pressable>
        <Pressable
          disabled={atSuperLarge}
          onPress={async () => {
            setScaleIndex(superLargeIndex);
            await writeNatureHomeTextScaleIndex(superLargeIndex);
            onPrefsChanged();
          }}
          style={[styles.scaleBtn, atSuperLarge && styles.scaleBtnDefaultOn]}
          accessibilityRole="button"
          accessibilityLabel={tNatureHomeSettings("textScaleSuperAria")}
          accessibilityState={{ disabled: atSuperLarge, selected: atSuperLarge }}
        >
          <Text style={styles.scaleSuperText}>T</Text>
        </Pressable>
        <Pressable
          disabled={atMin}
          onPress={async () => {
            const next = Math.max(0, scaleIndex - 1);
            setScaleIndex(next);
            await writeNatureHomeTextScaleIndex(next);
            onPrefsChanged();
          }}
          style={[styles.scaleBtn, atMin && styles.scaleBtnDisabled]}
          accessibilityRole="button"
          accessibilityLabel={tNatureHomeSettings("textScaleSmallerAria")}
          accessibilityState={{ disabled: atMin }}
        >
          <Text style={styles.scaleOpText}>-</Text>
        </Pressable>
        <Pressable
          disabled={atMax}
          onPress={async () => {
            const next = Math.min(NATURE_HOME_TEXT_SCALE_STEPS.length - 1, scaleIndex + 1);
            setScaleIndex(next);
            await writeNatureHomeTextScaleIndex(next);
            onPrefsChanged();
          }}
          style={[styles.scaleBtn, atMax && styles.scaleBtnDisabled]}
          accessibilityRole="button"
          accessibilityLabel={tNatureHomeSettings("textScaleLargerAria")}
          accessibilityState={{ disabled: atMax }}
        >
          <Text style={styles.scaleOpText}>+</Text>
        </Pressable>
      </View>
    </NatureHomeSettingsIconRow>
  );
}
