import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "../read/readParchmentTheme";
import { parchmentControlSurface } from "../shell/parchmentControlSurface";
import { OAUTH_BRAND_ICON_SLOT_PX } from "./oauth-brand-icon-paths";
import { AppleBrandIcon, GoogleBrandIcon } from "./OAuthBrandIcons";

type Props = {
  label: string;
  pending?: boolean;
  disabled?: boolean;
  onPress: () => void | Promise<void>;
  variant: "google" | "apple";
  style?: StyleProp<ViewStyle>;
};

const BUTTON_HORIZONTAL_PADDING = 16;

export function OAuthProviderButton({ label, pending = false, disabled = false, onPress, variant, style }: Props) {
  const isApple = variant === "apple";
  const inactive = disabled || pending;

  return (
    <Pressable
      onPress={() => {
        if (inactive) return;
        void onPress();
      }}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        isApple ? styles.appleButton : styles.googleButton,
        pressed && !inactive && styles.buttonPressed,
        inactive && styles.buttonDisabled,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {pending ? (
        <ActivityIndicator color={isApple ? "#fff" : c.ink} />
      ) : (
        <View style={styles.buttonContent}>
          <View style={styles.iconSlot}>
            {isApple ? (
              <AppleBrandIcon color="#ffffff" />
            ) : (
              <GoogleBrandIcon />
            )}
          </View>
          <Text style={[styles.buttonText, isApple && styles.appleButtonText]} numberOfLines={2}>
            {label}
          </Text>
          <View style={styles.iconSlot} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    borderRadius: 12,
    width: "100%",
  },
  googleButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: parchmentControlSurface.border,
    backgroundColor: parchmentControlSurface.fillStrong,
  },
  appleButton: {
    backgroundColor: "#111111",
  },
  buttonPressed: { opacity: 0.88 },
  buttonDisabled: { opacity: 0.55 },
  buttonContent: {
    width: "100%",
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: BUTTON_HORIZONTAL_PADDING,
  },
  iconSlot: {
    width: OAUTH_BRAND_ICON_SLOT_PX,
    height: OAUTH_BRAND_ICON_SLOT_PX,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    flex: 1,
    flexShrink: 1,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 20,
    color: c.ink,
    ...parchmentSans(600),
  },
  appleButtonText: {
    color: "#ffffff",
  },
});
