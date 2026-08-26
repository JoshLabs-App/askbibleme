import { HeaderBackButton } from "@react-navigation/elements";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { t } from "../i18n/site-copy";
import { readParchmentTheme as c } from "../read/readParchmentTheme";

type Props = {
  onPress: () => void;
  /** 羊皮卷页用 ink；章页白底图标用 `#FFFFFF` */
  tintColor?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * 全 App 共用系统返回：React Navigation `HeaderBackButton`（iOS 默认 chevron）。
 * 不要再各页自定义「← 文案」或 Material 箭头。
 */
export function ShellSystemBackButton({
  onPress,
  tintColor = c.ink,
  accessibilityLabel,
  disabled,
  style,
}: Props) {
  return (
    <HeaderBackButton
      onPress={onPress}
      tintColor={tintColor}
      displayMode="minimal"
      accessibilityLabel={accessibilityLabel ?? t("pages.read.chapterChromeBack")}
      disabled={disabled}
      style={[styles.btn, style]}
    />
  );
}

const styles = StyleSheet.create({
  btn: {
    marginHorizontal: 0,
    marginVertical: 0,
    alignSelf: "flex-start",
  },
});
