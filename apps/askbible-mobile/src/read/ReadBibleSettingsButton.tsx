import { usePathname } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ShellMaterialIcon } from "../shell/ShellMaterialIcon";
import { isReadTypographySettingsPathname } from "../shell/shellPrimaryRoute";
import { t } from "../i18n/site-copy";
import { ReadBibleSettingsPanel } from "./ReadBibleSettingsPanel";
import { READ_TOP_CHROME, readTopChromeRightStyle } from "./readTopChrome";
import { trackTap } from "../telemetry/tap";

/** 读经栈右上设置：与搜索/收藏同一套顶栏尺寸与列对齐 */
export function ReadBibleSettingsButton() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  /** 首次打开再挂载面板，避免章页常驻吃 hooks/目录逻辑。 */
  const [panelMounted, setPanelMounted] = useState(false);

  if (!isReadTypographySettingsPathname(pathname)) return null;

  return (
    <>
      <Pressable
        onPress={() => {
          trackTap("read.settings");
          setPanelMounted(true);
          setOpen(true);
        }}
        style={({ pressed }) => [
          styles.btn,
          readTopChromeRightStyle(insets, 0),
          pressed && styles.pressed,
        ]}
        android_ripple={{
          color: "rgba(0,0,0,0.12)",
          borderless: true,
          radius: READ_TOP_CHROME.btnSize / 2,
        }}
        accessibilityRole="button"
        accessibilityLabel={t("pages.read.typography.ariaOpen")}
      >
        <ShellMaterialIcon
          name="settings"
          size={READ_TOP_CHROME.iconSize}
          color={READ_TOP_CHROME.iconColor}
        />
      </Pressable>
      {panelMounted ? (
        <ReadBibleSettingsPanel visible={open} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: "absolute",
    zIndex: 51,
    width: READ_TOP_CHROME.btnSize,
    height: READ_TOP_CHROME.btnSize,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: READ_TOP_CHROME.btnSize / 2,
  },
  pressed: {
    opacity: 0.86,
  },
});
