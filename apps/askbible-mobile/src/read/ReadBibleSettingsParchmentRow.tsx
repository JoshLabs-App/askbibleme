import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { ComponentProps, ReactNode } from "react";
import { View } from "react-native";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { readBibleSettingsPanelStyles as styles } from "./readBibleSettingsPanelStyles";

type MaterialIconName = ComponentProps<typeof MaterialIcons>["name"];

export function ReadBibleSettingsParchmentRow({
  icon,
  children,
}: {
  icon: MaterialIconName;
  children: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <MaterialIcons name={icon} size={18} color={c.faint} />
      </View>
      <View style={styles.rowBody}>{children}</View>
    </View>
  );
}
