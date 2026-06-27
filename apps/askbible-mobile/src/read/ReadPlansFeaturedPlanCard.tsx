import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { t } from "../i18n/site-copy";
import { parchmentSans } from "../fonts/parchmentType";
import { exploreArticleRoute } from "../explore/exploreFeaturedArticles";
import { SPLASH_BACKGROUND as LOGO_YELLOW } from "../shell/splash-branding.generated";
import { readParchmentTheme as c } from "./readParchmentTheme";
import {
  isNtDeepRepeatPlanId,
  NT_DEEP_REPEAT_EXPLORE_ARTICLE_SLUG,
} from "./reading-plan/nt-deep-repeat-plan";
import { isTripleLoopPlanId } from "./reading-plan/triple-loop-plan";
import type { ReadingPlanRegistryEntry } from "./reading-plan/types";

type Props = {
  plan: ReadingPlanRegistryEntry;
  title: string;
  subtitle: string;
  blurb: string;
  isActive: boolean;
  onPress: () => void;
};

export function ReadPlansFeaturedPlanCard({
  plan,
  title,
  subtitle,
  blurb,
  isActive,
  onPress,
}: Props) {
  const router = useRouter();
  const isNtDeep = isNtDeepRepeatPlanId(plan.planId);
  const isTripleLoop = isTripleLoopPlanId(plan.planId);
  const methodBadge = isNtDeep
    ? t("pages.read.plansMethodPath2Badge")
    : t("pages.read.plansMethodPath1Badge");
  const methodLead = isNtDeep
    ? t("pages.read.plansMethodPath2Lead")
    : t("pages.read.plansMethodPath1Lead");

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        isNtDeep ? styles.cardNtDeep : styles.cardTripleLoop,
        isActive && styles.cardActive,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.cardRow}>
        <View style={styles.cardBody}>
          <View style={styles.badgeRow}>
            <Text style={styles.methodBadge}>{methodBadge}</Text>
            {isNtDeep ? (
              <View style={styles.promoBadge}>
                <Text style={styles.promoBadgeText}>{t("pages.read.plansFeaturedNtDeepPromo")}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.cardTitle}>{title}</Text>
          {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
          <Text style={styles.methodLead}>{methodLead}</Text>
          {blurb ? <Text style={styles.cardBlurb}>{blurb}</Text> : null}
          <Text style={styles.cardMeta}>
            {isTripleLoop
              ? t("pages.read.tripleLoopPlansMeta")
              : t("pages.read.ntDeepRepeatPlansMeta")}
          </Text>
          {isNtDeep ? (
            <Pressable
              onPress={() => router.push(exploreArticleRoute(NT_DEEP_REPEAT_EXPLORE_ARTICLE_SLUG))}
              hitSlop={8}
              style={styles.articleLinkWrap}
            >
              <Text style={styles.articleLink}>
                {t("pages.read.plansMethodPath2Reference")}{" "}
                {t("pages.read.plansMethodPath2ArticleLink")} →
              </Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.cardOpen}>{t("pages.read.plansOpen")}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardNtDeep: {
    backgroundColor: "rgba(255, 236, 191, 0.94)",
    borderColor: "rgba(255, 177, 1, 0.72)",
    borderWidth: 1.5,
  },
  cardTripleLoop: {
    backgroundColor: "rgba(255, 252, 245, 0.72)",
    borderColor: "rgba(120, 53, 15, 0.2)",
  },
  cardActive: {
    borderColor: "rgba(69, 45, 28, 0.42)",
  },
  cardRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  cardBody: { flex: 1, minWidth: 0 },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  methodBadge: {
    fontSize: 10,
    ...parchmentSans(600),
    letterSpacing: 1.1,
    color: "rgba(77, 53, 34, 0.68)",
  },
  promoBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "rgba(255, 177, 1, 0.28)",
  },
  promoBadgeText: {
    fontSize: 10,
    ...parchmentSans(600),
    color: "rgba(77, 53, 34, 0.88)",
  },
  cardTitle: { marginTop: 6, fontSize: 16, ...parchmentSans(600), color: c.ink },
  cardSubtitle: { marginTop: 4, fontSize: 12, color: c.muted },
  methodLead: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 20,
    color: "rgba(43, 29, 21, 0.84)",
    ...parchmentSans(500),
  },
  cardBlurb: { marginTop: 8, fontSize: 12, lineHeight: 18, color: c.muted },
  cardMeta: { marginTop: 10, fontSize: 11, color: c.faint },
  articleLinkWrap: { marginTop: 10, alignSelf: "flex-start" },
  articleLink: {
    fontSize: 11,
    lineHeight: 16,
    color: "rgba(77, 53, 34, 0.72)",
    textDecorationLine: "underline",
  },
  cardOpen: { fontSize: 11, ...parchmentSans(500), color: c.muted, paddingTop: 2 },
  pressed: { opacity: 0.92 },
});
