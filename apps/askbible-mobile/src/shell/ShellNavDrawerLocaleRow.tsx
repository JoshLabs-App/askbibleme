import { Pressable, Text, View } from "react-native";
import { getLocalePickerLabel } from "../i18n/locale-display-labels";
import { t } from "../i18n/site-copy";
import type { AppLocale } from "../i18n/config";
import { shellNavDrawerStyles as styles } from "./shellNavDrawerStyles";

type Props = {
  locale: AppLocale;
  onLocaleChange: (next: AppLocale) => void;
  switching: boolean;
};

export function ShellNavDrawerLocaleRow({ locale, onLocaleChange, switching }: Props) {
  return (
    <View style={[styles.row, styles.rowInline]}>
      <Text style={styles.rowText}>{t("nav.language")}</Text>
      <View style={styles.localeInlineGroup}>
        {(["en", "zh-TW", "zh-CN"] as const).map((item) => (
          <Pressable
            key={item}
            onPress={() => onLocaleChange(item)}
            style={[styles.localeInlineChip, locale === item && styles.localeInlineChipActive]}
            disabled={switching}
            accessibilityRole="button"
            accessibilityState={{ selected: locale === item }}
            accessibilityLabel={getLocalePickerLabel(item)}
          >
            <Text style={[styles.localeInlineLabel, locale === item && styles.localeInlineLabelActive]}>
              {getLocalePickerLabel(item)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
