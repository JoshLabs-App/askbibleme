import { Pressable, StyleSheet, View } from "react-native";
import { t, resolveUiText } from "../i18n/site-copy";
import {
  NatureHomeSettingsSelect,
  type NatureHomeSettingsSelectOption,
} from "./NatureHomeSettingsSelect";
import { CONTRAST_OFF_ID } from "./natureHomeTranslationLabels";
import { useNatureHomeTranslationSettings } from "./useNatureHomeTranslationSettings";

type Props = {
  onPrefsChanged: () => void;
};

export function NatureHomeTranslationSettings({ onPrefsChanged }: Props) {
  const {
    locale,
    allOptions,
    openMenu,
    setOpenMenu,
    primaryOptions,
    primaryValue,
    contrastValue,
    selectPrimary,
    selectContrast,
  } = useNatureHomeTranslationSettings(onPrefsChanged);

  const contrastOffLabel = t("pages.read.typography.contrastNone");

  const contrastOptions: NatureHomeSettingsSelectOption[] = [
    {
      id: CONTRAST_OFF_ID,
      label: contrastOffLabel,
      shortLabel: contrastOffLabel,
    },
    ...allOptions,
  ];

  if (allOptions.length === 0) return null;

  const primaryDisplay =
    primaryOptions.find((o) => o.id === primaryValue)?.shortLabel ??
    primaryOptions.find((o) => o.id === primaryValue)?.label ??
    primaryValue;
  const contrastDisplay =
    contrastOptions.find((o) => o.id === contrastValue)?.shortLabel ??
    contrastOptions.find((o) => o.id === contrastValue)?.label ??
    contrastOffLabel;

  return (
    <View style={styles.row}>
      <View style={styles.selectRow}>
        {openMenu ? (
          <Pressable
            style={styles.dismissOverlay}
            onPress={() => setOpenMenu(null)}
            accessibilityRole="button"
            accessibilityLabel={resolveUiText(locale, "关闭译本下拉", "Close translation dropdown")}
          />
        ) : null}
        <NatureHomeSettingsSelect
          style={styles.select}
          accessibilityLabel={primaryDisplay}
          value={primaryValue}
          options={primaryOptions}
          open={openMenu === "primary"}
          onOpenChange={(open) => setOpenMenu(open ? "primary" : null)}
          onSelect={selectPrimary}
        />
        <NatureHomeSettingsSelect
          style={styles.select}
          accessibilityLabel={contrastDisplay}
          value={contrastValue}
          options={contrastOptions}
          open={openMenu === "contrast"}
          onOpenChange={(open) => setOpenMenu(open ? "contrast" : null)}
          onSelect={selectContrast}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: "100%",
    flexDirection: "column",
    alignItems: "stretch",
    gap: 8,
  },
  selectRow: {
    position: "relative",
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  dismissOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  select: {
    flex: 1,
    minWidth: 72,
  },
});
