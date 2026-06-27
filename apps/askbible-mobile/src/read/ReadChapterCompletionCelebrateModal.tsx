import { Audio } from "expo-av";
import { useCallback, useEffect, useRef } from "react";
import { Animated, Easing, Modal, Text, View } from "react-native";
import { ParchmentModalCard } from "../shell/ParchmentControlSheet";
import { readChapterCompletionPlanPanelStyles as styles } from "./readChapterCompletionPlanPanelStyles";

const AUTO_DISMISS_MS = 2000;

type Props = {
  visible: boolean;
  onClose: () => void;
  isEnglishDisplay: boolean;
  localeZhText: (text: string) => string;
};

export function ReadChapterCompletionCelebrateModal({
  visible,
  onClose,
  isEnglishDisplay,
  localeZhText,
}: Props) {
  const celebrationSoundRef = useRef<Audio.Sound | null>(null);
  const celebrateScale = useRef(new Animated.Value(0.9)).current;
  const celebrateOpacity = useRef(new Animated.Value(0)).current;
  const sparklePulse = useRef(new Animated.Value(0)).current;
  const sparkleLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingRef = useRef(false);

  const stopSparkleLoop = useCallback(() => {
    sparkleLoopRef.current?.stop();
    sparkleLoopRef.current = null;
  }, []);

  const startCelebrateAnimation = useCallback(() => {
    stopSparkleLoop();
    celebrateScale.setValue(0.9);
    celebrateOpacity.setValue(0);
    sparklePulse.setValue(0);
    Animated.parallel([
      Animated.timing(celebrateOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(celebrateScale, {
        toValue: 1,
        damping: 14,
        stiffness: 180,
        mass: 0.8,
        useNativeDriver: true,
      }),
    ]).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sparklePulse, {
          toValue: 1,
          duration: 760,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(sparklePulse, {
          toValue: 0,
          duration: 760,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    sparkleLoopRef.current = loop;
    loop.start();
  }, [celebrateOpacity, celebrateScale, sparklePulse, stopSparkleLoop]);

  const playCelebrateSound = useCallback(async () => {
    try {
      if (!celebrationSoundRef.current) {
        const { sound } = await Audio.Sound.createAsync(
          require("../../assets/audio/today-plan-complete.mp3"),
          { shouldPlay: false, volume: 1 },
        );
        celebrationSoundRef.current = sound;
      }
      await celebrationSoundRef.current.replayAsync();
    } catch {
      /* ignore audio playback errors */
    }
  }, []);

  const dismissCelebrate = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    stopSparkleLoop();
    Animated.timing(celebrateOpacity, {
      toValue: 0,
      duration: 280,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        closingRef.current = false;
        onClose();
      }
    });
  }, [celebrateOpacity, onClose, stopSparkleLoop]);

  useEffect(() => {
    if (!visible) {
      closingRef.current = false;
      return;
    }
    startCelebrateAnimation();
    void playCelebrateSound();
    dismissTimerRef.current = setTimeout(() => {
      dismissCelebrate();
    }, AUTO_DISMISS_MS);
    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
    };
  }, [visible, startCelebrateAnimation, playCelebrateSound, dismissCelebrate]);

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
      stopSparkleLoop();
      const sound = celebrationSoundRef.current;
      if (sound) {
        celebrationSoundRef.current = null;
        void sound.unloadAsync();
      }
    };
  }, [stopSparkleLoop]);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={dismissCelebrate}>
      <View style={styles.celebrateMask}>
        <Animated.View
          style={[
            styles.celebrateCardWrap,
            {
              opacity: celebrateOpacity,
              transform: [{ scale: celebrateScale }],
            },
          ]}
        >
          <ParchmentModalCard style={styles.celebrateCard}>
            <Animated.View
              style={[
                styles.sparkleRow,
                {
                  opacity: sparklePulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
                  transform: [
                    {
                      translateY: sparklePulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [2, -2],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.sparkle}>✨</Text>
              <Text style={styles.sparkle}>🎉</Text>
              <Text style={styles.sparkle}>✨</Text>
            </Animated.View>
            <Text style={styles.celebrateEmoji}>🎉</Text>
            <Text style={styles.celebrateTitle}>
              {isEnglishDisplay ? "Great Job!" : localeZhText("恭喜你，今天完成了！")}
            </Text>
          </ParchmentModalCard>
        </Animated.View>
      </View>
    </Modal>
  );
}
