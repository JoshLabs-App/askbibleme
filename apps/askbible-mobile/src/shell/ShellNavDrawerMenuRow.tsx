import { Pressable, Text } from "react-native";
import { shellNavDrawerStyles as styles } from "./shellNavDrawerStyles";

type Props = {
  label: string;
  onPress: () => void;
  detail?: string;
  selected?: boolean;
  destructive?: boolean;
};

export function ShellNavDrawerMenuRow({ label, onPress, detail, selected, destructive }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
    >
      <Text style={[styles.rowText, destructive && styles.rowTextDestructive]}>{label}</Text>
      {detail ? (
        <Text
          style={[
            styles.rowDetail,
            selected && styles.rowDetailSelected,
            destructive && styles.rowDetailDestructive,
          ]}
        >
          {detail}
        </Text>
      ) : null}
    </Pressable>
  );
}
