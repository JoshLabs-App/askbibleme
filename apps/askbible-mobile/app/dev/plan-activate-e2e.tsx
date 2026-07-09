import { useRouter } from "expo-router";
import { useEffect } from "react";
import { runPlanActivateDevE2E } from "../../src/read/planActivateDevE2ERunner";

/** __DEV__ only — `askbible://dev/plan-activate-e2e` */
export default function DevPlanActivateE2EScreen() {
  const router = useRouter();

  useEffect(() => {
    if (!__DEV__) {
      router.replace("/");
      return;
    }
    void runPlanActivateDevE2E().finally(() => {
      router.replace({ pathname: "/read/plans/[planId]", params: { planId: "nt-deep-repeat" } });
    });
  }, [router]);

  return null;
}
