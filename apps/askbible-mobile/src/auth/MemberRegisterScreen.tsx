import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { registerMobileMember } from "../api/memberAuth";
import { isMemberRegisterEnabled, isMobileOfflineFirst } from "../config/mobileBundledOnly";
import { parchmentSans } from "../fonts/parchmentType";
import { useLocale } from "../i18n/LocaleProvider";
import { theme } from "../theme";

export function MemberRegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { locale, t } = useLocale();
  const registerOpen = isMemberRegisterEnabled();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (pending) return;
    if (!registerOpen) {
      setError(t("auth.registerClosed"));
      return;
    }
    if (isMobileOfflineFirst()) {
      setError(t("auth.errorNetwork"));
      return;
    }
    if (!acceptTerms) {
      setError(t("auth.registerTermsRequired"));
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await registerMobileMember({
        email: email.trim(),
        password,
        name: name.trim(),
        locale,
        source: "askbible-mobile",
        acceptTerms: true,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      Alert.alert(t("auth.registerPageTitle"), t("auth.registerSuccess"), [
        { text: t("common.done"), onPress: () => router.back() },
      ]);
    } catch {
      setError(t("auth.errorNetwork"));
    } finally {
      setPending(false);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button">
            <Text style={styles.backText}>{t("auth.backHome")}</Text>
          </Pressable>

          <Text style={styles.title}>{t("auth.registerPageTitle")}</Text>
          <Text style={styles.intro}>{registerOpen ? t("auth.registerIntro") : t("auth.registerClosed")}</Text>

          {registerOpen ? (
            <View style={styles.form}>
              <Text style={styles.label}>{t("auth.email")}</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                style={styles.input}
              />
              <Text style={styles.label}>{t("auth.registerName")}</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                textContentType="name"
                style={styles.input}
              />
              <Text style={styles.label}>{t("auth.password")}</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="newPassword"
                style={styles.input}
              />
              <Pressable
                onPress={() => setAcceptTerms((v) => !v)}
                style={styles.termsRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: acceptTerms }}
              >
                <View style={[styles.checkbox, acceptTerms && styles.checkboxOn]} />
                <Text style={styles.termsText}>{t("auth.registerAcceptTerms")}</Text>
              </Pressable>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable
                onPress={() => void onSubmit()}
                disabled={pending}
                style={({ pressed }) => [styles.submit, pressed && styles.submitPressed, pending && styles.submitDisabled]}
              >
                {pending ? (
                  <ActivityIndicator color={theme.ink} />
                ) : (
                  <Text style={styles.submitText}>{t("auth.registerSubmit")}</Text>
                )}
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.canvas },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 24 },
  backBtn: { alignSelf: "flex-start", paddingVertical: 8 },
  backText: { fontSize: 14, color: "rgba(55,53,47,0.55)", ...parchmentSans(500) },
  title: {
    marginTop: 8,
    fontSize: 22,
    color: theme.ink,
    ...parchmentSans(600),
  },
  intro: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(55,53,47,0.62)",
    ...parchmentSans(400),
  },
  form: { marginTop: 24, gap: 8 },
  label: {
    marginTop: 8,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "rgba(55,53,47,0.45)",
    ...parchmentSans(600),
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(55,53,47,0.18)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.ink,
    backgroundColor: "rgba(255,255,255,0.45)",
    ...parchmentSans(400),
  },
  termsRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 12 },
  checkbox: {
    width: 18,
    height: 18,
    marginTop: 2,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(55,53,47,0.35)",
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  checkboxOn: { backgroundColor: "rgba(55,53,47,0.82)" },
  termsText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(55,53,47,0.62)",
    ...parchmentSans(400),
  },
  error: {
    marginTop: 8,
    fontSize: 13,
    color: "#b42318",
    textAlign: "center",
    ...parchmentSans(500),
  },
  submit: {
    marginTop: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "rgba(55,53,47,0.12)",
  },
  submitPressed: { opacity: 0.88 },
  submitDisabled: { opacity: 0.55 },
  submitText: { fontSize: 15, color: theme.ink, ...parchmentSans(600) },
});
