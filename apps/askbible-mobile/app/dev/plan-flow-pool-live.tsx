import { useRouter } from "expo-router";
import { useEffect } from "react";
import { runPlanFlowPoolLiveVerify } from "../../src/read/planFlowPoolLiveVerify";

/** __DEV__ — `askbible://dev/plan-flow-pool-live` 真机播放池 0→1 验证 */
export default function DevPlanFlowPoolLiveScreen() {
  const router = useRouter();

  useEffect(() => {
    if (!__DEV__) {
      router.replace("/");
      return;
    }
    void runPlanFlowPoolLiveVerify(router).finally(() => {
      router.replace("/read");
    });
  }, [router]);

  return null;
}
