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

/** 被嵌在别的页面里（官网手机模型，DECISIONS D-15）：那里只是展示首页，不弹首次引导，也不改引导的完成状态。 */
function isEmbeddedInFrame(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function resolveInitialPhase(firstHintEnabled: boolean): GatePhase {
  if (isEmbeddedInFrame()) return "done";
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
