import { Platform } from "react-native";

/** Android 上对 Video 父层使用 native driver 的 opacity/transform 会导致画面黑屏。 */
export const SHELL_VIDEO_ANIM_NATIVE_DRIVER = Platform.OS !== "android";
