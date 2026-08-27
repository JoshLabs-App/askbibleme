import { Platform, UIManager } from "react-native";

export function nativeMaskedViewAvailable(): boolean {
  if (Platform.OS === "web") return false;
  return (
    typeof UIManager.hasViewManagerConfig === "function" &&
    UIManager.hasViewManagerConfig("RNCMaskedView")
  );
}
