import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { parchmentSans } from "../fonts/parchmentType";
import { useLocale } from "../i18n/LocaleProvider";
import { theme } from "../theme";
import { isNativeAppleSignInAvailable } from "./appleSignIn";
import { isNativeGoogleSignInAvailable } from "./googleSignIn";
import { GoogleBrandIcon } from "./OAuthBrandIcons";

type ButtonProps = {
  pending?: boolean;
  onPress: () => void | Promise<void>;
};

export function MemberGoogleSignInButton({ pending = false, onPress }: ButtonProps) {
  const { t } = useLocale();
  const [localPending, setLocalPending] = useState(false);
  const busy = pending || localPending;

  if (!isNativeGoogleSignInAvailable()) return null;

  return (
    <Pressable
      onPress={() => {
        if (busy) return;
        setLocalPending(true);
        void Promise.resolve(onPress()).finally(() => setLocalPending(false));
      }}
      disabled={busy}
      style={({ pressed }) => [styles.googleButton, pressed && styles.buttonPressed, busy && styles.buttonDisabled]}
      accessibilityRole="button"
    >
      {busy ? (
        <ActivityIndicator color={theme.ink} />
      ) : (
        <View style={styles.buttonContent}>
          <View style={styles.buttonIconSlot}>
            <GoogleBrandIcon />
          </View>
          <Text style={styles.googleButtonText}>{t("auth.continueWithGoogle")}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function MemberAppleSignInButton({ pending = false, onPress }: ButtonProps) {
  const [available, setAvailable] = useState(false);
  const [localPending, setLocalPending] = useState(false);
  const busy = pending || localPending;

  useEffect(() => {
    void isNativeAppleSignInAvailable().then(setAvailable);
  }, []);

  if (!available) return null;

  if (busy) {
    return (
      <View style={styles.appleNativeButtonBusy}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={12}
      style={styles.appleNativeButton}
      onPress={() => {
        setLocalPending(true);
        void Promise.resolve(onPress()).finally(() => setLocalPending(false));
      }}
    />
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
  googleButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(55,53,47,0.18)",
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  appleNativeButton: {
    width: "100%",
    height: 48,
  },
  appleNativeButtonBusy: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#111111",
  },
  buttonPressed: { opacity: 0.88 },
  buttonDisabled: { opacity: 0.55 },
  buttonContent: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    paddingHorizontal: 16,
  },
  buttonIconSlot: {
    position: "absolute",
    left: 16,
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  googleButtonText: { fontSize: 15, color: theme.ink, ...parchmentSans(600) },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 16 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(55,53,47,0.12)" },
  dividerText: {
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "rgba(55,53,47,0.38)",
    ...parchmentSans(600),
  },
});
