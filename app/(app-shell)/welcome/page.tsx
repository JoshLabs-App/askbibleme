"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback } from "react";
import { ExploreParchmentChrome } from "@/components/explore/ExploreParchmentChrome";
import { OnboardingDevotionIntro } from "@/components/onboarding/OnboardingDevotionIntro";
import { WEB_APP_HOME_PATH } from "@/lib/web-app-home-path";

/** 对齐 App `/welcome`：欢迎 / 引导页（非 Tab 栈）。 */
function WelcomePageBody() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isGate = searchParams.get("gate") === "1";

  const handleComplete = useCallback(() => {
    if (!isGate && typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.replace(WEB_APP_HOME_PATH);
  }, [isGate, router]);

  return (
    <ExploreParchmentChrome>
      <OnboardingDevotionIntro onComplete={handleComplete} />
    </ExploreParchmentChrome>
  );
}

/** `useSearchParams` 要求外面有 Suspense 边界；壳布局不再读请求后本页会被静态预渲染。 */
export default function WelcomePage() {
  return (
    <Suspense fallback={null}>
      <WelcomePageBody />
    </Suspense>
  );
}
