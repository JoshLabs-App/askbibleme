"use client";

import { useEffect, useMemo, useState } from "react";
import { FirstOpenHintGate } from "@/components/app-shell/FirstOpenHintGate";
import { OnboardingDevotionIntro } from "@/components/onboarding/OnboardingDevotionIntro";
import { subscribeOnboardingDevotionOpen } from "@/lib/onboarding/onboarding-devotion-gate";
import { shouldShowOnboardingDevotionIntro } from "@/lib/onboarding/onboarding-devotion-prefs";
import { shouldShowFirstOpenHint } from "@/lib/onboarding/first-open-hint-persistence";

function isFirstOpenHintEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FIRST_OPEN_HINT_ENABLED !== "0";
}

type GatePhase = "loading" | "first-hint" | "devotion" | "done";

function resolveInitialPhase(firstHintEnabled: boolean): GatePhase {
  if (firstHintEnabled && shouldShowFirstOpenHint()) return "first-hint";
  if (shouldShowOnboardingDevotionIntro()) return "devotion";
  return "done";
}

export function AppOnboardingGate() {
  const firstHintEnabled = useMemo(() => isFirstOpenHintEnabled(), []);
  const [phase, setPhase] = useState<GatePhase>("loading");

  useEffect(() => {
    setPhase(resolveInitialPhase(firstHintEnabled));
  }, [firstHintEnabled]);

  useEffect(() => {
    return subscribeOnboardingDevotionOpen(() => {
      setPhase("devotion");
    });
  }, []);

  const handleFirstHintDismiss = () => {
    if (shouldShowOnboardingDevotionIntro()) {
      setPhase("devotion");
      return;
    }
    setPhase("done");
  };

  if (phase === "loading" || phase === "done") return null;

  if (phase === "first-hint") {
    return <FirstOpenHintGate onDismiss={handleFirstHintDismiss} />;
  }

  return <OnboardingDevotionIntro onComplete={() => setPhase("done")} />;
}
