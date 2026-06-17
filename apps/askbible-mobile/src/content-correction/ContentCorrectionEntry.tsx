import {
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
import { contentCorrectionEntryStyles as styles } from "./ContentCorrectionEntryStyles";
import type { ContentCorrectionContext } from "./types";
import { useContentCorrectionEntry } from "./useContentCorrectionEntry";

type Props = {
  context: ContentCorrectionContext;
  /** 浅色羊皮正文区 */
  tone?: "explore" | "edition";
};

export function ContentCorrectionEntry({ context, tone = "explore" }: Props) {
  const insets = useSafeAreaInsets();
  const {
    open,
    message,
    setMessage,
    email,
    setEmail,
    submitState,
    remain,
    linkColor,
    contextHint,
    closeSheet,
    openSheet,
    onSubmit,
    errorText,
    t,
  } = useContentCorrectionEntry(context, tone);

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
                  maxLength={800}
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
