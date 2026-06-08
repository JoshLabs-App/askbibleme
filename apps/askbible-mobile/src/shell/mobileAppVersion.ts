import Constants from "expo-constants";
import { Platform } from "react-native";

/** 侧栏底部版本号：1.0.0 (18) — 与 app.json / 原生 build 对齐。 */
export function getMobileAppVersionLabel(): string {
  const version =
    Constants.expoConfig?.version?.trim() ||
    Constants.nativeApplicationVersion?.trim() ||
    "—";
  const build =
    Platform.OS === "ios"
      ? Constants.expoConfig?.ios?.buildNumber?.trim() || Constants.nativeBuildVersion?.trim() || ""
      : String(
          Constants.expoConfig?.android?.versionCode ??
            Constants.nativeBuildVersion ??
            "",
        ).trim();
  return build ? `${version} (${build})` : version;
}
