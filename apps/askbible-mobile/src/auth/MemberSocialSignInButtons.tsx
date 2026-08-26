import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import { useLocale } from "../i18n/LocaleProvider";
import { readParchmentTheme as c } from "../read/readParchmentTheme";
import { isNativeAppleSignInAvailable } from "./appleSignIn";
import { OAuthProviderButton } from "./OAuthProviderButton";

type ButtonProps = {
  pending?: boolean;
  disabled?: boolean;
  errorMessage?: string | null;
  onPress: () => void | Promise<void>;
};

function OAuthInlineError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <Text style={styles.oauthError} accessibilityRole="alert">
      {message}
    </Text>
  );
}

export function MemberGoogleSignInButton({ pending = false, disabled = false, errorMessage = null, onPress }: ButtonProps) {
  const { t } = useLocale();
  const [localPending, setLocalPending] = useState(false);
  const busy = pending || localPending;
  const inactive = disabled && !busy;

  return (
    <View style={styles.oauthBlock}>
      <OAuthProviderButton
        variant="google"
        label={t("auth.continueWithGoogle")}
        pending={busy}
        disabled={inactive}
        onPress={() => {
          setLocalPending(true);
          void Promise.resolve(onPress()).finally(() => setLocalPending(false));
        }}
      />
      <OAuthInlineError message={errorMessage} />
    </View>
  );
}

export function MemberAppleSignInButton({ pending = false, disabled = false, errorMessage = null, onPress }: ButtonProps) {
  const { t } = useLocale();
  const [available, setAvailable] = useState(false);
  const [localPending, setLocalPending] = useState(false);
  const busy = pending || localPending;
  const inactive = disabled && !busy;

  useEffect(() => {
    void isNativeAppleSignInAvailable().then(setAvailable);
  }, []);

  if (!available) return null;

  return (
    <View style={styles.oauthBlock}>
      <OAuthProviderButton
        variant="apple"
        label={t("auth.continueWithApple")}
        pending={busy}
        disabled={inactive}
        onPress={() => {
          setLocalPending(true);
          void Promise.resolve(onPress()).finally(() => setLocalPending(false));
        }}
      />
      <OAuthInlineError message={errorMessage} />
    </View>
  );
}

export function MemberAuthMethodDivider() {
  const { t } = useLocale();
  return (
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>{t("auth.orDivider")}</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  oauthBlock: { gap: 6 },
  oauthError: {
    fontSize: 13,
    lineHeight: 18,
    color: "#b42318",
    textAlign: "center",
    ...parchmentSans(500),
  },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 16 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: c.border },
  dividerText: {
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: c.faint,
    ...parchmentSans(600),
  },
});
