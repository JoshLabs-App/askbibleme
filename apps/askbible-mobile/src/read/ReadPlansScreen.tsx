import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { t, tFormat } from "../i18n/site-copy";
import { ReadParchmentPageScroll } from "./ReadParchmentPageScroll";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { fetchReadingPlanRegistry } from "./reading-plan/fetch-reading-plan-registry";
import { isTripleLoopPlanId } from "./reading-plan/triple-loop-plan";
import { stripReadingPlanHtml } from "./reading-plan/strip-html";
import type { ReadingPlanRegistryEntry } from "./reading-plan/types";
import { useEffectiveReadingPlanPrefs } from "./reading-plan/useReadingPlanStores";

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
        <Text style={styles.lead}>{t("pages.read.plansLead")}</Text>

        {loading ? (
          <ActivityIndicator color={c.muted} style={{ marginTop: 32 }} />
        ) : plans.length === 0 ? (
          <Text style={styles.empty}>{t("pages.read.plansEmpty")}</Text>
        ) : (
          <View style={styles.list}>
            {plans.map((p) => {
              const titleZh = trPlanField(p.planId, "title") || p.name;
              const title = isTripleLoopPlanId(p.planId) ? `${titleZh}（推荐）` : titleZh;
              const subtitle = trPlanField(p.planId, "subtitle");
              const blurb = trPlanField(p.planId, "blurb");
              const isActive = prefs.planId === p.planId;
              return (
                <Pressable
                  key={p.planId}
                  onPress={() => openPlan(p.planId)}
                  style={({ pressed }) => [styles.card, pressed && styles.pressed, isActive && styles.cardActive]}
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
                        {isTripleLoopPlanId(p.planId)
                          ? t("pages.read.tripleLoopPlansMeta")
                          : tFormat("pages.read.plansMeta", {
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
  empty: {
    marginTop: 40,
    fontSize: 14,
    color: c.muted,
    textAlign: "center",
  },
  list: { marginTop: 28, gap: 12 },
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
