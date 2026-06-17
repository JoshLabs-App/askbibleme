import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import { NATURE_VISUAL_EFFECT_LEVELS, NATURE_VISUAL_LEVELS, type NatureVisualLevel } from "./natureHomePrefs";

type MaterialIconName = ComponentProps<typeof MaterialIcons>["name"];

type Props = {
  selected: NatureVisualLevel;
  onSelect: (level: NatureVisualLevel) => void;
  labelForLevel: (level: NatureVisualLevel) => string;
  iconForLevel?: (level: NatureVisualLevel) => MaterialIconName;
  iconSize?: number;
  levels?: readonly NatureVisualLevel[];
  segmentStyle?: object;
  segBtnStyle?: object;
  segBtnOnStyle?: object;
  segTextStyle?: object;
  segTextOnStyle?: object;
  /** 仅展示强度档（四档；不含「关」）；再点已选档回调 `onSelect(0)` */
  allowToggleOff?: boolean;
};

export function NatureHomeLevelSegment({
  selected,
  onSelect,
  labelForLevel,
  iconForLevel,
  iconSize = 17,
  levels = NATURE_VISUAL_LEVELS,
  segmentStyle,
  segBtnStyle,
  segBtnOnStyle,
  segTextStyle,
  segTextOnStyle,
  allowToggleOff = false,
}: Props) {
  const visibleLevels = allowToggleOff ? NATURE_VISUAL_EFFECT_LEVELS : levels;
  return (
    <View style={[styles.segment, segmentStyle]} accessibilityRole="radiogroup">
      {visibleLevels.map((level) => {
        const isOn = selected === level;
        const label = labelForLevel(level);
        const iconName = iconForLevel?.(level);
        return (
          <Pressable
            key={level}
            onPress={() => onSelect(allowToggleOff && isOn ? 0 : level)}
            style={[styles.segBtn, segBtnStyle, isOn && [styles.segBtnOn, segBtnOnStyle]]}
            accessibilityRole="radio"
            accessibilityState={{ selected: isOn }}
            accessibilityLabel={label}
          >
            {iconName ? (
              <MaterialIcons
                name={iconName}
                size={iconSize}
                color={isOn ? "#fff" : "rgba(255,255,255,0.5)"}
              />
            ) : (
              <Text style={[styles.segText, segTextStyle, isOn && [styles.segTextOn, segTextOnStyle]]}>
                {label}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: "row",
    backgroundColor: "#27272a",
    borderRadius: 8,
    padding: 3,
  },
  segBtn: {
    flex: 1,
    minHeight: 34,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  segBtnOn: { backgroundColor: "#3f3f46" },
  segText: { fontSize: 12, ...parchmentSans(500), color: "rgba(255,255,255,0.55)" },
  segTextOn: { color: "#fff", ...parchmentSans(600) },
});
