import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "./readParchmentTheme";

export type ReadSettingsSelectOption = {
  id: string;
  label: string;
  shortLabel?: string;
  downloadState?: "missing" | "outdated" | "downloading" | null;
};

type Props = {
  /** 极简模式不展示；仅保留无障碍 */
  label?: string;
  accessibilityLabel: string;
  value?: string;
  values?: string[];
  options: ReadSettingsSelectOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect?: (id: string) => void;
  onToggleSelect?: (id: string) => void;
  onDownloadOption?: (id: string) => void;
  emptyDisplay?: string;
  disabled?: boolean;
  style?: View["props"]["style"];
};

export function ReadSettingsSelect({
  label,
  accessibilityLabel,
  value,
  values,
  options,
  open,
  onOpenChange,
  onSelect,
  onToggleSelect,
  onDownloadOption,
  emptyDisplay,
  disabled,
  style,
}: Props) {
  const multi = Array.isArray(values);
  const selectedIds = multi ? values : [];
  const active = options.find((o) => o.id === value) ?? options[0];
  const pickedDisplay = multi
    ? selectedIds
        .map((id) => {
          const item = options.find((opt) => opt.id === id);
          return item?.shortLabel ?? item?.label ?? "";
        })
        .filter(Boolean)
        .join(", ")
    : active?.shortLabel ?? active?.label ?? "";
  const display = pickedDisplay || emptyDisplay || "";

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
            const selected = multi ? selectedIds.includes(opt.id) : opt.id === value;
            const showDownload =
              Boolean(onDownloadOption) &&
              (opt.downloadState === "missing" || opt.downloadState === "outdated");
            const downloading = opt.downloadState === "downloading";
            return (
              <View key={opt.id || "__none"} style={[styles.option, selected && styles.optionActive]}>
                <Pressable
                  onPress={() => {
                    if (multi) {
                      onToggleSelect?.(opt.id);
                    } else {
                      onSelect?.(opt.id);
                    }
                  }}
                  style={({ pressed }) => [
                    styles.optionMain,
                    pressed && styles.optionPressed,
                  ]}
                >
                  {multi ? (
                    <MaterialIcons
                      name={selected ? "check-box" : "check-box-outline-blank"}
                      size={16}
                      color={selected ? c.ink : c.faint}
                    />
                  ) : null}
                  <Text
                    style={[styles.optionText, selected && styles.optionTextActive]}
                    numberOfLines={2}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
                {showDownload ? (
                  <Pressable
                    onPress={() => onDownloadOption?.(opt.id)}
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.optionDownloadBtn,
                      pressed && styles.optionDownloadBtnPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={
                      opt.downloadState === "outdated" ? "Update translation" : "Download translation"
                    }
                  >
                    <MaterialIcons
                      name={opt.downloadState === "outdated" ? "system-update" : "download"}
                      size={18}
                      color={c.parchmentAccent}
                    />
                  </Pressable>
                ) : downloading ? (
                  <MaterialIcons name="hourglass-top" size={16} color={c.faint} />
                ) : null}
              </View>
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
    zIndex: 30,
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
    position: "absolute",
    top: 37,
    left: 0,
    right: 0,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surfaceSolid,
    overflow: "hidden",
    maxHeight: 360,
    zIndex: 20,
    elevation: 6,
  },
  menuContent: {
    paddingVertical: 2,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingRight: 4,
  },
  optionMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    minWidth: 0,
  },
  optionActive: {
    backgroundColor: c.hover,
  },
  optionPressed: {
    backgroundColor: "rgba(69, 45, 28, 0.1)",
  },
  optionDownloadBtn: {
    width: 34,
    height: 34,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  optionDownloadBtnPressed: {
    backgroundColor: "rgba(69, 45, 28, 0.08)",
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
