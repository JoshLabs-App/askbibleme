import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { AppLocale } from "../../i18n/config";
import { toZhTwText } from "../../i18n/site-copy";
import { SPLASH_BACKGROUND as LOGO_YELLOW } from "../../shell/splash-branding.generated";
import { theme } from "../../theme";
import type { ReadingPlannerPainOption } from "./reading-planner-data";
import type { ReadingPlannerPainId } from "./reading-planner-data";

type Props = {
  locale: AppLocale;
  options: ReadingPlannerPainOption[];
  selected: ReadingPlannerPainId[];
  onToggle: (id: ReadingPlannerPainId) => void;
};

function mapIcon(name: string): keyof typeof MaterialCommunityIcons.glyphMap {
  switch (name) {
    case "calendar-alert":
      return "calendar-alert";
    case "calendar-blank-outline":
      return "calendar-blank-outline";
    case "book-open-page-variant-outline":
      return "book-open-page-variant-outline";
    case "waveform":
      return "waveform";
    case "leaf":
      return "leaf";
    default:
      return "circle-outline";
  }
}

export function ReadingPlannerPainStep({ locale, options, selected, onToggle }: Props) {
  const zhText = (text: string) => (locale === "zh-TW" ? toZhTwText(text) : text);

  return (
    <View>
      <Text style={styles.title}>
        {locale === "en" ? "What gets in the way?" : zhText("读经时，什么最困扰你？")}
      </Text>
      <Text style={styles.subtitle}>
        {locale === "en"
          ? "Select any that resonate. This helps us suggest a rhythm—not to label you."
          : zhText("可多选，帮我们了解你的处境；不是为了给你贴标签。")}
      </Text>

      <View style={styles.cardList}>
        {options.map((option) => {
          const isSelected = selected.includes(option.id);
          return (
            <Pressable
              key={option.id}
              onPress={() => onToggle(option.id)}
              style={[styles.card, isSelected ? styles.cardSelected : styles.cardIdle]}
            >
              <View style={[styles.iconWrap, isSelected ? styles.iconWrapSelected : undefined]}>
                <MaterialCommunityIcons
                  name={mapIcon(option.icon)}
                  size={20}
                  color={isSelected ? LOGO_YELLOW : "rgba(28, 20, 16, 0.62)"}
                />
              </View>
              <View style={styles.textWrap}>
                <Text style={styles.cardTitle}>{option.title}</Text>
                <Text style={styles.cardDesc}>{option.description}</Text>
              </View>
              <MaterialCommunityIcons
                name={isSelected ? "check-circle" : "checkbox-blank-circle-outline"}
                size={22}
                color={isSelected ? LOGO_YELLOW : "rgba(138, 90, 11, 0.45)"}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "700",
    color: "#2b1d15",
    letterSpacing: 0.2,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    color: "rgba(43, 29, 21, 0.74)",
    paddingHorizontal: 4,
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
      android: { elevation: 0 },
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
  textWrap: { flex: 1 },
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
