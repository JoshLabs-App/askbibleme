import { Pressable, Text } from "react-native";
import { shellNavDrawerStyles as styles } from "./shellNavDrawerStyles";

type Props = {
  label: string;
  onPress: () => void;
  detail?: string;
  selected?: boolean;
  quiet?: boolean;
};

export function ShellNavDrawerMenuRow({ label, onPress, detail, selected, quiet }: Props) {
  const hasDetail = Boolean(detail);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        hasDetail && styles.rowInline,
        selected && styles.rowSelected,
        quiet && styles.rowQuiet,
        pressed && styles.rowPressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
    >
      <Text
        style={[styles.rowText, hasDetail && styles.rowTextInline, quiet && styles.rowTextQuiet]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {detail ? (
        <Text
          style={[
            styles.rowDetail,
            styles.rowDetailInline,
            selected && styles.rowDetailSelected,
          ]}
          numberOfLines={1}
        >
          {detail}
        </Text>
      ) : null}
    </Pressable>
  );
}
