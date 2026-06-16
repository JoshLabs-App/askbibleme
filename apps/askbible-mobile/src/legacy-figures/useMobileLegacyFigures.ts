import { useSyncExternalStore } from "react";
import { InteractionManager } from "react-native";
import {
  getActiveMobileLegacyFiguresBundle,
  hydrateMobileLegacyFiguresFromDisk,
  refreshMobileLegacyFiguresInBackground,
  subscribeMobileLegacyFiguresBundle,
} from "./fetchMobileLegacyFigures";
import type { MobileLegacyFiguresBundle } from "./mobileLegacyFiguresBundleCore";

let diskHydrated = false;

function hydrateMobileLegacyFiguresOnce(): void {
  if (diskHydrated) return;
  diskHydrated = true;
  void hydrateMobileLegacyFiguresFromDisk();
}

export function refreshMobileLegacyFiguresWhenFocused(): void {
  hydrateMobileLegacyFiguresOnce();
  InteractionManager.runAfterInteractions(() => {
    refreshMobileLegacyFiguresInBackground();
  });
}

export function useMobileLegacyFiguresBundle(): MobileLegacyFiguresBundle {
  return useSyncExternalStore(
    subscribeMobileLegacyFiguresBundle,
    getActiveMobileLegacyFiguresBundle,
    getActiveMobileLegacyFiguresBundle,
  );
}
