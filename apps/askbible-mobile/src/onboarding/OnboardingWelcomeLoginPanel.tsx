import { useState, useSyncExternalStore } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { authFormSurface as s } from "../auth/authFormSurface";
import { useMemberAuth } from "../auth/MemberAuthProvider";
import {
  MemberAppleSignInButton,
  MemberAuthMethodDivider,
  MemberGoogleSignInButton,
} from "../auth/MemberSocialSignInButtons";
import {
  getMemberRegisterEnabled,
  subscribeMemberRegisterEnabled,
} from "../auth/member-register-enabled";
import { resolveMemberOAuthError } from "../auth/resolveMemberOAuthError";
import { useLocale } from "../i18n/LocaleProvider";
import { parchmentControlSurface } from "../shell/parchmentControlSurface";
import { readParchmentTheme as c } from "../read/readParchmentTheme";

type Props = {
  disabled?: boolean;
  onSignedIn: () => void;
};

export function OnboardingWelcomeLoginPanel({ disabled = false, onSignedIn }: Props) {
  const { locale, t } = useLocale();
  const { signIn, completeRegistration, signInWithGoogle, signInWithApple } = useMemberAuth();

  const authOpen = useSyncExternalStore(
    subscribeMemberRegisterEnabled,
    getMemberRegisterEnabled,
    getMemberRegisterEnabled,
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showNickname, setShowNickname] = useState(false);
  const [pendingAction, setPendingAction] = useState<"login" | "register" | null>(null);
  const [googlePending, setGooglePending] = useState(false);
  const [applePending, setApplePending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [appleError, setAppleError] = useState<string | null>(null);

  const oauthBusy = googlePending || applePending;
  const formBusy = pendingAction != null;
  const busy = formBusy || oauthBusy || disabled;

  function clearErrors() {
    setError(null);
    setGoogleError(null);
    setAppleError(null);
  }

  async function finishIfOk(ok: boolean) {
    if (ok) onSignedIn();
  }

  async function onGoogleSignIn() {
    if (busy) return;
    if (!authOpen) {
      setError(t("auth.registerClosed"));
      return;
    }
    setGooglePending(true);
    clearErrors();
    try {
      const result = await signInWithGoogle();
      if (!result.ok) {
        const message = resolveMemberOAuthError("google", t, result);
        if (message) setGoogleError(message);
        return;
      }
      await finishIfOk(true);
    } catch {
      setGoogleError(t("auth.errorNetwork"));
    } finally {
      setGooglePending(false);
    }
  }

  async function onAppleSignIn() {
    if (busy) return;
    if (!authOpen) {
      setError(t("auth.registerClosed"));
      return;
    }
    setApplePending(true);
    clearErrors();
    try {
      const result = await signInWithApple();
      if (!result.ok) {
        const message = resolveMemberOAuthError("apple", t, result);
        if (message) setAppleError(message);
        return;
      }
      await finishIfOk(true);
    } catch {
      setAppleError(t("auth.errorNetwork"));
    } finally {
      setApplePending(false);
    }
  }

  async function onLogin() {
    if (busy) return;
    if (!authOpen) {
      setError(t("auth.registerClosed"));
      return;
    }
    setShowNickname(false);
    setPendingAction("login");
    clearErrors();
    try {
      const result = await signIn({ email: email.trim(), password });
      if (!result.ok) {
        setError(result.error === "network" ? t("auth.errorNetwork") : result.error || t("auth.errorWrong"));
        return;
      }
      await finishIfOk(true);
    } catch {
      setError(t("auth.errorNetwork"));
    } finally {
      setPendingAction(null);
    }
  }

  async function onRegister() {
    if (busy) return;
    if (!authOpen) {
      setError(t("auth.registerClosed"));
      return;
    }
    clearErrors();
    if (!showNickname) {
      setShowNickname(true);
      return;
    }
    setPendingAction("register");
    try {
      const result = await completeRegistration({
        email: email.trim(),
        password,
        name: name.trim(),
        locale,
      });
      if (!result.ok) {
        setError(result.error === "network" ? t("auth.errorNetwork") : result.error || t("auth.errorNetwork"));
        return;
      }
      await finishIfOk(true);
    } catch {
      setError(t("auth.errorNetwork"));
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <View style={styles.block}>
      {!authOpen ? <Text style={s.intro}>{t("auth.registerClosed")}</Text> : null}

      {authOpen ? (
        <View style={[s.form, styles.formFit]}>
          <MemberGoogleSignInButton
            pending={googlePending}
            disabled={busy}
            errorMessage={googleError}
            onPress={onGoogleSignIn}
          />
          <MemberAppleSignInButton
            pending={applePending}
            disabled={busy}
            errorMessage={appleError}
            onPress={onAppleSignIn}
          />
          <MemberAuthMethodDivider />
          <Text style={s.label}>{t("auth.email")}</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            editable={!busy}
            style={s.input}
          />
          {showNickname ? (
            <>
              <Text style={s.label}>{t("auth.registerName")}</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                textContentType="name"
                editable={!busy}
                style={s.input}
                autoFocus
              />
            </>
          ) : null}
          <Text style={s.label}>{t("auth.password")}</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            editable={!busy}
            style={s.input}
          />
          {error ? <Text style={s.error}>{error}</Text> : null}
          <View style={styles.actionRow}>
            <Pressable
              onPress={() => void onLogin()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={t("auth.submit")}
              style={({ pressed }) => [
                styles.actionBtn,
                pressed && s.submitPressed,
                busy && s.submitDisabled,
              ]}
            >
              {pendingAction === "login" ? (
                <ActivityIndicator color={c.ink} />
              ) : (
                <Text style={styles.actionBtnText}>{t("auth.submit")}</Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => void onRegister()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={t("auth.registerSubmit")}
              style={({ pressed }) => [
                styles.actionBtn,
                pressed && s.submitPressed,
                busy && s.submitDisabled,
              ]}
            >
              {pendingAction === "register" ? (
                <ActivityIndicator color={c.ink} />
              ) : (
                <Text style={styles.actionBtnText}>{t("auth.registerSubmit")}</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    width: "100%",
  },
  formFit: {
    marginTop: 0,
    gap: 10,
  },
  actionRow: {
    marginTop: 16,
    flexDirection: "row",
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    borderRadius: parchmentControlSurface.radiusMd,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: parchmentControlSurface.border,
    backgroundColor: parchmentControlSurface.fillStrong,
  },
  actionBtnText: {
    fontSize: 15,
    color: c.ink,
    fontWeight: "600",
  },
});
