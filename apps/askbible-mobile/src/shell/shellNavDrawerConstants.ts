import { Dimensions, Easing } from "react-native";
import type { NatureHomeTtsLevel } from "../home/natureHomePrefs";

export const DRAWER_ANIM_MS = 300;
export const DRAWER_EASING = Easing.out(Easing.cubic);
export const SUPPORT_EMAIL = "askbibleme@gmail.com";
export const TTS_LEVELS: readonly NatureHomeTtsLevel[] = [0, 1, 2, 3, 4];
export const shellNavDrawerParchmentSource = require("../../assets/images/read-parchment-scroll-bg.jpg");

export function shellNavDrawerWidth(): number {
  const w = Dimensions.get("window").width;
  return Math.min(360, Math.max(280, w - 28));
}
