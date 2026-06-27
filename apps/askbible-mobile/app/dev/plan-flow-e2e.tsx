import { useRouter } from "expo-router";
import { useEffect } from "react";
import { runPlanFlowDevE2E } from "../../src/read/planFlowDevE2ERunner";

/** __DEV__ only — `askbible://dev/plan-flow-e2e` */
export default function DevPlanFlowE2EScreen() {
  const router = useRouter();

  useEffect(() => {
    if (!__DEV__) {
      router.replace("/");
      return;
    }
    void runPlanFlowDevE2E(router).finally(() => {
      router.replace("/read");
    });
  }, [router]);

  return null;
}
