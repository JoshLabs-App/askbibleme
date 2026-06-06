import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { parchmentSans } from "../fonts/parchmentType";

export type NatureHomeSettingsSelectOption = {
  id: string;
  label: string;
  /** 收起时按钮上显示的短名 */
  shortLabel?: string;
};

type Props = {
  label?: string;
  accessibilityLabel: string;
  value: string;
  options: NatureHomeSettingsSelectOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (id: string) => void;
  disabled?: boolean;
  style?: View["props"]["style"];
  /** 底行菜单向上展开，避免撑出面板背景 */
  menuPlacement?: "below" | "above";
};

export function NatureHomeSettingsSelect({
  label,
  accessibilityLabel,
  value,
  options,
  open,
  onOpenChange,
  onSelect,
  disabled,
  style,
  menuPlacement = "below",
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
          color={disabled ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.72)"}
        />
      </Pressable>
      {open && !disabled ? (
        <View style={[styles.menu, menuPlacement === "above" && styles.menuAbove]}>
          <ScrollView
            style={styles.menuList}
            showsVerticalScrollIndicator
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {options.map((opt) => {
              const selected = opt.id === value;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => onSelect(opt.id)}
                  style={({ pressed }) => [
                    styles.option,
                    selected && styles.optionActive,
                    pressed && styles.optionPressed,
                  ]}
                >
                  <Text
                    style={[styles.optionText, selected && styles.optionTextActive]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {opt.label}
                  </Text>
                  {selected ? (
                    <MaterialIcons name="check" size={16} color="#fff" />
                  ) : (
                    <View style={styles.checkSpacer} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    width: "100%",
    position: "relative",
  },
  blockOpen: {
    zIndex: 8,
  },
  label: {
    fontSize: 10,
    ...parchmentSans(600),
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
    minHeight: 30,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#52525b",
    backgroundColor: "#27272a",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  triggerDisabled: {
    opacity: 0.45,
  },
  triggerPressed: {
    backgroundColor: "#3f3f46",
  },
  value: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: "rgba(255,255,255,0.92)",
    ...parchmentSans(500),
  },
  valueDisabled: {
    color: "rgba(255,255,255,0.4)",
  },
  menu: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "100%",
    marginTop: 4,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#52525b",
    backgroundColor: "#18181b",
    overflow: "hidden",
    maxHeight: 168,
    zIndex: 8,
  },
  menuList: {
    maxHeight: 168,
  },
  menuAbove: {
    top: undefined,
    marginBottom: 4,
    bottom: "100%",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 6,
  },
  optionActive: {
    backgroundColor: "#3f3f46",
  },
  optionPressed: {
    backgroundColor: "#52525b",
  },
  optionText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: "rgba(255,255,255,0.62)",
  },
  optionTextActive: {
    color: "#fff",
    ...parchmentSans(600),
  },
  checkSpacer: {
    width: 16,
    height: 16,
  },
});
