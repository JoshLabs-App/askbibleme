import { Pressable, StyleSheet, Text, View } from "react-native";
import { t } from "../i18n/site-copy";
import { NATURE_HOME_VERSE_TEXT_EFFECTS, type NatureHomeVerseTextEffect } from "./natureHomePrefs";
import { verseEffectOnVideoPreviewStyle } from "./verseTextStyle";
import { tNatureHomeSettings } from "./natureHomeSettingsCopy";

type Props = {
  selected: NatureHomeVerseTextEffect;
  onSelect: (effect: NatureHomeVerseTextEffect) => void;
};

function labelForEffect(effect: NatureHomeVerseTextEffect): string {
  switch (effect) {
    case "classic":
      return t("nature.homeVerse.effectClassicHome");
    case "bold":
      return t("nature.homeVerse.effectBoldHome");
    case "barStrip":
      return t("nature.homeVerse.effectBarStripHome");
    case "flat":
      return t("pages.goldenVerses.effectFlat");
    case "letterpress":
      return t("pages.goldenVerses.effectLetterpress");
    case "engraved":
      return t("pages.goldenVerses.effectEngraved");
    case "insetCarved":
      return t("pages.goldenVerses.effectInsetCarved");
    case "softBloom":
      return t("pages.goldenVerses.effectSoftBloom");
    default:
      return effect;
  }
}

function EffectChip({
  effect,
  selected,
  onPress,
}: {
  effect: NatureHomeVerseTextEffect;
  selected: boolean;
  onPress: () => void;
}) {
  const label = labelForEffect(effect);
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipOn]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <Text style={[styles.preview, verseEffectOnVideoPreviewStyle(effect)]} accessibilityElementsHidden>
        Aa
      </Text>
    </Pressable>
  );
}

export function NatureHomeVerseEffectPicker({ selected, onSelect }: Props) {
  return (
    <View
      style={styles.row}
      accessibilityRole="radiogroup"
      accessibilityLabel={tNatureHomeSettings("verseEffectSection")}
    >
      {NATURE_HOME_VERSE_TEXT_EFFECTS.map((effect) => (
        <EffectChip
          key={effect}
          effect={effect}
          selected={selected === effect}
          onPress={() => onSelect(effect)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    gap: 4,
  },
  chip: {
    flex: 1,
    minHeight: 34,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#27272a",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#3f3f46",
  },
  chipOn: {
    backgroundColor: "#3f3f46",
    borderColor: "#71717a",
  },
  preview: {
    includeFontPadding: false,
  },
});
