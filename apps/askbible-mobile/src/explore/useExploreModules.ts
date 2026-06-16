import { useSyncExternalStore } from "react";
import { InteractionManager } from "react-native";
import {
  getActiveExploreModulesBundle,
  hydrateExploreModulesFromDisk,
  refreshExploreModulesInBackground,
  subscribeExploreModulesBundle,
} from "./fetchExploreModules";
import type { ExploreModulesBundle } from "./exploreModulesBundleCore";

let diskHydrated = false;

function hydrateExploreModulesOnce(): void {
  if (diskHydrated) return;
  diskHydrated = true;
  void hydrateExploreModulesFromDisk();
}

export function refreshExploreModulesWhenFocused(): void {
  hydrateExploreModulesOnce();
  InteractionManager.runAfterInteractions(() => {
    refreshExploreModulesInBackground();
  });
}

export function useExploreModulesBundle(): ExploreModulesBundle {
  return useSyncExternalStore(
    subscribeExploreModulesBundle,
    getActiveExploreModulesBundle,
    getActiveExploreModulesBundle,
  );
}
