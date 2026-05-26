import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getAskBibleBaseUrl, toAbsoluteUrl } from "../config/askbibleBaseUrl";
import { isMobileOfflineFirst } from "../config/mobileBundledOnly";
import { useLocale } from "../i18n/LocaleProvider";
import { parchmentSans } from "../fonts/parchmentType";
import { theme } from "../theme";

type FeedbackType = "idea" | "bug" | "content" | "other";

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string }
  | { kind: "success"; id: string };

const MAX_MESSAGE_CHARS = 1200;
const SUPPORT_EMAIL = "askbibleme@gmail.com";

export function FeedbackScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { locale, t } = useLocale();

  const [feedbackType, setFeedbackType] = useState<FeedbackType>("idea");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>({ kind: "idle" });

  const baseUrl = getAskBibleBaseUrl();
  const submitUrl = toAbsoluteUrl(baseUrl, "/api/feedback");
  const remain = Math.max(0, MAX_MESSAGE_CHARS - message.length);

  const typeOptions = useMemo(
    () =>
      [
        { value: "idea", label: t("feedback.typeIdea") },
        { value: "bug", label: t("feedback.typeBug") },
        { value: "content", label: t("feedback.typeContent") },
        { value: "other", label: t("feedback.typeOther") },
      ] as const,
    [t],
  );

  async function onSubmit() {
    if (submitState.kind === "submitting") return;
    if (!message.trim()) {
      setSubmitState({ kind: "error", message: t("feedback.errorEmptyMessage") });
      return;
    }

    if (isMobileOfflineFirst()) {
      setSubmitState({ kind: "error", message: t("feedback.errorNetwork") });
      return;
    }

    setSubmitState({ kind: "submitting" });
    try {
      const res = await fetch(submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: feedbackType,
          message: message.trim(),
          email: email.trim() || undefined,
          page: "/mobile/feedback",
          locale,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        setSubmitState({ kind: "error", message: data.error || t("feedback.errorSubmit") });
        return;
      }
      setSubmitState({ kind: "success", id: data.id });
      setMessage("");
      setFeedbackType("idea");
    } catch {
      setSubmitState({ kind: "error", message: t("feedback.errorNetwork") });
    }
  }

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.root}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: 14 + insets.top, paddingBottom: 104 + insets.bottom },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {router.canGoBack() ? (
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.back, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t("chrome.backHome")}
            >
              <MaterialIcons name="arrow-back" size={22} color={theme.sand} />
            </Pressable>
          ) : null}

          <Text style={styles.title}>{t("feedback.title")}</Text>
          <Text style={styles.intro}>{t("feedback.intro")}</Text>

          <Text style={styles.label}>{t("feedback.typeLabel")}</Text>
          <View style={styles.typeWrap}>
            {typeOptions.map((item) => {
              const selected = feedbackType === item.value;
              return (
                <Pressable
                  key={item.value}
                  onPress={() => setFeedbackType(item.value)}
                  style={({ pressed }) => [styles.typeChip, selected && styles.typeChipSelected, pressed && styles.pressed]}
                >
                  <Text style={[styles.typeText, selected && styles.typeTextSelected]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>{t("feedback.messageLabel")}</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            style={styles.messageInput}
            multiline
            maxLength={MAX_MESSAGE_CHARS}
            textAlignVertical="top"
            placeholder={t("feedback.messagePlaceholder")}
            placeholderTextColor="rgba(55,53,47,0.4)"
          />
          <Text style={styles.counter}>{t("feedback.remainingChars", { count: remain })}</Text>

          <Text style={styles.label}>{t("feedback.emailLabel")}</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            style={styles.emailInput}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={t("feedback.emailPlaceholder")}
            placeholderTextColor="rgba(55,53,47,0.4)"
          />

          {submitState.kind === "error" ? <Text style={styles.errorText}>{submitState.message}</Text> : null}
          {submitState.kind === "success" ? (
            <Text style={styles.successText}>{t("feedback.success", { id: submitState.id })}</Text>
          ) : null}

          <Pressable
            onPress={() => void onSubmit()}
            style={({ pressed }) => [styles.submitBtn, pressed && styles.pressed, submitState.kind === "submitting" && styles.submitBtnDisabled]}
            accessibilityRole="button"
            accessibilityLabel={t("feedback.submit")}
          >
            {submitState.kind === "submitting" ? (
              <ActivityIndicator color={theme.ink} />
            ) : (
              <Text style={styles.submitText}>{t("feedback.submit")}</Text>
            )}
          </Pressable>
          <Text style={styles.supportHint}>{t("feedback.directEmailHint")}</Text>
          <Pressable
            onPress={() => {
              void Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
            }}
            style={({ pressed }) => [styles.supportEmailWrap, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t("feedback.directEmailAction")}
          >
            <Text style={styles.supportEmail}>{SUPPORT_EMAIL}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.canvas },
  scroll: { paddingHorizontal: 20, maxWidth: 560, width: "100%", alignSelf: "center" },
  back: { alignSelf: "flex-start", marginBottom: 2, paddingVertical: 6 },
  title: { marginTop: 4, textAlign: "center", fontSize: 24, color: theme.ink, ...parchmentSans(600) },
  intro: { marginTop: 10, marginBottom: 16, textAlign: "center", color: theme.muted, fontSize: 14, lineHeight: 22 },
  label: {
    marginTop: 10,
    marginBottom: 8,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: "rgba(55, 53, 47, 0.52)",
    ...parchmentSans(600),
  },
  typeWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(120, 53, 15, 0.25)",
    backgroundColor: "rgba(255, 248, 235, 0.36)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  typeChipSelected: {
    backgroundColor: "rgba(255, 244, 224, 0.9)",
    borderColor: "rgba(120, 53, 15, 0.45)",
  },
  typeText: { color: "rgba(55,53,47,0.8)", fontSize: 13 },
  typeTextSelected: { color: "#37352f", ...parchmentSans(600) },
  messageInput: {
    minHeight: 160,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(120, 53, 15, 0.26)",
    backgroundColor: "rgba(255, 248, 235, 0.5)",
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: theme.ink,
    fontSize: 15,
    lineHeight: 22,
  },
  counter: { marginTop: 6, textAlign: "right", color: "rgba(55,53,47,0.56)", fontSize: 12 },
  emailInput: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(120, 53, 15, 0.26)",
    backgroundColor: "rgba(255, 248, 235, 0.5)",
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: theme.ink,
    fontSize: 15,
  },
  errorText: {
    marginTop: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(160, 44, 44, 0.35)",
    backgroundColor: "rgba(160, 44, 44, 0.08)",
    color: "rgba(121, 36, 36, 0.95)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    lineHeight: 20,
  },
  successText: {
    marginTop: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(35, 117, 66, 0.32)",
    backgroundColor: "rgba(35, 117, 66, 0.08)",
    color: "rgba(26, 92, 51, 0.95)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    lineHeight: 20,
  },
  submitBtn: {
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: "rgba(255, 246, 230, 0.96)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(120, 53, 15, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 16,
  },
  submitBtnDisabled: { opacity: 0.66 },
  submitText: { color: theme.ink, fontSize: 15, ...parchmentSans(600) },
  supportHint: {
    marginTop: 16,
    textAlign: "center",
    color: "rgba(55,53,47,0.6)",
    fontSize: 12,
    lineHeight: 18,
  },
  supportEmailWrap: { marginTop: 6, alignSelf: "center", paddingHorizontal: 6, paddingVertical: 2 },
  supportEmail: {
    color: "rgba(92, 63, 24, 0.95)",
    fontSize: 13,
    textDecorationLine: "underline",
  },
  pressed: { opacity: 0.85 },
});
