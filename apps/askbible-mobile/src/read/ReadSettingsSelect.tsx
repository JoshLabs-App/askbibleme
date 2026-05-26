import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "./readParchmentTheme";

export type ReadSettingsSelectOption = {
  id: string;
  label: string;
  shortLabel?: string;
};

type Props = {
  /** 极简模式不展示；仅保留无障碍 */
  label?: string;
  accessibilityLabel: string;
  value: string;
  options: ReadSettingsSelectOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (id: string) => void;
  disabled?: boolean;
  style?: View["props"]["style"];
};

export function ReadSettingsSelect({
  label,
  accessibilityLabel,
  value,
  options,
  open,
  onOpenChange,
  onSelect,
  disabled,
  style,
}: Props) {
  const active = options.find((o) => o.id === value) ?? options[0];
  const display = active?.shortLabel ?? active?.label ?? "";

  return (
    <View style={[styles.block, open && styles.blockOpen, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        disabled={disabled}
        onPress={() => onOpenChange(!open)}
        style={({ pressed }) => [
          styles.trigger,
          disabled && styles.triggerDisabled,
          pressed && !disabled && styles.triggerPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded: open, disabled: Boolean(disabled) }}
      >
        <Text
          style={[styles.value, disabled && styles.valueDisabled]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {display}
        </Text>
        <MaterialIcons
          name={open ? "expand-less" : "expand-more"}
          size={18}
          color={disabled ? c.faint : c.muted}
        />
      </Pressable>
      {open && !disabled ? (
        <ScrollView
          style={styles.menu}
          contentContainerStyle={styles.menuContent}
          showsVerticalScrollIndicator
          nestedScrollEnabled
        >
          {options.map((opt) => {
            const selected = opt.id === value;
            return (
              <Pressable
                key={opt.id || "__none"}
                onPress={() => onSelect(opt.id)}
                style={({ pressed }) => [
                  styles.option,
                  selected && styles.optionActive,
                  pressed && styles.optionPressed,
                ]}
              >
                <Text
                  style={[styles.optionText, selected && styles.optionTextActive]}
                  numberOfLines={2}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    minWidth: 0,
    position: "relative",
  },
  blockOpen: {
    zIndex: 6,
  },
  label: {
    marginBottom: 4,
    fontSize: 10,
    ...parchmentSans(600),
    letterSpacing: 0.5,
    color: c.faint,
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    minHeight: 34,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: c.surface,
  },
  triggerDisabled: {
    opacity: 0.5,
  },
  triggerPressed: {
    backgroundColor: c.hover,
  },
  value: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: c.ink,
    ...parchmentSans(500),
  },
  valueDisabled: {
    color: c.muted,
  },
  menu: {
    marginTop: 3,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surfaceSolid,
    overflow: "hidden",
    maxHeight: 220,
  },
  menuContent: {
    paddingVertical: 2,
  },
  option: {
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  optionActive: {
    backgroundColor: c.hover,
  },
  optionPressed: {
    backgroundColor: "rgba(69, 45, 28, 0.1)",
  },
  optionText: {
    fontSize: 13,
    lineHeight: 18,
    color: c.muted,
    ...parchmentSans(400),
  },
  optionTextActive: {
    color: c.ink,
    ...parchmentSans(600),
  },
});
