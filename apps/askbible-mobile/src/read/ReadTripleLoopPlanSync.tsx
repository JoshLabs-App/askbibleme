import { useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { syncTripleLoopPlanPrefsIfNeeded } from "./reading-plan/triple-loop-plan-sync";

export function ReadTripleLoopPlanSync() {
  useFocusEffect(
    useCallback(() => {
      void syncTripleLoopPlanPrefsIfNeeded();
    }, []),
  );

  return null;
}
