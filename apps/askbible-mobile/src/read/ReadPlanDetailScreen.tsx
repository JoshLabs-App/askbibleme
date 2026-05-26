import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { t } from "../i18n/site-copy";
import { ReadParchmentPageScroll } from "./ReadParchmentPageScroll";
import { ReadPlanActivateControl } from "./ReadPlanActivateControl";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { fetchReadingPlanRegistry } from "./reading-plan/fetch-reading-plan-registry";
import { isTripleLoopPlanId } from "./reading-plan/triple-loop-plan";
import type { ReadingPlanRegistryEntry } from "./reading-plan/types";

function planFieldKey(planId: string, field: "title" | "subtitle" | "blurb"): string {
  return `pages.read.plansCatalog.${planId}.${field}`;
}

function trPlanField(planId: string, field: "title" | "subtitle" | "blurb"): string {
  const key = planFieldKey(planId, field);
  const v = t(key);
  return v === key ? "" : v;
}

export function ReadPlanDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ planId: string }>();
  const planId = String(Array.isArray(params.planId) ? params.planId[0] : params.planId || "").trim();

  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<ReadingPlanRegistryEntry | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const registry = await fetchReadingPlanRegistry();
      setPlan(registry.plans.find((p) => p.planId === planId) ?? null);
      setLoading(false);
    })();
  }, [planId]);

  const title = useMemo(() => {
    if (!plan) return planId;
    return trPlanField(plan.planId, "title") || plan.name;
  }, [plan, planId]);

  const blurb = plan ? trPlanField(plan.planId, "blurb") : "";

  return (
    <View style={styles.root}>
      <ReadParchmentPageScroll inset="sub">
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Text style={styles.backText}>{t("pages.read.catalogBack")}</Text>
        </Pressable>

        {loading ? (
          <ActivityIndicator color={c.muted} style={{ marginTop: 40 }} />
        ) : !plan ? (
          <Text style={styles.empty}>{t("pages.read.plansEmpty")}</Text>
        ) : (
          <>
            <Text style={styles.title}>{title}</Text>
            {blurb ? <Text style={styles.lead}>{blurb}</Text> : null}
            {isTripleLoopPlanId(plan.planId) ? (
              <Text style={styles.tripleHint}>{t("pages.read.tripleLoopActivateHint")}</Text>
            ) : null}
            <ReadPlanActivateControl planId={plan.planId} dayCount={plan.dayCount} />
            <Pressable
              onPress={() => router.push("/read")}
              style={({ pressed }) => [styles.homeLink, pressed && styles.pressed]}
            >
              <Text style={styles.homeLinkText}>{t("pages.read.todayPlanSeeHome")}</Text>
            </Pressable>
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
    fontSize: 24,
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
  tripleHint: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 20,
    color: c.muted,
    textAlign: "center",
  },
  empty: { marginTop: 40, fontSize: 14, color: c.muted, textAlign: "center" },
  homeLink: { marginTop: 20, alignSelf: "center" },
  homeLinkText: { fontSize: 12, color: c.muted, textDecorationLine: "underline" },
  pressed: { opacity: 0.88 },
});
