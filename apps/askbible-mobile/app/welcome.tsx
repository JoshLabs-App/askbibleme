import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback } from "react";
import { ExploreParchmentPage } from "../src/explore/exploreParchmentStyles";
import { OnboardingDevotionIntro } from "../src/onboarding/OnboardingDevotionIntro";

/** 首次引导：根栈路由，不挂在 Explore Tab。 */
export default function WelcomeRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ gate?: string | string[] }>();
  const gateRaw = params.gate;
  const isGate = (Array.isArray(gateRaw) ? gateRaw[0] : gateRaw) === "1";

  const handleComplete = useCallback(() => {
    // 首次 gate 结束后回首页；从探索再开则返回上一页。
    if (!isGate && router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/");
  }, [isGate, router]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/");
  }, [router]);

  return (
    <ExploreParchmentPage>
      <OnboardingDevotionIntro
        onComplete={handleComplete}
        showBack={!isGate}
        onBack={handleBack}
      />
    </ExploreParchmentPage>
  );
}
