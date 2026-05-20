import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t } from "../i18n/site-copy";
import { ReadBibleSettingsPanel } from "./ReadBibleSettingsPanel";
import { trackTap } from "../telemetry/tap";

const ICON = "#FFFFFF";

/** 读经栈右上：与网站 `ReadBibleTypographySettingsControl` 同位 */
export function ReadBibleSettingsButton() {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => {
          trackTap("read.settings");
          setOpen(true);
        }}
        style={[
          styles.btn,
          {
            top: insets.top + 6,
            right: Math.max(insets.right, 8),
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={t("pages.read.typography.ariaOpen")}
      >
        <MaterialIcons name="settings" size={22} color={ICON} style={styles.icon} />
      </Pressable>
      <ReadBibleSettingsPanel visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: "absolute",
    zIndex: 51,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  icon: {
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
});
