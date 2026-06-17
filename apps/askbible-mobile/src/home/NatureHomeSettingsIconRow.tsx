import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { ReactNode } from "react";
import { View } from "react-native";
import { ICON_MUTED, type MaterialIconName } from "./natureHomeSettingsPanelConstants";
import { natureHomeSettingsPanelStyles as styles } from "./natureHomeSettingsPanelStyles";

type Props = {
  icon: MaterialIconName;
  accessibilityLabel: string;
  children: ReactNode;
  alignTop?: boolean;
};

export function NatureHomeSettingsIconRow({ icon, accessibilityLabel, children, alignTop }: Props) {
  return (
    <View
      style={[styles.row, alignTop && styles.rowAlignTop]}
      accessibilityLabel={accessibilityLabel}
      accessible
    >
      <View style={styles.rowIcon} importantForAccessibility="no-hide-descendants">
        <MaterialIcons name={icon} size={18} color={ICON_MUTED} />
      </View>
      <View style={styles.rowBody}>{children}</View>
    </View>
  );
}
