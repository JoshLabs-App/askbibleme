import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { t, tFormat } from "../i18n/site-copy";
import { ReadParchmentPageScroll } from "./ReadParchmentPageScroll";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { fetchReadingPlanRegistry } from "./reading-plan/fetch-reading-plan-registry";
import {
  isFeaturedReadingPlanId,
  partitionReadingPlanCatalog,
} from "./reading-plan/featured-reading-plans";
import { isNtDeepRepeatPlanId } from "./reading-plan/nt-deep-repeat-plan";
import { isTripleLoopPlanId } from "./reading-plan/triple-loop-plan";
import { stripReadingPlanHtml } from "./reading-plan/strip-html";
import type { ReadingPlanRegistryEntry } from "./reading-plan/types";
import { useEffectiveReadingPlanPrefs } from "./reading-plan/useReadingPlanStores";
import { ReadPlansFeaturedPlanCard } from "./ReadPlansFeaturedPlanCard";

function planFieldKey(planId: string, field: "title" | "subtitle" | "blurb"): string {
  return `pages.read.plansCatalog.${planId}.${field}`;
}

function trPlanField(planId: string, field: "title" | "subtitle" | "blurb"): string {
  const key = planFieldKey(planId, field);
  const v = t(key);
  return v === key ? "" : v;
}

export function ReadPlansScreen() {
  const router = useRouter();
  const { prefs } = useEffectiveReadingPlanPrefs();
  const [plans, setPlans] = useState<ReadingPlanRegistryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const registry = await fetchReadingPlanRegistry();
      setPlans(registry.plans);
      setLoading(false);
    })();
  }, []);

  const { featured, other } = useMemo(() => partitionReadingPlanCatalog(plans), [plans]);

  const openPlan = useCallback(
    (planId: string) => {
      router.push({ pathname: "/read/plans/[planId]", params: { planId } });
    },
    [router],
  );

  return (
    <View style={styles.root}>
      <ReadParchmentPageScroll inset="sub">
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Text style={styles.backText}>{t("pages.read.catalogBack")}</Text>
        </Pressable>

        <Text style={styles.title}>{t("pages.read.plansTitle")}</Text>
        <Text style={styles.lead}>{t("pages.read.plansLeadIntro")}</Text>

        {loading ? (
          <ActivityIndicator color={c.muted} style={{ marginTop: 32 }} />
        ) : plans.length === 0 ? (
          <Text style={styles.empty}>{t("pages.read.plansEmpty")}</Text>
        ) : (
          <>
            <View style={styles.featuredList}>
              {featured.map((p) => (
                <ReadPlansFeaturedPlanCard
                  key={p.planId}
                  plan={p}
                  title={trPlanField(p.planId, "title") || p.name}
                  subtitle={trPlanField(p.planId, "subtitle")}
                  blurb={trPlanField(p.planId, "blurb")}
                  isActive={prefs.planId === p.planId}
                  onPress={() => openPlan(p.planId)}
                />
              ))}
            </View>

            {other.length ? (
              <>
                <Text style={styles.leadOther}>{t("pages.read.plansLeadOther")}</Text>
                <View style={styles.list}>
                  {other.map((p) => {
                    const title = trPlanField(p.planId, "title") || p.name;
                    const subtitle = trPlanField(p.planId, "subtitle");
                    const blurb = trPlanField(p.planId, "blurb");
                    const isActive = prefs.planId === p.planId;
                    return (
                      <Pressable
                        key={p.planId}
                        onPress={() => openPlan(p.planId)}
                        style={({ pressed }) => [
                          styles.card,
                          pressed && styles.pressed,
                          isActive && styles.cardActive,
                        ]}
                      >
                        <View style={styles.cardRow}>
                          <View style={styles.cardBody}>
                            <Text style={styles.cardTitle}>{title}</Text>
                            {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
                            {blurb ? (
                              <Text style={styles.cardBlurb} numberOfLines={4}>
                                {blurb}
                              </Text>
                            ) : p.description ? (
                              <Text style={styles.cardBlurb} numberOfLines={3}>
                                {stripReadingPlanHtml(p.description)}
                              </Text>
                            ) : null}
                            <Text style={styles.cardMeta}>
                              {tFormat("pages.read.plansMeta", {
                                days: p.dayCount,
                                max: p.maxReadingsPerDay,
                              })}
                            </Text>
                          </View>
                          <Text style={styles.cardOpen}>{t("pages.read.plansOpen")}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}
          </>
        )}
      </ReadParchmentPageScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "transparent" },
  back: { alignSelf: "flex-start", marginBottom: 16 },
  backText: { fontSize: 11, ...parchmentSans(500), letterSpacing: 1, color: c.muted },
  title: {
    fontSize: 26,
    ...parchmentSans(600),
    color: c.ink,
    textAlign: "center",
  },
  lead: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 22,
    color: c.muted,
    textAlign: "center",
  },
  leadOther: {
    marginTop: 24,
    fontSize: 12,
    lineHeight: 18,
    color: c.faint,
  },
  empty: {
    marginTop: 40,
    fontSize: 14,
    color: c.muted,
    textAlign: "center",
  },
  featuredList: { marginTop: 20, gap: 12 },
  list: { marginTop: 12, gap: 12 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "rgba(255, 252, 245, 0.45)",
  },
  cardActive: { borderColor: "rgba(69, 45, 28, 0.35)" },
  cardRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 15, ...parchmentSans(600), color: c.ink },
  cardSubtitle: { marginTop: 4, fontSize: 12, color: c.muted },
  cardBlurb: { marginTop: 8, fontSize: 12, lineHeight: 18, color: c.muted },
  cardMeta: { marginTop: 8, fontSize: 11, color: c.faint },
  cardOpen: { fontSize: 11, ...parchmentSans(500), color: c.muted, paddingTop: 2 },
  pressed: { opacity: 0.9 },
});
