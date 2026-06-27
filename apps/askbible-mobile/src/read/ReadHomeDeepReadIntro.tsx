import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { t } from "../i18n/site-copy";
import { parchmentSans } from "../fonts/parchmentType";
import { exploreArticleRoute } from "../explore/exploreFeaturedArticles";
import { SPLASH_BACKGROUND as LOGO_YELLOW } from "../shell/splash-branding.generated";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { NT_DEEP_REPEAT_EXPLORE_ARTICLE_SLUG } from "./reading-plan/nt-deep-repeat-plan";

const POINT_KEYS = [
  "pages.read.homeDeepReadPoint1",
  "pages.read.homeDeepReadPoint2",
  "pages.read.homeDeepReadPoint3",
] as const;

export function ReadHomeDeepReadIntro() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <View style={styles.accentBar} />
        <Text style={styles.badge}>{t("pages.read.homeDeepReadBadge")}</Text>
        <Text style={styles.title} maxFontSizeMultiplier={1.12}>
          {t("pages.read.homeDeepReadTitle")}
        </Text>
        <Text style={styles.lead} maxFontSizeMultiplier={1.1}>
          {t("pages.read.homeDeepReadLead")}
        </Text>
        <View style={styles.points}>
          {POINT_KEYS.map((key) => (
            <View key={key} style={styles.pointRow}>
              <View style={styles.pointDot} />
              <Text style={styles.pointText} maxFontSizeMultiplier={1.08}>
                {t(key)}
              </Text>
            </View>
          ))}
        </View>
        <Pressable
          onPress={() => router.push(exploreArticleRoute(NT_DEEP_REPEAT_EXPLORE_ARTICLE_SLUG))}
          hitSlop={8}
          style={styles.linkWrap}
        >
          <Text style={styles.link} maxFontSizeMultiplier={1.08}>
            {t("pages.read.homeDeepReadLink")} →
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 177, 1, 0.42)",
    backgroundColor: "rgba(255, 248, 230, 0.88)",
    paddingHorizontal: 16,
    paddingVertical: 16,
    overflow: "hidden",
  },
  accentBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: LOGO_YELLOW,
  },
  badge: {
    fontSize: 10,
    letterSpacing: 1.15,
    ...parchmentSans(700),
    color: "rgba(77, 53, 34, 0.72)",
  },
  title: {
    marginTop: 6,
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: 0.2,
    ...parchmentSans(700),
    color: c.ink,
  },
  lead: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 22,
    color: "rgba(43, 29, 21, 0.86)",
    ...parchmentSans(500),
  },
  points: {
    marginTop: 12,
    gap: 10,
  },
  pointRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  pointDot: {
    marginTop: 7,
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: LOGO_YELLOW,
  },
  pointText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: "rgba(43, 29, 21, 0.82)",
    ...parchmentSans(500),
  },
  linkWrap: {
    marginTop: 14,
    alignSelf: "flex-start",
  },
  link: {
    fontSize: 13,
    ...parchmentSans(600),
    color: c.ink,
    textDecorationLine: "underline",
  },
});
