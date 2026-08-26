"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { ExploreParchmentChrome } from "@/components/explore/ExploreParchmentChrome";
import { OnboardingDevotionIntro } from "@/components/onboarding/OnboardingDevotionIntro";

/** 对齐 App `/welcome`：欢迎 / 引导页（非 Tab 栈）。 */
export default function WelcomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isGate = searchParams.get("gate") === "1";

  const handleComplete = useCallback(() => {
    if (!isGate && typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.replace("/");
  }, [isGate, router]);

  return (
    <ExploreParchmentChrome>
      <OnboardingDevotionIntro onComplete={handleComplete} />
    </ExploreParchmentChrome>
  );
}
