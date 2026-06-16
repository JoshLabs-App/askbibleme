import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { parchmentSans } from "../fonts/parchmentType";
import { useLocale } from "../i18n/LocaleProvider";
import { readParchmentTheme as c } from "../read/readParchmentTheme";
import { submitContentCorrection } from "./submitContentCorrection";
import type { ContentCorrectionContext } from "./types";

const MAX_MESSAGE_CHARS = 800;

type Props = {
  context: ContentCorrectionContext;
  /** 浅色羊皮正文区 */
  tone?: "explore" | "edition";
};

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; code: string }
  | { kind: "success"; id: string };

export function ContentCorrectionEntry({ context, tone = "explore" }: Props) {
  const insets = useSafeAreaInsets();
  const { locale, t } = useLocale();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>({ kind: "idle" });

  const remain = Math.max(0, MAX_MESSAGE_CHARS - message.length);
  const linkColor = tone === "edition" ? c.muted : c.faint;

  const contextHint = useMemo(() => {
    if (context.scope === "explore_article") {
      return context.articleTitle || context.articleSlug || "";
    }
    const edition =
      context.scope === "guide_edition"
        ? t("pages.read.postReadingEditionGuideTag")
        : t("pages.read.postReadingEditionInfoTag");
    const loc =
      context.bookId && context.chapter != null
        ? `${context.bookId} ${context.chapter}`
        : "";
    return [edition, loc].filter(Boolean).join(" · ");
  }, [context, t]);

  function closeSheet() {
    setOpen(false);
    if (submitState.kind === "success") {
      setMessage("");
      setEmail("");
      setSubmitState({ kind: "idle" });
    }
  }

  function openSheet() {
    setSubmitState({ kind: "idle" });
    setOpen(true);
  }

  async function onSubmit() {
    if (submitState.kind === "submitting") return;
    if (!message.trim()) {
      setSubmitState({ kind: "error", code: "empty" });
      return;
    }
    setSubmitState({ kind: "submitting" });
    const result = await submitContentCorrection({
      context,
      message,
      email,
      locale,
    });
    if (!result.ok) {
      setSubmitState({ kind: "error", code: result.error });
      return;
    }
    setSubmitState({ kind: "success", id: result.id });
  }

  function errorText(code: string): string {
    if (code === "empty") return t("contentCorrection.errorEmpty");
    if (code === "offline" || code === "network") return t("contentCorrection.errorNetwork");
    if (code !== "submit_failed" && code !== "too_long") return code;
    return t("contentCorrection.errorSubmit");
  }

  return (
    <>
      <Pressable
        onPress={openSheet}
        style={({ pressed }) => [styles.linkWrap, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t("contentCorrection.link")}
      >
        <Text style={[styles.linkText, { color: linkColor }]}>{t("contentCorrection.link")}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={closeSheet}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.backdrop}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={submitState.kind === "submitting" ? undefined : closeSheet}
          />
          <View style={[styles.sheet, { paddingBottom: 12 + insets.bottom }]}>
            <Text style={styles.sheetTitle}>{t("contentCorrection.sheetTitle")}</Text>
            <Text style={styles.sheetIntro}>{t("contentCorrection.sheetIntro")}</Text>
            {contextHint ? (
              <Text style={styles.contextHint} numberOfLines={2}>
                {contextHint}
              </Text>
            ) : null}

            {submitState.kind === "success" ? (
              <Text style={styles.successText}>{t("contentCorrection.success")}</Text>
            ) : (
              <>
                <Text style={styles.label}>{t("contentCorrection.messageLabel")}</Text>
                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  style={styles.messageInput}
                  multiline
                  maxLength={MAX_MESSAGE_CHARS}
                  textAlignVertical="top"
                  placeholder={t("contentCorrection.messagePlaceholder")}
                  placeholderTextColor="rgba(55,53,47,0.38)"
                  editable={submitState.kind !== "submitting"}
                />
                <Text style={styles.counter}>
                  {t("contentCorrection.remainingChars", { count: remain })}
                </Text>

                <Text style={styles.label}>{t("contentCorrection.emailLabel")}</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  style={styles.emailInput}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder={t("contentCorrection.emailPlaceholder")}
                  placeholderTextColor="rgba(55,53,47,0.38)"
                  editable={submitState.kind !== "submitting"}
                />

                {submitState.kind === "error" ? (
                  <Text style={styles.errorText}>{errorText(submitState.code)}</Text>
                ) : null}
              </>
            )}

            <View style={styles.actions}>
              <Pressable
                onPress={closeSheet}
                disabled={submitState.kind === "submitting"}
                style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.pressed]}
              >
                <Text style={styles.btnGhostText}>
                  {submitState.kind === "success"
                    ? t("contentCorrection.done")
                    : t("contentCorrection.cancel")}
                </Text>
              </Pressable>
              {submitState.kind !== "success" ? (
                <Pressable
                  onPress={() => void onSubmit()}
                  disabled={submitState.kind === "submitting"}
                  style={({ pressed }) => [
                    styles.btn,
                    styles.btnPrimary,
                    submitState.kind === "submitting" && styles.btnDisabled,
                    pressed && submitState.kind !== "submitting" && styles.pressed,
                  ]}
                >
                  {submitState.kind === "submitting" ? (
                    <Text style={styles.btnPrimaryText}>{t("contentCorrection.submitting")}</Text>
                  ) : (
                    <Text style={styles.btnPrimaryText}>{t("contentCorrection.submit")}</Text>
                  )}
                </Pressable>
              ) : null}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  linkWrap: {
    alignSelf: "center",
    marginTop: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  linkText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    textDecorationLine: "underline",
    ...parchmentSans(500),
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: "rgba(255, 248, 235, 0.98)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(120, 53, 15, 0.22)",
    paddingHorizontal: 18,
    paddingTop: 16,
    maxHeight: "82%",
  },
  sheetTitle: {
    fontSize: 17,
    color: c.ink,
    ...parchmentSans(600),
    marginBottom: 6,
  },
  sheetIntro: {
    fontSize: 13,
    lineHeight: 20,
    color: c.muted,
    marginBottom: 8,
  },
  contextHint: {
    fontSize: 12,
    lineHeight: 18,
    color: c.faint,
    marginBottom: 10,
  },
  label: {
    marginTop: 8,
    marginBottom: 6,
    fontSize: 11,
    letterSpacing: 0.35,
    color: "rgba(55, 53, 47, 0.52)",
    ...parchmentSans(600),
  },
  messageInput: {
    minHeight: 120,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(120, 53, 15, 0.26)",
    backgroundColor: "rgba(255, 248, 235, 0.5)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: c.ink,
    fontSize: 15,
    lineHeight: 22,
  },
  counter: {
    marginTop: 4,
    textAlign: "right",
    color: "rgba(55,53,47,0.56)",
    fontSize: 11,
  },
  emailInput: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(120, 53, 15, 0.26)",
    backgroundColor: "rgba(255, 248, 235, 0.5)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: c.ink,
    fontSize: 15,
  },
  errorText: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 20,
    color: "rgba(121, 36, 36, 0.95)",
  },
  successText: {
    marginTop: 12,
    marginBottom: 4,
    fontSize: 14,
    lineHeight: 22,
    color: "rgba(26, 92, 51, 0.95)",
    ...parchmentSans(500),
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  btn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  btnGhost: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(120, 53, 15, 0.28)",
  },
  btnGhostText: {
    fontSize: 14,
    color: c.muted,
    ...parchmentSans(600),
  },
  btnPrimary: {
    backgroundColor: "rgba(255, 246, 230, 0.96)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(120, 53, 15, 0.35)",
  },
  btnPrimaryText: {
    fontSize: 14,
    color: c.ink,
    ...parchmentSans(600),
  },
  btnDisabled: { opacity: 0.65 },
  pressed: { opacity: 0.86 },
});
