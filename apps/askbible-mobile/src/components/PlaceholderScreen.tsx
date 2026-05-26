import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { parchmentSans } from "../fonts/parchmentType";
import { theme } from "../theme";

type Props = {
  title: string;
  lead: string;
  body: string;
  primaryLabel?: string;
  onPrimaryPress?: () => void;
  /** 底部额外区域（如音乐页工具条） */
  footer?: ReactNode;
};

export function PlaceholderScreen({ title, lead, body, primaryLabel, onPrimaryPress, footer }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scroll, { paddingTop: 12 + insets.top, paddingBottom: 24 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.inner}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.rule} />
        <Text style={styles.lead}>{lead}</Text>
        <Text style={styles.body}>{body}</Text>
        {primaryLabel && onPrimaryPress ? (
          <Pressable
            onPress={onPrimaryPress}
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
            accessibilityRole="button"
          >
            <Text style={styles.btnText}>{primaryLabel}</Text>
          </Pressable>
        ) : null}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.canvas,
  },
  scrollView: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    backgroundColor: theme.canvas,
  },
  inner: {
    maxWidth: 420,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 24,
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    ...parchmentSans(600),
    letterSpacing: 0.4,
    color: theme.ink,
    textAlign: "center",
    lineHeight: 30,
  },
  rule: {
    marginTop: 18,
    height: StyleSheet.hairlineWidth,
    width: 40,
    backgroundColor: theme.border,
  },
  lead: {
    marginTop: 18,
    fontSize: 15,
    lineHeight: 24,
    color: "rgba(241, 245, 249, 0.88)",
    textAlign: "center",
  },
  body: {
    marginTop: 14,
    fontSize: 14,
    lineHeight: 23,
    color: theme.muted,
    textAlign: "center",
  },
  btn: {
    marginTop: 28,
    minHeight: 44,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  btnPressed: {
    opacity: 0.88,
  },
  btnText: {
    fontSize: 14,
    ...parchmentSans(600),
    color: theme.ink,
  },
  footer: {
    marginTop: 28,
    width: "100%",
    maxWidth: 360,
    alignSelf: "center",
    gap: 10,
  },
});
