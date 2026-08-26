import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { StyleProp, TextStyle } from "react-native";
import { shellIconTextShadow } from "./shellChromeIcons";

export type ShellMaterialIconName = keyof typeof MaterialIcons.glyphMap;

type Props = {
  name: ShellMaterialIconName;
  size: number;
  color: string;
  style?: StyleProp<TextStyle>;
  /** 白图标浮层默认开；羊皮正文旁墨色图标可关 */
  shadow?: boolean;
};

/** 壳层 Material 图标：与 iOS 同款 textShadow（双平台同参） */
export function ShellMaterialIcon({ name, size, color, style, shadow = true }: Props) {
  return (
    <MaterialIcons
      name={name}
      size={size}
      color={color}
      style={[shadow ? shellIconTextShadow() : null, style]}
    />
  );
}
