import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { StyleProp, TextStyle } from "react-native";
import { shellIconTextShadow } from "./shellChromeIcons";

export type ShellMaterialIconName = keyof typeof MaterialIcons.glyphMap;

type Props = {
  name: ShellMaterialIconName;
  size: number;
  color: string;
  style?: StyleProp<TextStyle>;
};

/** 壳层 Material 图标：与 iOS 同款 textShadow（双平台同参） */
export function ShellMaterialIcon({ name, size, color, style }: Props) {
  return (
    <MaterialIcons name={name} size={size} color={color} style={[shellIconTextShadow(), style]} />
  );
}
