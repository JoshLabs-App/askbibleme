import { useRouter } from "expo-router";
import { useEffect } from "react";
import { completeOnboardingDevotionIntro } from "../../src/onboarding/onboarding-devotion-prefs";

/** __DEV__ only — Maestro 冒烟前置：标记欢迎页完成并回首页。 */
export default function DevMaestroSmokePrepScreen() {
  const router = useRouter();

  useEffect(() => {
    if (!__DEV__) {
      router.replace("/");
      return;
    }
    void completeOnboardingDevotionIntro([]).finally(() => {
      router.replace("/");
    });
  }, [router]);

  return null;
}
