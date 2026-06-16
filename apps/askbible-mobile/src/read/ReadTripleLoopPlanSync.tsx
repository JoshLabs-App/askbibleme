import { useCallback } from "react";
import { InteractionManager } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { syncTripleLoopPlanPrefsIfNeeded } from "./reading-plan/triple-loop-plan-sync";

export function ReadTripleLoopPlanSync() {
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
