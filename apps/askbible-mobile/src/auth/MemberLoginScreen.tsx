import { useRouter } from "expo-router";
import { useState, useSyncExternalStore } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { AuthParchmentScreen } from "./AuthParchmentScreen";
import { authFormSurface as s } from "./authFormSurface";
import { useMemberAuth } from "./MemberAuthProvider";
import { MemberAppleSignInButton, MemberAuthMethodDivider, MemberGoogleSignInButton } from "./MemberSocialSignInButtons";
import {
  getMemberRegisterEnabled,
  subscribeMemberRegisterEnabled,
} from "./member-register-enabled";
import { resolveMemberOAuthError } from "./resolveMemberOAuthError";
import { useLocale } from "../i18n/LocaleProvider";
import { readParchmentTheme as c } from "../read/readParchmentTheme";

export function MemberLoginScreen() {
  const router = useRouter();
  const { t } = useLocale();
  const { signIn, signInWithGoogle, signInWithApple } = useMemberAuth();

  const authOpen = useSyncExternalStore(
    subscribeMemberRegisterEnabled,
    getMemberRegisterEnabled,
    getMemberRegisterEnabled,
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [applePending, setApplePending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [appleError, setAppleError] = useState<string | null>(null);

  const oauthBusy = googlePending || applePending;

  async function onGoogleSignIn() {
    if (pending || oauthBusy) return;
    if (!authOpen) {
      setError(t("auth.registerClosed"));
      return;
    }
    setGooglePending(true);
    setError(null);
    setGoogleError(null);
    setAppleError(null);
    try {
      const result = await signInWithGoogle();
      if (!result.ok) {
        const message = resolveMemberOAuthError("google", t, result);
        if (message) setGoogleError(message);
        return;
      }
    } catch (err) {
      if (__DEV__) {
        console.warn("[MemberLoginScreen] Google sign-in threw", err);
      }
      setGoogleError(t("auth.errorNetwork"));
    } finally {
      setGooglePending(false);
    }
  }

  async function onAppleSignIn() {
    if (pending || oauthBusy) return;
    if (!authOpen) {
      setError(t("auth.registerClosed"));
      return;
    }
    setApplePending(true);
    setError(null);
    setGoogleError(null);
    setAppleError(null);
    try {
      const result = await signInWithApple();
      if (!result.ok) {
        const message = resolveMemberOAuthError("apple", t, result);
        if (message) setAppleError(message);
        return;
      }
    } catch {
      setAppleError(t("auth.errorNetwork"));
    } finally {
      setApplePending(false);
    }
  }

  async function onSubmit() {
    if (pending || oauthBusy) return;
    if (!authOpen) {
      setError(t("auth.registerClosed"));
      return;
    }
    setPending(true);
    setError(null);
    setGoogleError(null);
    setAppleError(null);
    try {
      const result = await signIn({ email: email.trim(), password });
      if (!result.ok) {
        setError(result.error === "network" ? t("auth.errorNetwork") : result.error || t("auth.errorWrong"));
        return;
      }
    } catch {
      setError(t("auth.errorNetwork"));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthParchmentScreen>
      <Pressable onPress={() => router.back()} style={s.backBtn} accessibilityRole="button">
        <Text style={s.backText}>{t("auth.backHome")}</Text>
      </Pressable>

      <Text style={s.title}>{t("auth.pageTitle")}</Text>
      <Text style={s.intro}>{authOpen ? t("auth.registerIntro") : t("auth.registerClosed")}</Text>

      {authOpen ? (
        <View style={s.form}>
          <MemberGoogleSignInButton pending={googlePending} disabled={oauthBusy} errorMessage={googleError} onPress={onGoogleSignIn} />
          <MemberAppleSignInButton pending={applePending} disabled={oauthBusy} errorMessage={appleError} onPress={onAppleSignIn} />
          <MemberAuthMethodDivider />
          <Text style={s.label}>{t("auth.email")}</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            style={s.input}
          />
          <Text style={s.label}>{t("auth.password")}</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            style={s.input}
          />
          {error ? <Text style={s.error}>{error}</Text> : null}
          <Pressable
            onPress={() => void onSubmit()}
            disabled={pending}
            style={({ pressed }) => [s.submit, pressed && s.submitPressed, pending && s.submitDisabled]}
          >
            {pending ? (
              <ActivityIndicator color={c.ink} />
            ) : (
              <Text style={s.submitText}>{t("auth.submit")}</Text>
            )}
          </Pressable>
          <Pressable onPress={() => router.replace("/register")} style={s.linkBtn}>
            <Text style={s.linkText}>{t("auth.loginFooterRegister")}</Text>
          </Pressable>
        </View>
      ) : null}
    </AuthParchmentScreen>
  );
}
