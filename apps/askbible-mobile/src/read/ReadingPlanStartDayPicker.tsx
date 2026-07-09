import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { AppLocale } from "../i18n/config";
import { toZhTwText } from "../i18n/site-copy";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "./readParchmentTheme";

type Props = {
  locale: AppLocale;
  value: number;
  max: number;
  onChange: (next: number) => void;
};

export function ReadingPlanStartDayPicker({ locale, value, max, onChange }: Props) {
  const zhText = (text: string) => (locale === "zh-TW" ? toZhTwText(text) : text);
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  const clamp = (n: number) => Math.min(max, Math.max(1, Math.floor(n)));

  const commit = (raw: string) => {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) {
      onChange(1);
      setText("1");
      return;
    }
    const next = clamp(n);
    onChange(next);
    setText(String(next));
  };

  const step = (delta: number) => {
    const next = clamp(value + delta);
    onChange(next);
    setText(String(next));
  };

  return (
    <View style={styles.section}>
      <Text style={styles.title}>
        {locale === "en" ? "Start from which day?" : zhText("从第几天开始读？")}
      </Text>
      <Text style={styles.hint}>
        {locale === "en"
          ? "New here? Leave it at day 1. Already partway through—say day 20—set it here to pick up where you left off."
          : zhText("第一次读，保持第 1 天即可；若之前已读到第 20 天，可直接设为 20，从那里继续。")}
      </Text>
      <View style={styles.row}>
        <Pressable
          onPress={() => step(-1)}
          disabled={value <= 1}
          hitSlop={8}
          style={({ pressed }) => [
            styles.step,
            value <= 1 ? styles.stepDisabled : undefined,
            pressed ? styles.stepPressed : undefined,
          ]}
          accessibilityRole="button"
          accessibilityLabel={locale === "en" ? "Decrease start day" : zhText("减少起始天数")}
        >
          <MaterialCommunityIcons name="minus" size={22} color={c.ink} />
        </Pressable>

        <View style={styles.valueWrap}>
          <Text style={styles.valuePrefix}>{locale === "en" ? "Day" : zhText("第")}</Text>
          <TextInput
            value={text}
            onChangeText={(v) => setText(v.replace(/[^0-9]/g, ""))}
            onBlur={() => commit(text)}
            onSubmitEditing={() => commit(text)}
            keyboardType="number-pad"
            returnKeyType="done"
            maxLength={4}
            selectTextOnFocus
            style={styles.input}
          />
          {locale === "en" ? null : <Text style={styles.valueSuffix}>{zhText("天")}</Text>}
        </View>

        <Pressable
          onPress={() => step(1)}
          disabled={value >= max}
          hitSlop={8}
          style={({ pressed }) => [
            styles.step,
            value >= max ? styles.stepDisabled : undefined,
            pressed ? styles.stepPressed : undefined,
          ]}
          accessibilityRole="button"
          accessibilityLabel={locale === "en" ? "Increase start day" : zhText("增加起始天数")}
        >
          <MaterialCommunityIcons name="plus" size={22} color={c.ink} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    paddingTop: 14,
  },
  title: {
    fontSize: 13,
    ...parchmentSans(600),
    color: c.ink,
  },
  hint: {
    marginTop: 6,
    fontSize: 11,
    lineHeight: 16,
    color: c.muted,
  },
  row: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  step: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: "rgba(255, 252, 245, 0.92)",
  },
  stepDisabled: { opacity: 0.4 },
  stepPressed: { transform: [{ scale: 0.96 }] },
  valueWrap: {
    minWidth: 120,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 4,
  },
  valuePrefix: {
    fontSize: 14,
    ...parchmentSans(600),
    color: c.muted,
  },
  valueSuffix: {
    fontSize: 14,
    ...parchmentSans(600),
    color: c.muted,
  },
  input: {
    minWidth: 44,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 24,
    ...parchmentSans(700),
    color: c.ink,
    textAlign: "center",
    borderBottomWidth: 2,
    borderBottomColor: "rgba(255, 177, 1, 0.7)",
  },
});
