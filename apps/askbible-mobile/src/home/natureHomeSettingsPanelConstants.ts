import type { ComponentProps } from "react";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { NatureHomeTtsLevel } from "./natureHomePrefs";

export type MaterialIconName = ComponentProps<typeof MaterialIcons>["name"];

/** Modal 默认可竖屏；横屏沉浸时用 `overlay` 避免 iOS 把界面扭回竖屏 */
export type NatureHomeSettingsPresentation = "modal" | "overlay";

export const MODAL_SUPPORTED_ORIENTATIONS = [
  "portrait",
  "portrait-upside-down",
  "landscape",
  "landscape-left",
  "landscape-right",
] as const;

export const ICON_MUTED = "#765b42";

export const TTS_LEVELS: readonly NatureHomeTtsLevel[] = [0, 1, 2, 3, 4];

export type DeviceVoice = { identifier: string; name: string; language: string };
