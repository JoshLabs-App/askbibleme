import { StyleSheet, View } from "react-native";
import { UnifiedReadingWelcomeFlow } from "../explore/reading-planner/UnifiedReadingWelcomeFlow";
import { ReadParchmentBackground } from "../read/ReadParchmentBackground";

type OnboardingDevotionIntroProps = {
  onComplete: () => void;
};

export function OnboardingDevotionIntro({ onComplete }: OnboardingDevotionIntroProps) {
  return (
    <View style={styles.overlay}>
      <ReadParchmentBackground>
        <UnifiedReadingWelcomeFlow entry="welcome" onComplete={onComplete} />
      </ReadParchmentBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    elevation: 10000,
  },
});
