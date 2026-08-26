import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { ReadingPlanStartDayPicker } from "../../read/ReadingPlanStartDayPicker";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { AppLocale } from "../../i18n/config";
import { t, tFormat, toZhTwText } from "../../i18n/site-copy";
import { fetchReadingPlanRegistry } from "../../read/reading-plan/fetch-reading-plan-registry";
import { isFeaturedReadingPlanId } from "../../read/reading-plan/featured-reading-plans";
import {
  NT_DEEP_REPEAT_PACE_OPTIONS,
  type NtDeepRepeatPace,
} from "../../read/reading-plan/nt-deep-repeat-pace";
import { stripReadingPlanHtml } from "../../read/reading-plan/strip-html";
import type { ReadingPlanRegistryEntry } from "../../read/reading-plan/types";
import { SPLASH_BACKGROUND as LOGO_YELLOW } from "../../shell/splash-branding.generated";
import { theme } from "../../theme";
import { exploreArticleRoute } from "../exploreFeaturedArticles";
import {
  readingPlannerChoiceMaxStartDay,
  readingPlannerChoiceSupportsStartDay,
  type ReadingPlannerPlanChoice,
} from "./activateReadingPlanFromPlanner";
import {
  getNtDeepPacePlannerCopy,
  getReadingPlannerStep3Intro,
  getTripleLoopPlannerCopy,
} from "./reading-planner-plan-copy";

type Props = {
  locale: AppLocale;
  choice: ReadingPlannerPlanChoice;
  onChange: (next: ReadingPlannerPlanChoice) => void;
  startDay: number;
  onStartDayChange: (next: number) => void;
};

function planFieldKey(planId: string, field: "title" | "subtitle" | "blurb"): string {
  return `pages.read.plansCatalog.${planId}.${field}`;
}

function trPlanField(planId: string, field: "title" | "subtitle" | "blurb"): string {
  const key = planFieldKey(planId, field);
  const v = t(key);
  return v === key ? "" : v;
}

