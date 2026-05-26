import { Text, TextInput } from "react-native";

let installed = false;

/**
 * 全局文本默认：
 * - 不再强制 Android 使用单一中文字库，交给系统字体回退补齐生僻字
 * - 全平台：禁用系统动态字体缩放，避免固定布局页在大字体下被撑乱
 */
export function installAndroidNotoTextDefaults(): void {
  if (installed) return;
  installed = true;

  type WithDefaultProps = {
    defaultProps?: { style?: unknown; allowFontScaling?: boolean; maxFontSizeMultiplier?: number };
  };
  const textCtor = Text as unknown as WithDefaultProps;
  textCtor.defaultProps = {
    ...textCtor.defaultProps,
    allowFontScaling: textCtor.defaultProps?.allowFontScaling ?? false,
    maxFontSizeMultiplier: textCtor.defaultProps?.maxFontSizeMultiplier ?? 1,
  };

  const inputCtor = TextInput as unknown as WithDefaultProps;
  inputCtor.defaultProps = {
    ...inputCtor.defaultProps,
    allowFontScaling: inputCtor.defaultProps?.allowFontScaling ?? false,
    maxFontSizeMultiplier: inputCtor.defaultProps?.maxFontSizeMultiplier ?? 1,
  };
}
