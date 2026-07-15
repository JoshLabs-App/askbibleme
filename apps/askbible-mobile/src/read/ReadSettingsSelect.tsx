import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { memo } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "./readParchmentTheme";

export type ReadSettingsSelectOption = {
  id: string;
  label: string;
  shortLabel?: string;
  sourceTone?: "bundled" | "youversion" | "api-bible" | "esv";
  audioBadges?: string[];
  downloadState?: "missing" | "outdated" | "downloading" | null;
  downloadProgress?: number | null;
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
  showDownloadButton?: boolean;
  style?: View["props"]["style"];
};

const MENU_GAP = 4;
const MENU_MAX_HEIGHT = 300;

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
    fontSize: 18,
    lineHeight: 24,
    ...parchmentSans(500),
  },
  valueDisabled: {
    color: c.muted,
  },
  valueBundled: {
    color: c.parchmentAccent,
  },
  valueYouVersion: {
    color: "#2D6CE6",
  },
  valueApiBible: {
    color: "#0F8D73",
  },
  triggerMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexWrap: "wrap",
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "rgba(120, 75, 30, 0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(120, 75, 30, 0.24)",
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 12,
    color: c.parchmentAccent,
    ...parchmentSans(700),
  },
  menuFloating: {
    marginTop: MENU_GAP,
    maxHeight: MENU_MAX_HEIGHT,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surfaceSolid,
    overflow: "hidden",
    elevation: 8,
    shadowColor: "#2a1810",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
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
    flexDirection: "column",
    alignItems: "stretch",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    minWidth: 0,
  },
  optionMainTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  optionMetaRow: {
    paddingLeft: 24,
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
  optionDownloadStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingRight: 10,
  },
  optionDownloadStatusText: {
    fontSize: 11,
    lineHeight: 14,
    color: c.parchmentAccent,
    ...parchmentSans(600),
  },
  optionText: {
    fontSize: 17,
    lineHeight: 23,
    ...parchmentSans(400),
  },
  optionTextActive: {
    ...parchmentSans(600),
  },
  optionTextBundled: {
    color: c.parchmentAccent,
  },
  optionTextYouVersion: {
    color: "#2D6CE6",
  },
  optionTextApiBible: {
    color: "#0F8D73",
  },
});

function resolveSourceToneStyle(sourceTone?: ReadSettingsSelectOption["sourceTone"]) {
  switch (sourceTone) {
    case "youversion":
      return styles.valueYouVersion;
    case "api-bible":
    case "esv":
      return styles.valueApiBible;
    case "bundled":
    default:
      return styles.valueBundled;
  }
}

function resolveOptionToneStyle(sourceTone?: ReadSettingsSelectOption["sourceTone"]) {
  switch (sourceTone) {
    case "youversion":
      return styles.optionTextYouVersion;
    case "api-bible":
    case "esv":
      return styles.optionTextApiBible;
    case "bundled":
    default:
      return styles.optionTextBundled;
  }
}

function ReadSettingsSelectInner({
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
  showDownloadButton = false,
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
  const activeTone = multi ? options.find((opt) => selectedIds.includes(opt.id))?.sourceTone : active?.sourceTone;
  const activeBadges = multi ? [] : active?.audioBadges ?? [];

  const renderBadgeRow = (badges?: string[]) => {
    if (!badges?.length) return null;
    return (
      <View style={styles.badgeRow}>
        {badges.map((badge) => (
          <View key={badge} style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderOptions = () =>
    options.map((opt) => {
      const selected = multi ? selectedIds.includes(opt.id) : opt.id === value;
      const pressMain = () => {
        if (multi && selected) {
          onToggleSelect?.(opt.id);
          return;
        }
        if (multi) {
          onToggleSelect?.(opt.id);
        } else {
          onSelect?.(opt.id);
        }
      };
      return (
        <View key={opt.id || "__none"} style={[styles.option, selected && styles.optionActive]}>
          <Pressable
            onPress={pressMain}
            style={({ pressed }) => [styles.optionMain, pressed && styles.optionPressed]}
          >
            <View style={styles.optionMainTop}>
              {multi ? (
                <MaterialIcons
                  name={selected ? "check-box" : "check-box-outline-blank"}
                  size={16}
                  color={selected ? c.ink : c.faint}
                />
              ) : null}
              <Text
                style={[
                  styles.optionText,
                  resolveOptionToneStyle(opt.sourceTone),
                  selected && styles.optionTextActive,
                ]}
                numberOfLines={2}
              >
                {opt.label}
              </Text>
            </View>
            {opt.audioBadges?.length ? (
              <View style={styles.optionMetaRow}>{renderBadgeRow(opt.audioBadges)}</View>
            ) : null}
          </Pressable>
          {opt.downloadState === "downloading" ? (
            <View style={styles.optionDownloadStatus}>
              <ActivityIndicator size="small" color={c.parchmentAccent} />
              <Text style={styles.optionDownloadStatusText}>
                {typeof opt.downloadProgress === "number" ? `${opt.downloadProgress}%` : "下载中"}
              </Text>
            </View>
          ) : showDownloadButton &&
            onDownloadOption &&
            !multi &&
            (opt.downloadState === "missing" || opt.downloadState === "outdated") ? (
            <Pressable
              onPress={() => onDownloadOption(opt.id)}
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
          ) : null}
        </View>
      );
    });

  return (
    <View style={[styles.block, open && styles.blockOpen, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View collapsable={false}>
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
          <View style={styles.triggerMain}>
            <Text
              style={[styles.value, resolveSourceToneStyle(activeTone), disabled && styles.valueDisabled]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {display}
            </Text>
            {renderBadgeRow(activeBadges)}
          </View>
          <MaterialIcons
            name={open ? "expand-less" : "expand-more"}
            size={18}
            color={disabled ? c.faint : c.muted}
          />
        </Pressable>
      </View>
      {open && !disabled ? (
        <View style={styles.menuFloating}>
          <ScrollView
            style={{ maxHeight: MENU_MAX_HEIGHT }}
            contentContainerStyle={styles.menuContent}
            showsVerticalScrollIndicator
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {renderOptions()}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

function propsEqual(prev: Props, next: Props): boolean {
  return (
    prev.label === next.label &&
    prev.accessibilityLabel === next.accessibilityLabel &&
    prev.value === next.value &&
    prev.values === next.values &&
    prev.options === next.options &&
    prev.open === next.open &&
    prev.disabled === next.disabled &&
    prev.showDownloadButton === next.showDownloadButton &&
    prev.emptyDisplay === next.emptyDisplay &&
    prev.style === next.style &&
    prev.onOpenChange === next.onOpenChange &&
    prev.onSelect === next.onSelect &&
    prev.onToggleSelect === next.onToggleSelect &&
    prev.onDownloadOption === next.onDownloadOption
  );
}

export const ReadSettingsSelect = memo(ReadSettingsSelectInner, propsEqual);
