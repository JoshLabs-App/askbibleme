import { useCallback, useEffect } from "react";
import { InteractionManager } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  ensureDefaultReadingPlanIfUnset,
} from "./reading-plan/ensure-default-reading-plan";
import { syncTripleLoopPlanPrefsIfNeeded } from "./reading-plan/triple-loop-plan-sync";

export function ReadTripleLoopPlanSync() {
  useEffect(() => {
    void ensureDefaultReadingPlanIfUnset();
  }, []);

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        void syncTripleLoopPlanPrefsIfNeeded();
      });
      return () => task.cancel();
    }, []),
  );

  return null;
}
