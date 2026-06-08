import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { AppLocale } from "../i18n/config";
import { getLocalePickerLabel } from "../i18n/locale-display-labels";
import { toZhTwText } from "../i18n/site-copy";
import { SPLASH_BACKGROUND as LOGO_YELLOW } from "../shell/splash-branding.generated";
import { theme } from "../theme";
import type { CompanionNeedOption } from "./onboarding-devotion-data";
import type { CompanionNeedId } from "./onboarding-devotion-prefs";

type OnboardingNeedStepProps = {
  locale: AppLocale;
  onLocaleChange: (next: AppLocale) => void;
  selectedNeeds: CompanionNeedId[];
  onToggleNeed: (id: CompanionNeedId) => void;
  options: CompanionNeedOption[];
};

function mapNeedIcon(name: string): keyof typeof MaterialCommunityIcons.glyphMap {
  switch (name) {
    case "leaf":
      return "leaf";
    case "heart":
      return "heart-outline";
    case "calendar":
      return "calendar-blank-outline";
    case "question":
      return "help-circle-outline";
    case "sprout":
      return "sprout-outline";
    case "grid":
      return "view-grid-outline";
    default:
      return "circle-outline";
  }
}

export function OnboardingNeedStep({
  locale,
  onLocaleChange,
  selectedNeeds,
  onToggleNeed,
  options,
}: OnboardingNeedStepProps) {
  const zhText = (text: string) => (locale === "zh-TW" ? toZhTwText(text) : text);

  return (
    <View>
      <View style={styles.localeRow}>
        {(["en", "zh-TW", "zh-CN"] as const).map((item) => (
          <Pressable
            key={item}
            style={[styles.localeChip, locale === item ? styles.localeChipActive : undefined]}
            onPress={() => onLocaleChange(item)}
            accessibilityRole="button"
            accessibilityState={{ selected: locale === item }}
            accessibilityLabel={getLocalePickerLabel(item)}
          >
            <Text style={[styles.localeChipLabel, locale === item ? styles.localeChipLabelActive : undefined]}>
              {getLocalePickerLabel(item)}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.title}>
        {locale === "en" ? "What kind of support do you need most?" : zhText("你最需要哪一种陪伴？")}
      </Text>

      <View style={styles.cardList}>
        {options.map((option) => {
          const selected = selectedNeeds.includes(option.id);
          return (
            <Pressable
              key={option.id}
              onPress={() => onToggleNeed(option.id)}
              style={[styles.card, selected ? styles.cardSelected : styles.cardIdle]}
            >
              <View style={[styles.iconWrap, selected ? styles.iconWrapSelected : undefined]}>
                <MaterialCommunityIcons
                  name={mapNeedIcon(option.icon)}
                  size={20}
                  color={selected ? LOGO_YELLOW : "rgba(28, 20, 16, 0.62)"}
                />
              </View>
              <View style={styles.textWrap}>
                <Text style={styles.cardTitle}>{option.title}</Text>
                <Text style={styles.cardDesc}>{option.description}</Text>
              </View>
              <MaterialCommunityIcons
                name={selected ? "check-circle" : "checkbox-blank-circle-outline"}
                size={22}
                color={selected ? LOGO_YELLOW : "rgba(138, 90, 11, 0.45)"}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  localeRow: {
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  localeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(120, 53, 15, 0.24)",
    backgroundColor: "rgba(255, 252, 245, 0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  localeChipActive: {
    borderColor: "rgba(255, 177, 1, 0.86)",
    backgroundColor: "rgba(255, 177, 1, 0.16)",
  },
  localeChipLabel: {
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(43, 29, 21, 0.72)",
    fontWeight: "600",
  },
  localeChipLabelActive: {
    color: LOGO_YELLOW,
  },
  title: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "700",
    color: "#2b1d15",
    letterSpacing: 0.2,
    textAlign: "center",
  },
  cardList: {
    marginTop: 14,
    gap: 10,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.07,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
      android: {
        elevation: 0,
      },
    }),
  },
  cardIdle: {
    backgroundColor: "rgba(255, 252, 245, 0.9)",
    borderColor: "rgba(120, 53, 15, 0.18)",
  },
  cardSelected: {
    backgroundColor: "rgba(255, 236, 191, 0.92)",
    borderColor: "rgba(255, 177, 1, 0.9)",
    borderWidth: 2,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 251, 241, 0.85)",
  },
  iconWrapSelected: {
    backgroundColor: "rgba(255, 177, 1, 0.22)",
  },
  textWrap: {
    flex: 1,
    backgroundColor: "transparent",
  },
  cardTitle: {
    fontSize: 16,
    lineHeight: 22,
    color: theme.ink,
    fontWeight: "600",
  },
  cardDesc: {
    marginTop: 3,
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(43, 29, 21, 0.76)",
  },
});
