import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ParchmentBottomFadeScrollView } from "../read/ParchmentBottomFadeScrollView";
import { useParchmentColumnMaxWidth } from "../read/parchmentColumnLayout";
import { ReadParchmentBackground } from "../read/ReadParchmentBackground";

type Props = {
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

/** 登录 / 注册：全屏羊皮卷底 + 窄栏版心（与网站 AuthParchmentChrome 一致）。 */
export function AuthParchmentScreen({ children, contentStyle }: Props) {
  const insets = useSafeAreaInsets();
  const columnMaxWidth = useParchmentColumnMaxWidth();

  return (
    <ReadParchmentBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ParchmentBottomFadeScrollView
          fadePreset="prose"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 20,
            paddingTop: insets.top + 8,
            paddingBottom: insets.bottom + 24,
          }}
        >
          <View
            style={[
              { width: "100%", alignSelf: "center", maxWidth: columnMaxWidth },
              contentStyle,
            ]}
          >
            {children}
          </View>
        </ParchmentBottomFadeScrollView>
      </KeyboardAvoidingView>
    </ReadParchmentBackground>
  );
}