export function ReadingPlannerPlanStep({ locale, choice, onChange, startDay, onStartDayChange }: Props) {
  const router = useRouter();
  const zhText = (text: string) => (locale === "zh-TW" ? toZhTwText(text) : text);
  const [otherExpanded, setOtherExpanded] = useState(choice.type === "other");
  const [otherPlans, setOtherPlans] = useState<ReadingPlanRegistryEntry[]>([]);

  const supportsStartDay = readingPlannerChoiceSupportsStartDay(choice);
  const maxStartDay = readingPlannerChoiceMaxStartDay(choice);

  useEffect(() => {
    void fetchReadingPlanRegistry().then((registry) => {
      setOtherPlans(registry.plans.filter((p) => !isFeaturedReadingPlanId(p.planId)));
    });
  }, []);

  useEffect(() => {
    if (choice.type === "other") setOtherExpanded(true);
  }, [choice.type]);

  const paceTimeline = useMemo(() => [...NT_DEEP_REPEAT_PACE_OPTIONS], []);

  const tripleLoopCopy = useMemo(() => getTripleLoopPlannerCopy(locale), [locale]);
  const stepIntro = useMemo(() => getReadingPlannerStep3Intro(locale), [locale]);

  const selectNtDeep = (pace: NtDeepRepeatPace) => {
    onChange({ type: "nt-deep-repeat", pace });
  };

  const selectTripleLoop = () => {
    onChange({ type: "triple-loop" });
  };

  const selectOther = (plan: ReadingPlanRegistryEntry) => {
    onChange({ type: "other", planId: plan.planId, dayCount: plan.dayCount });
  };

  return (
    <View>
      <Text style={styles.title}>{stepIntro.title}</Text>
      <Text style={styles.subtitle}>{stepIntro.subtitle}</Text>

      <View style={styles.heroSection}>
        <Text style={styles.sectionLabel}>
          {locale === "en" ? "RECOMMENDED · EASY READING" : zhText("推荐 · 轻松读经")}
        </Text>
        <Pressable
          onPress={selectTripleLoop}
          style={[
            styles.paceCard,
            choice.type === "triple-loop" ? styles.paceCardSelected : styles.paceCardIdle,
          ]}
        >
          <View style={styles.paceHeader}>
            <Text style={styles.paceTitle}>{tripleLoopCopy.title}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {locale === "en" ? "Start here" : zhText("建议起步")}
              </Text>
            </View>
          </View>
          <Text style={styles.paceBody}>{tripleLoopCopy.body}</Text>
          <MaterialCommunityIcons
            name={choice.type === "triple-loop" ? "check-circle" : "checkbox-blank-circle-outline"}
            size={22}
            color={choice.type === "triple-loop" ? LOGO_YELLOW : "rgba(138, 90, 11, 0.45)"}
            style={styles.paceCheck}
          />
        </Pressable>
      </View>

      <View style={styles.altSection}>
        <Text style={styles.sectionLabelMuted}>
          {locale === "en" ? "FORMAL STUDY" : zhText("正式研读")}
        </Text>
        <View style={styles.paceList}>
          {paceTimeline.map((pace) => {
            const selected = choice.type === "nt-deep-repeat" && choice.pace === pace;
            const copy = getNtDeepPacePlannerCopy(locale, pace);
            return (
              <Pressable
                key={pace}
                onPress={() => selectNtDeep(pace)}
                style={[styles.paceCard, selected ? styles.paceCardSelected : styles.paceCardIdle]}
              >
                <View style={styles.paceHeader}>
                  <Text style={styles.paceTitle}>{copy.title}</Text>
                </View>
                <Text style={styles.paceBody}>{copy.body}</Text>
                {copy.reference ? (
                  <Pressable
                    onPress={() => router.push(exploreArticleRoute(copy.reference!.slug))}
                    hitSlop={6}
                    style={styles.paceReferenceWrap}
                  >
                    <Text style={styles.paceReference}>
                      {locale === "en"
                        ? `Reference · ${copy.reference.label} →`
                        : zhText(`参考探索 · ${copy.reference.label} →`)}
                    </Text>
                  </Pressable>
                ) : null}
                <MaterialCommunityIcons
                  name={selected ? "check-circle" : "checkbox-blank-circle-outline"}
                  size={22}
                  color={selected ? LOGO_YELLOW : "rgba(138, 90, 11, 0.45)"}
                  style={styles.paceCheck}
                />
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.otherSection}>
        <Pressable
          onPress={() => setOtherExpanded((v) => !v)}
          style={styles.otherToggle}
          accessibilityRole="button"
          accessibilityState={{ expanded: otherExpanded }}
        >
          <Text style={styles.otherToggleTitle}>
            {locale === "en" ? "Other reading plans (optional)" : zhText("其它读经计划（可选）")}
          </Text>
          <MaterialCommunityIcons
            name={otherExpanded ? "chevron-up" : "chevron-down"}
            size={22}
            color="rgba(77, 53, 34, 0.62)"
          />
        </Pressable>
        <Text style={styles.otherHint}>
          {locale === "en"
            ? "Common calendar-style plans. AskBible recommends easy reading above."
            : zhText("以下为常见表格式计划，可按需选用；我们更推荐上面的轻松读经。")}
        </Text>

        {otherExpanded ? (
          <View style={styles.otherList}>
            {otherPlans.map((plan) => {
              const selected =
                choice.type === "other" && choice.planId === plan.planId;
              const title = trPlanField(plan.planId, "title") || plan.name;
              return (
                <Pressable
                  key={plan.planId}
                  onPress={() => selectOther(plan)}
                  style={[styles.otherRow, selected ? styles.otherRowSelected : undefined]}
                >
                  <View style={styles.otherRowText}>
                    <Text style={styles.otherRowTitle} numberOfLines={2}>
                      {title}
                    </Text>
                    <Text style={styles.otherRowMeta}>
                      {tFormat("pages.read.plansMeta", {
                        days: plan.dayCount,
                        max: plan.maxReadingsPerDay,
                      })}
                    </Text>
                    {plan.description ? (
                      <Text style={styles.otherRowBlurb} numberOfLines={2}>
                        {trPlanField(plan.planId, "blurb") || stripReadingPlanHtml(plan.description)}
                      </Text>
                    ) : null}
                  </View>
                  <MaterialCommunityIcons
                    name={selected ? "check-circle" : "checkbox-blank-circle-outline"}
                    size={20}
                    color={selected ? LOGO_YELLOW : "rgba(138, 90, 11, 0.4)"}
                  />
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      {supportsStartDay ? (
        <ReadingPlanStartDayPicker
          locale={locale}
          value={startDay}
          max={maxStartDay}
          onChange={onStartDayChange}
        />
      ) : null}
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
    paddingHorizontal: 2,
  },
  heroSection: {
    marginTop: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.1,
    color: LOGO_YELLOW,
  },
  sectionLabelMuted: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    color: "rgba(77, 53, 34, 0.55)",
  },
  paceList: {
    marginTop: 10,
    gap: 10,
  },
  paceCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    paddingRight: 44,
    position: "relative",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
      },
      android: { elevation: 0 },
    }),
  },
  paceCardIdle: {
    backgroundColor: "rgba(255, 252, 245, 0.92)",
    borderColor: "rgba(120, 53, 15, 0.2)",
  },
  paceCardSelected: {
    backgroundColor: "rgba(255, 236, 191, 0.94)",
    borderColor: "rgba(255, 177, 1, 0.92)",
    borderWidth: 2,
  },
  paceHeader: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  paceTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    color: theme.ink,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "rgba(255, 177, 1, 0.22)",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(77, 53, 34, 0.88)",
  },
  paceBody: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: "rgba(43, 29, 21, 0.8)",
  },
  paceReferenceWrap: {
    marginTop: 8,
  },
  paceReference: {
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(77, 53, 34, 0.72)",
    textDecorationLine: "underline",
  },
  paceCheck: {
    position: "absolute",
    right: 14,
    top: "50%",
    marginTop: -11,
  },
  altSection: {
    marginTop: 18,
  },
  otherSection: {
    marginTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(120, 53, 15, 0.18)",
    paddingTop: 14,
  },
  otherToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  otherToggleTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(77, 53, 34, 0.78)",
  },
  otherHint: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(77, 53, 34, 0.58)",
  },
  otherList: {
    marginTop: 10,
    gap: 8,
  },
  otherRow: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(120, 53, 15, 0.14)",
    backgroundColor: "rgba(255, 252, 245, 0.55)",
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  otherRowSelected: {
    borderColor: "rgba(255, 177, 1, 0.65)",
    backgroundColor: "rgba(255, 236, 191, 0.4)",
  },
  otherRowText: { flex: 1 },
  otherRowTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(43, 29, 21, 0.88)",
  },
  otherRowMeta: {
    marginTop: 2,
    fontSize: 11,
    color: "rgba(77, 53, 34, 0.55)",
  },
  otherRowBlurb: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 16,
    color: "rgba(77, 53, 34, 0.58)",
  },
});
