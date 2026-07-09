import { useEffect } from "react";
import { ensureDefaultReadingPlanIfUnset } from "./reading-plan/ensure-default-reading-plan";

/** 冷启动：未选计划时写入默认方法二深读（7 天/阶），不依赖用户先进入读经 Tab。 */
export function ReadingPlanBootstrapBridge() {
  useEffect(() => {
    void ensureDefaultReadingPlanIfUnset().catch((err) => {
      if (__DEV__) console.warn("[ReadingPlanBootstrapBridge]", err);
    });
  }, []);
  return null;
}
