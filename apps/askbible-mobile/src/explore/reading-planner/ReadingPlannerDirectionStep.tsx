import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { AppLocale } from "../../i18n/config";
import { toZhTwText } from "../../i18n/site-copy";
import { SPLASH_BACKGROUND as LOGO_YELLOW } from "../../shell/splash-branding.generated";
import { theme } from "../../theme";
import { exploreArticleRoute } from "../exploreFeaturedArticles";
import type { ReadingPlannerDirectionCard } from "./reading-planner-data";
import { getReadingPlannerPathGuidance } from "./reading-planner-plan-copy";
import { READING_PLANNER_EXPLORE_ARTICLE_SLUG } from "./reading-planner-routes";

type Props = {
  locale: AppLocale;
  cards: ReadingPlannerDirectionCard[];
};

function mapIcon(name: string): keyof typeof MaterialCommunityIcons.glyphMap {
  switch (name) {
    case "magnify":
      return "magnify";
    case "book-open-page-variant-outline":
      return "book-open-page-variant-outline";
    case "candle":
      return "candle";
    case "heart-outline":
      return "heart-outline";
    default:
      return "circle-outline";
  }
}

export function ReadingPlannerDirectionStep({ locale, cards }: Props) {
  const router = useRouter();
  const zhText = (text: string) => (locale === "zh-TW" ? toZhTwText(text) : text);
  const pathGuidance = getReadingPlannerPathGuidance(locale);

  return (
    <View>
      <Text style={styles.title}>{locale === "en" ? "Easy reading, your way" : zhText("轻松读经，按你的节奏")}</Text>
      <Text style={styles.subtitle}>
        {locale === "en"
          ? "No streaks or guilt—pick light daily reading or formal study when you are ready."
          : zhText("不靠打卡、不靠压力；想毫无负担地读，或想正式研读读懂圣经，都可以。")}
      </Text>

      <View style={styles.cardList}>
        {cards.map((card) => (
          <View key={card.id} style={styles.card}>
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons name={mapIcon(card.icon)} size={22} color={LOGO_YELLOW} />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardDesc}>{card.description}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.pathHintBox}>
        <Text style={styles.pathHintLead}>{pathGuidance.lead}</Text>
        <Text style={styles.pathHintLine}>
          <Text style={styles.pathHintLabel}>{pathGuidance.newcomerLabel} · </Text>
          {pathGuidance.newcomerBody}
        </Text>
        <Text style={[styles.pathHintLine, styles.pathHintLineAccent]}>
          <Text style={styles.pathHintLabelAccent}>{pathGuidance.deepReadLabel} · </Text>
          {pathGuidance.deepReadBody}
        </Text>
      </View>

      <Pressable
        onPress={() => router.push(exploreArticleRoute(READING_PLANNER_EXPLORE_ARTICLE_SLUG))}
        hitSlop={8}
        style={styles.learnMoreWrap}
      >
        <Text style={styles.learnMore}>
          {locale === "en" ? "Learn more about easy reading →" : zhText("了解更多轻松读经 →")}
        </Text>
      </Pressable>
    </View>
  );
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
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    color: "rgba(43, 29, 21, 0.74)",
    paddingHorizontal: 8,
  },
  cardList: {
    marginTop: 14,
    gap: 10,
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
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 177, 1, 0.16)",
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
  pathHintBox: {
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 177, 1, 0.35)",
    backgroundColor: "rgba(255, 248, 230, 0.72)",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  pathHintLead: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "600",
    color: "rgba(43, 29, 21, 0.82)",
    textAlign: "center",
  },
  pathHintLine: {
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(43, 29, 21, 0.76)",
  },
  pathHintLineAccent: {
    color: "rgba(43, 29, 21, 0.86)",
  },
  pathHintLabel: {
    fontWeight: "700",
    color: "rgba(43, 29, 21, 0.78)",
  },
  pathHintLabelAccent: {
    fontWeight: "700",
    color: theme.ink,
  },
  learnMoreWrap: {
    marginTop: 14,
    alignSelf: "center",
  },
  learnMore: {
    fontSize: 13,
    lineHeight: 20,
    color: "rgba(77, 53, 34, 0.82)",
    textDecorationLine: "underline",
  },
});
