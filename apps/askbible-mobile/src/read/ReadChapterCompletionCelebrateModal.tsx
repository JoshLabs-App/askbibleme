import { Audio } from "expo-av";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { Animated, Easing, Modal, Pressable, Text, View } from "react-native";
import { readChapterCompletionPlanPanelStyles as styles } from "./readChapterCompletionPlanPanelStyles";

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
  const router = useRouter();
  const celebrationSoundRef = useRef<Audio.Sound | null>(null);
  const celebrateScale = useRef(new Animated.Value(0.9)).current;
  const celebrateOpacity = useRef(new Animated.Value(0)).current;
  const sparklePulse = useRef(new Animated.Value(0)).current;
  const celebrateCtaPulse = useRef(new Animated.Value(0)).current;
  const sparkleLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const stopSparkleLoop = useCallback(() => {
    sparkleLoopRef.current?.stop();
    sparkleLoopRef.current = null;
  }, []);

  const startCelebrateAnimation = useCallback(() => {
    stopSparkleLoop();
    celebrateScale.setValue(0.9);
    celebrateOpacity.setValue(0);
    sparklePulse.setValue(0);
    celebrateCtaPulse.setValue(0);
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

    Animated.sequence([
      Animated.delay(260),
      Animated.timing(celebrateCtaPulse, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(celebrateCtaPulse, {
        toValue: 0,
        duration: 220,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [celebrateCtaPulse, celebrateOpacity, celebrateScale, sparklePulse, stopSparkleLoop]);

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

  const closeCelebrate = useCallback(() => {
    stopSparkleLoop();
    onClose();
  }, [onClose, stopSparkleLoop]);

  useEffect(() => {
    if (!visible) return;
    startCelebrateAnimation();
    void playCelebrateSound();
  }, [visible, startCelebrateAnimation, playCelebrateSound]);

  useEffect(() => {
    return () => {
      stopSparkleLoop();
      const sound = celebrationSoundRef.current;
      if (sound) {
        celebrationSoundRef.current = null;
        void sound.unloadAsync();
      }
    };
  }, [stopSparkleLoop]);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={closeCelebrate}>
      <View style={styles.celebrateMask}>
        <Animated.View
          style={[
            styles.celebrateCard,
            {
              opacity: celebrateOpacity,
              transform: [{ scale: celebrateScale }],
            },
          ]}
        >
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
          <Text style={styles.celebrateBody}>
            {isEnglishDisplay
              ? "You completed all today's readings. Keep this quiet rhythm tomorrow."
              : localeZhText("你已完成今天所有读经计划。愿你把这份安静带进下一天。")}
          </Text>
          <View style={styles.celebrateActions}>
            <Pressable
              onPress={closeCelebrate}
              style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
            >
              <Text style={styles.actionText}>{isEnglishDisplay ? "Keep Reading" : localeZhText("继续阅读")}</Text>
            </Pressable>
            <Animated.View
              style={[
                styles.celebrateCtaWrap,
                {
                  transform: [
                    {
                      scale: celebrateCtaPulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.04],
                      }),
                    },
                  ],
                  shadowOpacity: celebrateCtaPulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.12, 0.28],
                  }),
                },
              ]}
            >
              <Pressable
                onPress={() => {
                  closeCelebrate();
                  router.push("/read");
                }}
                style={({ pressed }) => [styles.actionBtn, styles.actionPrimary, pressed && styles.pressed]}
              >
                <Text style={[styles.actionText, styles.actionPrimaryText]}>
                  {isEnglishDisplay ? "Back to Home" : localeZhText("回到读经首页")}
                </Text>
              </Pressable>
            </Animated.View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
