import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { StyleSheet, Text, View } from "react-native";
import type { AppLocale } from "../i18n/config";
import { toZhTwText } from "../i18n/site-copy";
import { SPLASH_BACKGROUND as LOGO_YELLOW } from "../shell/splash-branding.generated";
import { theme } from "../theme";
import type { SolutionCard } from "./onboarding-devotion-data";

type OnboardingSolutionStepProps = {
  locale: AppLocale;
  cards: SolutionCard[];
};

export function OnboardingSolutionStep({ locale, cards }: OnboardingSolutionStepProps) {
  const zhText = (text: string) => (locale === "zh-TW" ? toZhTwText(text) : text);

  return (
    <View>
      <Text style={styles.title}>{locale === "en" ? "What Makes Us Different" : zhText("这里与众不同")}</Text>
      <Text style={styles.subtitle}>
        {locale === "en"
          ? "No pressure. No performance. With devotional music and Scripture support, you can always return to God's Word."
          : zhText("不靠压力，不靠打卡；用音乐灵修 + 经文支持，帮你稳定地回到神的话语。")}
      </Text>

      <View style={styles.cardList}>
        {cards.map((card) => {
          return (
            <View key={card.id} style={styles.card}>
              <View style={styles.iconWrap}>
                <MaterialCommunityIcons name={mapSolutionIcon(card.icon)} size={22} color={LOGO_YELLOW} />
              </View>
              <View style={styles.textWrap}>
                <Text style={styles.cardTitle}>{card.title}</Text>
                <Text style={styles.cardDesc}>{card.description}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function mapSolutionIcon(name: string): keyof typeof MaterialCommunityIcons.glyphMap {
  switch (name) {
    case "music":
      return "music-clef-treble";
    case "candle":
      return "candle";
    case "book":
      return "book-open-page-variant-outline";
    case "search":
      return "magnify";
    default:
      return "circle-outline";
  }
}

const styles = StyleSheet.create({
  title: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700",
    color: "#2b1d15",
    letterSpacing: 0.2,
    textAlign: "center",
  },
  cardList: {
    marginTop: 14,
    gap: 10,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    color: "rgba(43, 29, 21, 0.74)",
    paddingHorizontal: 8,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(120, 53, 15, 0.2)",
    backgroundColor: "rgba(255, 252, 245, 0.88)",
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 177, 1, 0.16)",
  },
  textWrap: {
    flex: 1,
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
