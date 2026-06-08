import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MinimalProgressBar } from "../ui/MinimalProgressBar";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import { MusicEnergyGlow } from "./MusicEnergyGlow";
import { musicCopy } from "./musicCopy";
import { useShellSwipeAction } from "../shell/useShellSwipeAction";
import { useMusicPlayback } from "./MusicPlaybackContext";
import { isTrackPlayable } from "./trackArtwork";
import { setMusicAutoHideChrome } from "./musicAutoHideChrome";
import { useTrackAnalysis } from "./useTrackAnalysis";
import { sampleTrackAnalysisAt } from "./trackAnalysis";
import {
  SHELL_TAB_BAR_CLEARANCE_MUSIC,
  shellFullBleedBackdropStyle,
  useShellFullBleedFrame,
} from "../shell/shellLayout";

type Props = {
  layout?: "tab" | "stack";
};

const COFFEE_GRADIENT: readonly [string, string, string] = ["#f3e6d8", "#dcc4ab", "#b69173"];
const AQUA_GRADIENT: readonly [string, string, string] = ["#10C0DF", "#0e8ca3", "#0a2a33"];
const WORK_GRAY_GRADIENT: readonly [string, string, string] = ["#22324e", "#18243a", "#0b1222"];
const DEEP_BLUE_GRADIENT: readonly [string, string, string] = ["#0d1d46", "#081233", "#030816"];
const KNOWN_MUSIC_ALBUMS = ["安静", "下午茶", "专注工作", "睡眠"] as const;
const DEFAULT_ALBUM = "安静";
const QUEUE_VIEWPORT_HEIGHT = 168;
const QUEUE_ROW_HEIGHT = 40;
const QUEUE_FADE_BAND = 46;
const QUEUE_RECENTER_IDLE_MS = 5000;
const MUSIC_UI_AUTO_HIDE_MS = 5000;
const METEOR_COUNT = 4;
const STAR_COUNT = 28;
const FISH_COUNT = 100;
const COFFEE_BEAN_COUNT = 34;
const WHITE_COFFEE_BEAN_INDEX = 0;
const FOLLOW_WHITE_COFFEE_BEAN_INDICES = [1, 2, 3] as const;
const COFFEE_CUP_ICON_SIZE = 88;
const FOCUS_ORB_CENTER_Y_RATIO = 0.382;
const COFFEE_ORBIT_VISIBLE_PADDING = 4;
const COFFEE_ORBIT_MIN_RADIUS = 34;
const BREATH_RING_WRAP_HEIGHT = 190;
const BREATH_RING_WRAP_MARGIN_BOTTOM = 6;
const ALBUM_GLOW: Record<string, readonly [string, string, string]> = {
  安静: AQUA_GRADIENT,
  下午茶: COFFEE_GRADIENT,
  专注工作: WORK_GRAY_GRADIENT,
  睡眠: DEEP_BLUE_GRADIENT,
};
const ALBUM_SWATCH: Record<string, string> = {
  安静: "#10C0DF",
  下午茶: "#f0ddca",
  专注工作: "#7f97be",
  睡眠: "#0a1736",
};
const ALBUM_ICON: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  安静: "spa",
  下午茶: "local-cafe",
  专注工作: "work-outline",
  睡眠: "dark-mode",
};
const FISH_SHAPE = require("../../assets/images/fish-shape.png");
const SLEEP_MOON_SHAPE = require("../../assets/images/sleep-crescent-moon.png");
const COFFEE_BEAN_SHAPE = require("../../assets/images/coffee-bean-shape.png");

function pseudoRandom01(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function coffeeVisualCenterY(
  containerHeight: number,
  centered: boolean,
  viewportHeight: number,
  viewportTop: number,
): number {
  if (centered) return containerHeight / 2;
  const focusCenterYOnScreen = viewportHeight * FOCUS_ORB_CENTER_Y_RATIO;
  return focusCenterYOnScreen - viewportTop;
}

function formatClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function formatNowClock(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function normalizeTrackAlbum(rawAlbum: string | null | undefined): string {
  const input = (rawAlbum || "").trim();
  if (!input) return DEFAULT_ALBUM;
  if (input === "工作") return "专注工作";
  return input;
}

function inferTrackAlbumLabel(track: { album?: string }): string {
  return normalizeTrackAlbum(track.album);
}

function albumGlowColors(album: string): readonly [string, string, string] {
  return ALBUM_GLOW[album] ?? AQUA_GRADIENT;
}

function albumSwatchColor(album: string): string {
  return ALBUM_SWATCH[album] ?? "#7f97be";
}

function albumIconName(album: string): keyof typeof MaterialIcons.glyphMap {
  return ALBUM_ICON[album] ?? "album";
}

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function rowOpacityByScroll(rowIndex: number, scrollY: number, active: boolean): number {
  const rowCenter = rowIndex * QUEUE_ROW_HEIGHT + QUEUE_ROW_HEIGHT / 2 - scrollY;
  if (rowCenter <= 0 || rowCenter >= QUEUE_VIEWPORT_HEIGHT) return 0;
  const topFade = clamp01(rowCenter / QUEUE_FADE_BAND);
  const bottomFade = clamp01((QUEUE_VIEWPORT_HEIGHT - rowCenter) / QUEUE_FADE_BAND);
  const edgeFade = Math.min(topFade, bottomFade);
  const base = Math.pow(edgeFade, 1.05);
  if (active) return Math.min(1, base * 0.96 + 0.04);
  return Math.max(0, base * 0.92);
}

function rowScaleByScroll(rowIndex: number, scrollY: number, active: boolean): number {
  const rowCenter = rowIndex * QUEUE_ROW_HEIGHT + QUEUE_ROW_HEIGHT / 2 - scrollY;
  const center = QUEUE_VIEWPORT_HEIGHT / 2;
  const nearCenter = 1 - clamp01(Math.abs(rowCenter - center) / Math.max(1, center * 0.85));
  const base = 1 + nearCenter * 0.08;
  if (active) return Math.max(base, 1.14);
  return base;
}

function BreathingRing({
  active,
  centered = false,
  containerHeight,
  viewportHeight,
  viewportTop = 0,
}: {
  active: boolean;
  centered?: boolean;
  containerHeight: number;
  viewportHeight: number;
  viewportTop?: number;
}) {
  const phase = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const inhaleMs = 7000;
    const holdMs = 1800;
    const exhaleMs = 8000;
    const cycleMs = inhaleMs + holdMs + exhaleMs + holdMs;

    if (!active) {
      phase.stopAnimation();
      phase.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        // 吸气
        Animated.timing(phase, {
          toValue: 1,
          duration: inhaleMs,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        // 停留
        Animated.delay(holdMs),
        // 呼气
        Animated.timing(phase, {
          toValue: 0,
          duration: exhaleMs,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        // 停留
        Animated.delay(holdMs),
      ]),
    );

    loop.start();
    return () => {
      loop.stop();
    };
  }, [active, phase]);
  const circleScale = phase.interpolate({
    inputRange: [0, 1],
    outputRange: [0.62, 1.46],
  });
  const circleOpacity = phase.interpolate({
    inputRange: [0, 1],
    outputRange: [0.42, 0.82],
  });
  const glowOpacity = phase.interpolate({
    inputRange: [0, 1],
    outputRange: [0.28, 0.6],
  });
  const circleColor = "rgba(233,236,242,0.62)";
  const baseY = containerHeight - (BREATH_RING_WRAP_MARGIN_BOTTOM + BREATH_RING_WRAP_HEIGHT / 2);
  const targetY = coffeeVisualCenterY(containerHeight, centered, viewportHeight, viewportTop);
  const ringTranslateY = centered ? 0 : targetY - baseY;
  return (
    <View
      style={[
        styles.breathRingWrap,
        { transform: [{ translateY: ringTranslateY }] },
        centered && styles.centerVisualLandscape,
      ]}
      pointerEvents="none"
    >
      <Animated.View
        style={[
          styles.breathPulseGlow,
          {
            opacity: glowOpacity,
            transform: [{ scale: circleScale }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.breathPulseCircle,
          {
            backgroundColor: circleColor,
            opacity: circleOpacity,
            transform: [{ scale: circleScale }],
          },
        ]}
      />
    </View>
  );
}

function SunOrb({
  active,
  centered = false,
  containerHeight,
  viewportHeight,
  viewportTop = 0,
}: {
  active: boolean;
  centered?: boolean;
  containerHeight: number;
  viewportHeight: number;
  viewportTop?: number;
}) {
  const phase = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      phase.stopAnimation();
      phase.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(phase, {
          toValue: 1,
          duration: 5200,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(phase, {
          toValue: 0,
          duration: 5200,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, phase]);

  const cupGlowOpacity = phase.interpolate({
    inputRange: [0, 1],
    outputRange: [0.16, 0.34],
  });
  const baseY = containerHeight - (BREATH_RING_WRAP_MARGIN_BOTTOM + BREATH_RING_WRAP_HEIGHT / 2);
  const targetY = coffeeVisualCenterY(containerHeight, centered, viewportHeight, viewportTop);
  const coffeeTranslateY = centered ? 0 : targetY - baseY;
  return (
    <View
      style={[
        styles.coffeeWrap,
        { transform: [{ translateY: coffeeTranslateY }] },
        centered && styles.centerVisualLandscape,
      ]}
      pointerEvents="none"
    >
      <Animated.View
        style={[
          styles.coffeeGlow,
          {
            opacity: cupGlowOpacity,
          },
        ]}
      />
      <MaterialIcons
        name="local-cafe"
        size={COFFEE_CUP_ICON_SIZE}
        color="#fff7ef"
        style={styles.coffeeCupIcon}
      />
    </View>
  );
}

function SleepCrescentMoon({ active, centered = false }: { active: boolean; centered?: boolean }) {
  const phase = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    phase.stopAnimation();
    if (!active) {
      phase.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(phase, {
          toValue: 1,
          duration: 7200,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(phase, {
          toValue: 0,
          duration: 7200,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, phase]);

  if (!active) return null;
  const moonOpacity = phase.interpolate({
    inputRange: [0, 1],
    outputRange: [0.42, 0.78],
  });
  return (
    <View style={[styles.sleepMoonWrap, centered && styles.centerVisualLandscape]} pointerEvents="none">
      <Animated.View style={{ opacity: moonOpacity }}>
        <Image source={SLEEP_MOON_SHAPE} style={styles.sleepMoonImage} resizeMode="contain" />
      </Animated.View>
    </View>
  );
}

function CoffeeBeanOrbit({
  active,
  width,
  height,
  viewportHeight,
  viewportTop = 0,
  centered = false,
  rhythmPulse = 0,
}: {
  active: boolean;
  width: number;
  height: number;
  viewportHeight: number;
  viewportTop?: number;
  centered?: boolean;
  rhythmPulse?: number;
}) {
  const orbitValuesRef = useRef(
    Array.from({ length: COFFEE_BEAN_COUNT }, () => new Animated.Value(0)),
  ).current;
  const bobValuesRef = useRef(
    Array.from({ length: COFFEE_BEAN_COUNT }, () => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    orbitValuesRef.forEach((v) => v.stopAnimation());
    bobValuesRef.forEach((v) => v.stopAnimation());
    if (!active) return;

    const orbitLoops = orbitValuesRef.map((v, i) => {
      const isLeader = i === WHITE_COFFEE_BEAN_INDEX;
      const isFollower = FOLLOW_WHITE_COFFEE_BEAN_INDICES.includes(
        i as (typeof FOLLOW_WHITE_COFFEE_BEAN_INDICES)[number],
      );
      const baseDuration = isLeader ? 24500 : isFollower ? 27200 : 29400;
      const jitter = Math.floor(pseudoRandom01(i * 31 + 7) * 9000);
      v.setValue(0);
      return Animated.loop(
        Animated.timing(v, {
          toValue: 1,
          duration: baseDuration + jitter,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        { resetBeforeIteration: false },
      );
    });

    const bobLoops = bobValuesRef.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(120 + Math.floor(pseudoRandom01(i * 53 + 11) * 1200)),
          Animated.timing(v, {
            toValue: 1,
            duration: 5200 + Math.floor(pseudoRandom01(i * 43 + 5) * 2800),
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0,
            duration: 5200 + Math.floor(pseudoRandom01(i * 47 + 3) * 2800),
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        { resetBeforeIteration: false },
      ),
    );
    orbitLoops.forEach((l) => l.start());
    bobLoops.forEach((l) => l.start());
    return () => {
      orbitLoops.forEach((l) => l.stop());
      bobLoops.forEach((l) => l.stop());
      orbitValuesRef.forEach((v) => v.stopAnimation());
      bobValuesRef.forEach((v) => v.stopAnimation());
    };
  }, [active, bobValuesRef, orbitValuesRef]);

  if (!active) return null;
  const cx = width * 0.5;
  const cy = coffeeVisualCenterY(height, centered, viewportHeight, viewportTop);
  const cyOnScreen = viewportTop + cy;
  const maxVisibleOrbitRadius = Math.max(
    COFFEE_ORBIT_MIN_RADIUS + 16,
    Math.min(
      cx - COFFEE_ORBIT_VISIBLE_PADDING,
      width - cx - COFFEE_ORBIT_VISIBLE_PADDING,
      cyOnScreen - COFFEE_ORBIT_VISIBLE_PADDING,
      viewportHeight - cyOnScreen - COFFEE_ORBIT_VISIBLE_PADDING,
    ),
  );
  const cupOuterRadius = COFFEE_CUP_ICON_SIZE * 0.56;
  // Keep an invisible center exclusion circle: beans must stay outside it.
  const centerKeepOutRadius = cupOuterRadius + 32;
  const desiredOrbitInnerRadius = centerKeepOutRadius + 8;
  const desiredOrbitOuterRadius = desiredOrbitInnerRadius + 880;
  const orbitInnerRadius = Math.max(
    COFFEE_ORBIT_MIN_RADIUS,
    Math.min(desiredOrbitInnerRadius, maxVisibleOrbitRadius - 12),
  );
  const orbitOuterRadius = Math.max(
    orbitInnerRadius + 12,
    Math.min(desiredOrbitOuterRadius, maxVisibleOrbitRadius),
  );
  const leaderOrbitV = orbitValuesRef[WHITE_COFFEE_BEAN_INDEX]!;
  return (
    <View pointerEvents="none" style={styles.coffeeBeanLayer}>
      <View style={[styles.coffeeOrbitGroup, { left: cx, top: cy }]}>
        {bobValuesRef.map((_, i) => {
          const bobV = bobValuesRef[i]!;
          const orbitV = orbitValuesRef[i]!;
          const reverseDark = i === WHITE_COFFEE_BEAN_INDEX;
          const followIndex = FOLLOW_WHITE_COFFEE_BEAN_INDICES.indexOf(
            i as (typeof FOLLOW_WHITE_COFFEE_BEAN_INDICES)[number],
          );
          const isFollower = followIndex >= 0;
          const direction = reverseDark || isFollower ? -1 : 1;
          // 豆子围绕杯子形成更集中的圆环，并保持在可视屏幕内。
          const ringCount = 10;
          const ring = i % ringCount;
          const slotsPerRing = Math.ceil(COFFEE_BEAN_COUNT / ringCount);
          const slot = Math.floor(i / ringCount);
          const angleBase = slot * (360 / slotsPerRing) + ring * 4;
          const leaderAngleBase = (pseudoRandom01(WHITE_COFFEE_BEAN_INDEX * 5 + 1) - 0.5) * 8;
          const followGap = 10 + pseudoRandom01(i * 71 + 4) * 2;
          const angle = isFollower
            ? leaderAngleBase + (followIndex + 1) * (followGap * 0.36)
            : angleBase + (pseudoRandom01(i * 5 + 1) - 0.5) * 4;
          const ringRatio = ringCount <= 1 ? 0 : ring / (ringCount - 1);
          const radiusBase = orbitInnerRadius + (orbitOuterRadius - orbitInnerRadius) * ringRatio;
          const leaderTrackRadius = orbitOuterRadius - 2;
          const leaderRadius =
            leaderTrackRadius +
            (pseudoRandom01(WHITE_COFFEE_BEAN_INDEX * 13 + 3) - 0.5) * 4;
          const radius = reverseDark
            ? leaderRadius
            : isFollower
              ? leaderRadius + followIndex * 2 + (pseudoRandom01(i * 79 + 6) - 0.5) * 2
              : radiusBase + pseudoRandom01(i * 13 + 3) * 18;
          const beanW = 20 + pseudoRandom01(i * 17 + 9) * 18;
          const beanH = beanW * (0.56 + pseudoRandom01(i * 13 + 5) * 0.2);
          const orbitPhaseDeg = pseudoRandom01(i * 61 + 21) * 360;
          const leaderOrbitBaseDeg = pseudoRandom01(WHITE_COFFEE_BEAN_INDEX * 61 + 21) * 360;
          const orbitSpin = orbitV.interpolate({
            inputRange: [0, 1],
            outputRange: [
              `${orbitPhaseDeg}deg`,
              `${orbitPhaseDeg + direction * 360}deg`,
            ],
          });
          // 固定“尾随偏移”：始终位于白豆运动方向的后方。
          const leaderPhaseLag = isFollower ? 16 + followIndex * 12 : 0;
          // Followers keep a trailing offset behind the white bean.
          const followerBaseDeg = leaderOrbitBaseDeg + leaderPhaseLag;
          const orbitSpinFollower = leaderOrbitV.interpolate({
            inputRange: [0, 1],
            outputRange: [
              `${followerBaseDeg}deg`,
              `${followerBaseDeg + direction * 360}deg`,
            ],
          });
          const bobY = bobV.interpolate({
            inputRange: [0, 0.25, 0.5, 0.75, 1],
            outputRange: [-14, -2, 16, 3, -14],
          });
          const danceSwayX = bobV.interpolate({
            inputRange: [0, 0.25, 0.5, 0.75, 1],
            outputRange: [-6, 3, 8, -2, -6],
          });
          const danceFloatY = bobV.interpolate({
            inputRange: [0, 0.25, 0.5, 0.75, 1],
            outputRange: [0, -3, 4, -2, 0],
          });
          const danceRotate = bobV.interpolate({
            inputRange: [0, 0.25, 0.5, 0.75, 1],
            outputRange: ["-16deg", "-4deg", "18deg", "6deg", "-16deg"],
          });
          const danceScale = bobV.interpolate({
            inputRange: [0, 0.25, 0.5, 0.75, 1],
            outputRange: [0.86, 0.98, 1.16, 1.02, 0.86],
          });
          const followOrbitWobble = bobV.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: ["-3deg", "4deg", "-3deg"],
          });
          const followRadiusDrift = bobV.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0, 12, 0],
          });
          const mainOrbitWobble = bobV.interpolate({
            inputRange: [0, 0.25, 0.5, 0.75, 1],
            outputRange: ["-3deg", "-1deg", "4deg", "1deg", "-3deg"],
          });
          const mainRadiusDrift = bobV.interpolate({
            inputRange: [0, 0.25, 0.5, 0.75, 1],
            outputRange: [0, 2, 14, 6, 0],
          });
          const mainBeanOpacity = 0.22 + pseudoRandom01(i * 97 + 13) * 0.18;
          const beanOpacity = reverseDark ? 0.62 : mainBeanOpacity;
          const pulseLift = rhythmPulse * (isFollower ? 0.35 : 1);
          const pulseScale = 1 + rhythmPulse * (isFollower ? 0.06 : 0.1);
          return (
            <Animated.View
              key={`coffee-bean-${i}`}
              style={[
                styles.coffeeBean,
                {
                  width: beanW,
                  height: beanH,
                  marginLeft: -beanW / 2,
                  marginTop: -beanH / 2,
                  opacity: beanOpacity,
                  transform: [
                    { rotate: `${angle}deg` },
                    { rotate: isFollower ? orbitSpinFollower : orbitSpin },
                    { translateX: radius },
                    { translateX: isFollower ? followRadiusDrift : mainRadiusDrift },
                    { rotate: isFollower ? followOrbitWobble : mainOrbitWobble },
                    { translateX: danceSwayX },
                    { translateY: -pulseLift },
                    { translateY: danceFloatY },
                    { translateY: bobY },
                    { rotate: danceRotate },
                    { scale: danceScale },
                    { scale: pulseScale },
                  ],
                },
              ]}
            >
              <Image
                source={COFFEE_BEAN_SHAPE}
                style={[
                  styles.coffeeBeanImage,
                  reverseDark && styles.coffeeBeanImageDark,
                ]}
                resizeMode="contain"
              />
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

function SlowMeteors({ active, width, height }: { active: boolean; width: number; height: number }) {
  const valuesRef = useRef(Array.from({ length: METEOR_COUNT }, () => new Animated.Value(0)));
  const values = valuesRef.current;

  useEffect(() => {
    values.forEach((v) => v.stopAnimation());
    if (!active) return;
    const loops = values.map((v, i) => {
      v.setValue(0);
      return Animated.loop(
        Animated.sequence([
          Animated.timing(v, {
            toValue: 1,
            duration: 15000 + Math.floor(pseudoRandom01(i * 43 + 7) * 9000),
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0,
            duration: 0,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ]),
        { resetBeforeIteration: false },
      );
    });
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [active, values]);

  return (
    <View pointerEvents="none" style={styles.meteorLayer}>
      {values.map((v, i) => {
        const startX = width * (0.1 + pseudoRandom01(i * 3 + 1) * 0.74);
        // 只在更上方天空层运动，避免穿过中间月球主体
        const startY = height * (0.03 + pseudoRandom01(i * 5 + 2) * 0.1);
        const driftX = -(44 + pseudoRandom01(i * 11 + 3) * 30);
        const driftY = 14 + pseudoRandom01(i * 13 + 4) * 20;
        const scale = 0.72 + pseudoRandom01(i * 19 + 5) * 0.85;
        const len = 22 + pseudoRandom01(i * 23 + 6) * 22;
        const opacity = v.interpolate({
          inputRange: [0, 0.1, 0.84, 1],
          outputRange: [0, 0.26, 0.22, 0],
        });
        const tx = v.interpolate({ inputRange: [0, 1], outputRange: [0, driftX] });
        const ty = v.interpolate({ inputRange: [0, 1], outputRange: [0, driftY] });
        return (
          <Animated.View
            key={`meteor-${i}`}
            style={[
              styles.meteor,
              {
                width: len,
                left: startX,
                top: startY,
                opacity,
                transform: [{ translateX: tx }, { translateY: ty }, { rotate: "-32deg" }, { scale }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

function SlowStars({ active, width, height }: { active: boolean; width: number; height: number }) {
  const valuesRef = useRef(Array.from({ length: STAR_COUNT }, () => new Animated.Value(0.35)));
  const values = valuesRef.current;

  useEffect(() => {
    values.forEach((v) => v.stopAnimation());
    if (!active) return;

    const loops = values.map((v, i) => {
      const durationA = 2600 + Math.floor(pseudoRandom01(i * 29 + 3) * 3600);
      const durationB = 2800 + Math.floor(pseudoRandom01(i * 31 + 7) * 3400);
      v.setValue(0.22 + pseudoRandom01(i * 37 + 11) * 0.56);
      return Animated.loop(
        Animated.sequence([
          Animated.timing(v, {
            toValue: 0.78,
            duration: durationA,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0.22,
            duration: durationB,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        { resetBeforeIteration: false },
      );
    });
    loops.forEach((l) => l.start());

    return () => loops.forEach((l) => l.stop());
  }, [active, values]);

  return (
    <View pointerEvents="none" style={styles.starLayer}>
      {values.map((v, i) => {
        const x = width * (0.06 + pseudoRandom01(i * 13 + 1) * 0.88);
        const y = height * (0.05 + pseudoRandom01(i * 17 + 2) * 0.5);
        const size = 1.5 + pseudoRandom01(i * 23 + 3) * 2.2;
        const trailSpan = 1.8 + pseudoRandom01(i * 29 + 5) * 4.2;
        const trailTilt = (pseudoRandom01(i * 31 + 7) - 0.5) * 0.8;
        const tx = v.interpolate({
          inputRange: [0.22, 0.5, 0.78],
          outputRange: [-trailSpan, 0, trailSpan],
        });
        const ty = v.interpolate({
          inputRange: [0.22, 0.5, 0.78],
          outputRange: [trailSpan * (0.24 + trailTilt), -trailSpan * 0.18, trailSpan * (0.24 - trailTilt)],
        });
        return (
          <Animated.View
            key={`star-${i}`}
            style={[
              styles.starDot,
              {
                left: x,
                top: y,
                width: size,
                height: size,
                borderRadius: size,
                opacity: v,
                transform: [{ translateX: tx }, { translateY: ty }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

function WorkSpacePlanets({ active, width, height }: { active: boolean; width: number; height: number }) {
  const orbitA = useRef(new Animated.Value(0)).current;
  const orbitB = useRef(new Animated.Value(0)).current;
  const mistPhase = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    orbitA.stopAnimation();
    orbitB.stopAnimation();
    mistPhase.stopAnimation();
    if (!active) return;
    orbitA.setValue(0);
    orbitB.setValue(0);
    mistPhase.setValue(0);
    const loopA = Animated.loop(
      Animated.timing(orbitA, {
        toValue: 1,
        duration: 72000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const loopB = Animated.loop(
      Animated.timing(orbitB, {
        toValue: 1,
        duration: 32000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const loopMist = Animated.loop(
      Animated.sequence([
        Animated.timing(mistPhase, {
          toValue: 1,
          duration: 6800,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(mistPhase, {
          toValue: 0,
          duration: 6800,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    );
    loopA.start();
    loopB.start();
    loopMist.start();
    return () => {
      loopA.stop();
      loopB.stop();
      loopMist.stop();
      orbitA.stopAnimation();
      orbitB.stopAnimation();
      mistPhase.stopAnimation();
    };
  }, [active, mistPhase, orbitA, orbitB]);

  if (!active) return null;
  const cx = width * 0.5;
  const cy = height * FOCUS_ORB_CENTER_Y_RATIO;
  const orbitADeg = orbitA.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  const orbitBDeg = orbitB.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  const mistOuterOpacity = mistPhase.interpolate({
    inputRange: [0, 1],
    outputRange: [0.1, 0.24],
  });
  const mistInnerOpacity = mistPhase.interpolate({
    inputRange: [0, 1],
    outputRange: [0.26, 0.12],
  });

  return (
    <View pointerEvents="none" style={styles.workPlanetLayer}>
      <Animated.View
        style={[
          styles.workCoreMistOuter,
          {
            left: cx - 146,
            top: cy - 146,
            opacity: mistOuterOpacity,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.workCoreMistInner,
          {
            left: cx - 118,
            top: cy - 118,
            opacity: mistInnerOpacity,
          },
        ]}
      />
      <View
        style={[
          styles.workPlanetOrb,
          {
            width: 176,
            height: 176,
            borderRadius: 176,
            left: cx - 88,
            top: cy - 88,
            backgroundColor: "rgba(160,182,222,0.34)",
            shadowColor: "#9fb8e8",
            shadowOpacity: 0.5,
            shadowRadius: 30,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.workOrbitAnchor,
          {
            left: cx,
            top: cy,
            transform: [{ rotate: orbitADeg }],
          },
        ]}
      >
        <View
          style={[
            styles.workPlanetOrb,
            {
              width: 56,
              height: 56,
              borderRadius: 56,
              backgroundColor: "rgba(124,150,198,0.26)",
              shadowColor: "#89a9dd",
              shadowOpacity: 0.44,
              shadowRadius: 20,
              transform: [{ rotate: "18deg" }, { translateX: 176 }],
            },
          ]}
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.workOrbitAnchor,
          {
            left: cx,
            top: cy,
            transform: [{ rotate: orbitBDeg }],
          },
        ]}
      >
        <View
          style={[
            styles.workPlanetOrb,
            {
              width: 42,
              height: 42,
              borderRadius: 42,
              backgroundColor: "rgba(193,214,245,0.3)",
              shadowColor: "#bdd3f5",
              shadowOpacity: 0.48,
              shadowRadius: 14,
              transform: [{ rotate: "-142deg" }, { translateX: 152 }],
            },
          ]}
        />
      </Animated.View>
    </View>
  );
}

function SlowFish({
  active,
  width,
  height,
  viewportHeight,
  viewportTop = 0,
  centerMode = "lower",
}: {
  active: boolean;
  width: number;
  height: number;
  viewportHeight: number;
  viewportTop?: number;
  centerMode?: "lower" | "center";
}) {
  const [motionMs, setMotionMs] = useState(0);

  useEffect(() => {
    if (!active) {
      setMotionMs(0);
      return;
    }
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setMotionMs(Date.now() - startedAt);
    }, 33);

    return () => {
      clearInterval(timer);
    };
  }, [active]);

  const cx = width * 0.5;
  // 与主视觉圆心保持一致，避免旋转中心偏移。
  const cy = coffeeVisualCenterY(height, centerMode === "center", viewportHeight, viewportTop);
  const orbitTurns = motionMs / 42000;
  const shimmerPhase = (motionMs % 8200) / 8200;

  return (
    <View pointerEvents="none" style={styles.fishLayer}>
      <View
        style={[
          styles.fishOrbitGroup,
          {
            left: cx,
            top: cy,
          },
        ]}
      >
        {Array.from({ length: FISH_COUNT }, (_, i) => {
          const ring = Math.floor(i / 12);
          const slot = i % 12;
          const angleBase = slot * 30;
          const angleJitter = (pseudoRandom01(i * 19 + 7) - 0.5) * 44;
          const angle = angleBase + angleJitter + ring * 2.5;
          // 中心留白加大：半径只向外随机，避免鱼压到中间圆。
          const radiusBase = 132 + ring * 13.5;
          const radiusJitter = pseudoRandom01(i * 23 + 11) * 20;
          const radius = radiusBase + radiusJitter;
          const size = 0.55 + pseudoRandom01(i * 31 + 17) * 0.68;
          const opacity = 0.34 + pseudoRandom01(i * 37 + 3) * 0.28;
          const ringSpeedBoost = 0.7 + ring * 0.14;
          const randomSpeed = 0.45 + pseudoRandom01(i * 41 + 9) * 1.7;
          const speedFactor = ringSpeedBoost * randomSpeed * 0.58;
          const orbitOffset = pseudoRandom01(i * 67 + 21) * 360;
          const fishOrbitAngle = orbitTurns * 360 * speedFactor + orbitOffset;
          const localShimmer = (shimmerPhase + i / FISH_COUNT) % 1;
          const shimmerOpacityFactor =
            localShimmer <= 0.5 ? 0.88 + localShimmer * 0.24 : 1 - (localShimmer - 0.5) * 0.24;
          const bobY = localShimmer <= 0.5 ? -2.4 + localShimmer * 9.6 : 2.4 - (localShimmer - 0.5) * 9.6;
          // 在环形轨道上增加轻微扭动，保留绕圆主轨迹但更像鱼在主动游动。
          const swimPhase = (motionMs / (2600 + pseudoRandom01(i * 73 + 33) * 2600) + i * 0.21) % 1;
          const swimWave = Math.sin(swimPhase * Math.PI * 2);
          const tangentialSway = swimWave * (1.6 + pseudoRandom01(i * 79 + 27) * 2.2);
          const radialSway = Math.cos(swimPhase * Math.PI * 2) * (1.6 + pseudoRandom01(i * 83 + 31) * 3.2);
          const headingWiggle = swimWave * (1.2 + pseudoRandom01(i * 89 + 37) * 2.6);
          return (
            <View
              key={`fish-${i}`}
              style={[
                styles.fishOrbitNode,
                {
                  opacity: opacity * shimmerOpacityFactor,
                  transform: [
                    { rotate: `${angle + fishOrbitAngle}deg` },
                    { translateX: radius + radialSway },
                    { translateY: tangentialSway },
                    { translateY: bobY },
                    { rotate: `${headingWiggle}deg` },
                    { rotate: "90deg" },
                    { scale: size },
                  ],
                },
              ]}
            >
              <Image source={FISH_SHAPE} style={styles.fishImage} resizeMode="contain" />
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function MusicHomeScreen({ layout = "tab" }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowW, height: windowH } = useWindowDimensions();
  const fullBleedFrame = useShellFullBleedFrame();
  const [seekDragging, setSeekDragging] = useState(false);
  const [seekPreview, setSeekPreview] = useState(0);
  const [album, setAlbum] = useState<string>(DEFAULT_ALBUM);
  const [upperSize, setUpperSize] = useState({ width: 0, height: 0 });
  const [uiVisible, setUiVisible] = useState(true);
  const [landscapeMenuVisible, setLandscapeMenuVisible] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [queueScrollY, setQueueScrollY] = useState(0);
  const queueScrollRef = useRef<ScrollView | null>(null);
  const recenterTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recenterAnimRafRef = useRef<number | null>(null);
  const uiHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueScrollYRef = useRef(0);
  queueScrollYRef.current = queueScrollY;

  const {
    tracks,
    trackIndex,
    playing,
    loading,
    playbackMode,
    musicCurrentSec,
    musicDurationSec,
    playTrackAt,
    playNext,
    playPrev,
    togglePlayMusic,
    seekRatio,
    musicRepeatMode,
    setMusicRepeatMode,
    sleepTimerMinutes,
    setSleepTimerMinutes,
    setMusicGain,
    downloadingTrackId,
  } = useMusicPlayback();

  const inTab = layout === "tab";
  const isLandscape = windowW > windowH;
  const compactLandscape = inTab && isLandscape;
  const bottomPad = (inTab ? SHELL_TAB_BAR_CLEARANCE_MUSIC : 16) + insets.bottom;
  const contentBottomPad = compactLandscape ? Math.max(insets.bottom, 12) : bottomPad;
  const current = tracks[trackIndex];
  const musicActive = playbackMode === "music";
  const duration = musicActive && musicDurationSec > 0 ? musicDurationSec : 0;
  const position = musicActive
    ? seekDragging
      ? seekPreview * (duration || 1)
      : musicCurrentSec
    : 0;
  const progress = duration > 0 ? Math.min(1, position / duration) : 0;
  const sleepAutoHideEnabled = album === "睡眠";
  const sleepUiAutoHideEnabled = sleepAutoHideEnabled && musicActive && playing;
  const chromeVisible = compactLandscape ? landscapeMenuVisible : uiVisible;
  const nowClockText = useMemo(() => formatNowClock(new Date(nowMs)), [nowMs]);

  const analysis = useTrackAnalysis(current?.analysisSrc ?? null);
  const coffeeRhythmPulse = useMemo(() => {
    if (!analysis || !musicActive || !playing) return 0;
    const s = sampleTrackAnalysisAt(analysis, musicCurrentSec);
    const e = s.low * 0.45 + s.mid * 0.25 + s.rms * 0.3;
    // 仅在下午茶做柔和节拍，避免“硬跳”。
    return Math.max(0, Math.min(1, (e - 0.12) * 1.2));
  }, [analysis, musicActive, musicCurrentSec, playing]);
  const showArtwork = false;
  const glowColors = albumGlowColors(album);
  const landscapeSafeHorizontal = useMemo(
    () =>
      compactLandscape
        ? {
            left: insets.left,
            right: insets.right,
          }
        : null,
    [compactLandscape, insets.left, insets.right],
  );
  const landscapeCenterTapPosition = useMemo(
    () =>
      compactLandscape
        ? {
            left: insets.left + (windowW - insets.left - insets.right - 260) / 2,
            top: insets.top + (windowH - insets.top - insets.bottom - 260) / 2,
          }
        : null,
    [compactLandscape, insets.bottom, insets.left, insets.right, insets.top, windowH, windowW],
  );

  useEffect(() => {
    setSeekDragging(false);
    setSeekPreview(0);
  }, [trackIndex, playbackMode]);

  const onPrev = useCallback(() => {
    if (musicActive && musicCurrentSec > 3) {
      void seekRatio(0);
      return;
    }
    void playPrev();
  }, [musicActive, musicCurrentSec, playPrev, seekRatio]);

  const cycleSleepTimer = useCallback(() => {
    if (sleepTimerMinutes === 0) {
      setSleepTimerMinutes(15);
      return;
    }
    if (sleepTimerMinutes === 15) {
      setSleepTimerMinutes(30);
      return;
    }
    if (sleepTimerMinutes === 30) {
      setSleepTimerMinutes(60);
      return;
    }
    if (sleepTimerMinutes === 60) {
      setSleepTimerMinutes(120);
      return;
    }
    setSleepTimerMinutes(0);
  }, [setSleepTimerMinutes, sleepTimerMinutes]);
  const sleepTimerBadge = sleepTimerMinutes > 0 ? String(sleepTimerMinutes) : null;
  useEffect(() => {
    // 仅在安静/下午茶时兜底解除“单曲锁定”。
    // 专注/睡眠的单曲循环默认值在 selectAlbum 中设置，不在此处持续强制。
    if ((album === "安静" || album === "下午茶") && musicRepeatMode !== "all") {
      setMusicRepeatMode("all");
    }
  }, [album, musicRepeatMode, setMusicRepeatMode]);

  useEffect(() => {
    // 睡眠专辑默认压低背景音乐到 30%，其它专辑恢复默认增益。
    void setMusicGain(album === "睡眠" ? 0.3 : 1);
  }, [album, setMusicGain]);

  const offlineMusicOnly = isMobileBundledOnly();
  const filteredTrackIndices = useMemo(
    () =>
      tracks
        .map((tr, index) => ({ tr, index }))
        .filter(({ tr }) => inferTrackAlbumLabel(tr) === album)
        .filter(({ tr }) => !offlineMusicOnly || tr.localReady)
        .map(({ index }) => index),
    [album, offlineMusicOnly, tracks],
  );
  const albumNames = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const known of KNOWN_MUSIC_ALBUMS) {
      seen.add(known);
      ordered.push(known);
    }
    for (const tr of tracks) {
      const label = inferTrackAlbumLabel(tr);
      if (seen.has(label)) continue;
      seen.add(label);
      ordered.push(label);
    }
    return ordered;
  }, [tracks]);
  const albumCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tr of tracks) {
      const label = inferTrackAlbumLabel(tr);
      counts[label] = (counts[label] ?? 0) + 1;
    }
    return counts;
  }, [tracks]);
  useEffect(() => {
    if ((albumCounts[album] ?? 0) > 0) return;
    const next = albumNames.find((name) => (albumCounts[name] ?? 0) > 0) ?? DEFAULT_ALBUM;
    if (next !== album) setAlbum(next);
  }, [album, albumCounts, albumNames]);

  useEffect(() => {
    if (!offlineMusicOnly || filteredTrackIndices.length > 0) return;
    const nextAlbum = albumNames.find((name) =>
      tracks.some((tr) => inferTrackAlbumLabel(tr) === name && tr.localReady),
    );
    if (nextAlbum && nextAlbum !== album) setAlbum(nextAlbum);
  }, [album, albumNames, filteredTrackIndices.length, offlineMusicOnly, tracks]);
  const selectAlbum = useCallback(
    (nextAlbum: string) => {
      if (nextAlbum === album) return;
      setAlbum(nextAlbum);
      if (nextAlbum === "睡眠" || nextAlbum === "专注工作") {
        setMusicRepeatMode("one");
      } else if (nextAlbum === "安静" || nextAlbum === "下午茶") {
        setMusicRepeatMode("all");
      }
      if (nextAlbum === "睡眠") {
        // 睡眠专辑默认 30 分钟（若用户已手动设定则保留）。
        if (sleepTimerMinutes === 0) setSleepTimerMinutes(30);
      } else if (sleepTimerMinutes > 0) {
        // 非睡眠专辑不自动保留定时，避免看起来“音乐都自动开定时”。
        setSleepTimerMinutes(0);
      }
      const albumIndices = tracks
        .map((tr, index) => ({ tr, index }))
        .filter(({ tr }) => inferTrackAlbumLabel(tr) === nextAlbum)
        .map(({ index }) => index);
      if (albumIndices.length === 0) return;
      const currentTrack = tracks[trackIndex];
      const currentAlbumLabel = currentTrack ? inferTrackAlbumLabel(currentTrack) : "";
      if (nextAlbum === currentAlbumLabel && albumIndices.includes(trackIndex)) return;
      const playable = albumIndices.filter((idx) => {
        const tr = tracks[idx];
        return tr && isTrackPlayable(tr);
      });
      void setMusicGain(nextAlbum === "睡眠" ? 0.3 : 1);
      void playTrackAt((playable[0] ?? albumIndices[0])!);
    },
    [album, playTrackAt, setMusicGain, setMusicRepeatMode, setSleepTimerMinutes, sleepTimerMinutes, trackIndex, tracks],
  );
  const currentFilteredIndex = useMemo(
    () => filteredTrackIndices.findIndex((idx) => idx === trackIndex),
    [filteredTrackIndices, trackIndex],
  );
  const onMusicSwipe = useCallback(
    (direction: "left" | "right") => {
      if (tracks.length === 0) return;
      if (filteredTrackIndices.length > 1 && currentFilteredIndex >= 0) {
        if (direction === "left") {
          const nextFilteredIndex = (currentFilteredIndex + 1) % filteredTrackIndices.length;
          const targetTrackIndex = filteredTrackIndices[nextFilteredIndex]!;
          void playTrackAt(targetTrackIndex);
          return;
        }
        const prevFilteredIndex =
          currentFilteredIndex <= 0 ? filteredTrackIndices.length - 1 : currentFilteredIndex - 1;
        const targetTrackIndex = filteredTrackIndices[prevFilteredIndex]!;
        void playTrackAt(targetTrackIndex);
        return;
      }
      if (direction === "left") void playNext();
      else void onPrev();
    },
    [tracks.length, filteredTrackIndices, currentFilteredIndex, playTrackAt, playNext, onPrev],
  );

  useShellSwipeAction(inTab && !loading && tracks.length > 0, onMusicSwipe);
  const queueLoopBlockHeight = useMemo(
    () => filteredTrackIndices.length * QUEUE_ROW_HEIGHT,
    [filteredTrackIndices.length],
  );
  const queueDisplayIndices = useMemo(() => {
    if (filteredTrackIndices.length <= 1) return filteredTrackIndices;
    return [...filteredTrackIndices, ...filteredTrackIndices, ...filteredTrackIndices];
  }, [filteredTrackIndices]);

  useEffect(() => {
    if (filteredTrackIndices.length <= 1 || queueLoopBlockHeight <= 0) {
      setQueueScrollY(0);
      return;
    }
    const y = queueLoopBlockHeight;
    requestAnimationFrame(() => {
      queueScrollRef.current?.scrollTo({ y, animated: false });
      setQueueScrollY(y);
    });
  }, [album, filteredTrackIndices.length, queueLoopBlockHeight]);

  const animateQueueScrollTo = useCallback((targetY: number, durationMs = 4000) => {
    if (!queueScrollRef.current) return;
    if (recenterAnimRafRef.current != null) {
      cancelAnimationFrame(recenterAnimRafRef.current);
      recenterAnimRafRef.current = null;
    }
    const startY = queueScrollYRef.current;
    const delta = targetY - startY;
    if (Math.abs(delta) < 1) {
      queueScrollRef.current.scrollTo({ y: targetY, animated: false });
      setQueueScrollY(targetY);
      return;
    }
    const startAt = Date.now();
    const step = () => {
      const elapsed = Date.now() - startAt;
      const t = Math.min(1, elapsed / Math.max(1, durationMs));
      // 更慢、更柔和的归位过渡。
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const y = startY + delta * eased;
      queueScrollRef.current?.scrollTo({ y, animated: false });
      setQueueScrollY(y);
      if (t < 1) {
        recenterAnimRafRef.current = requestAnimationFrame(step);
      } else {
        recenterAnimRafRef.current = null;
      }
    };
    recenterAnimRafRef.current = requestAnimationFrame(step);
  }, []);

  const scrollActiveToCenter = useCallback(
    (animated: boolean) => {
      if (filteredTrackIndices.length <= 0 || queueLoopBlockHeight <= 0) return;
      const activeLocalIdx = filteredTrackIndices.findIndex((idx) => idx === trackIndex);
      if (activeLocalIdx < 0) return;
      const middleBlockOffset = queueLoopBlockHeight;
      const rowCenter = middleBlockOffset + activeLocalIdx * QUEUE_ROW_HEIGHT + QUEUE_ROW_HEIGHT / 2;
      const targetY = Math.max(0, rowCenter - QUEUE_VIEWPORT_HEIGHT / 2);
      if (Math.abs(targetY - queueScrollYRef.current) < 1) return;
      if (animated) {
        animateQueueScrollTo(targetY);
      } else {
        queueScrollRef.current?.scrollTo({ y: targetY, animated: false });
        setQueueScrollY(targetY);
      }
    },
    [animateQueueScrollTo, filteredTrackIndices, queueLoopBlockHeight, trackIndex],
  );

  useEffect(() => {
    scrollActiveToCenter(true);
  }, [scrollActiveToCenter, trackIndex, album]);

  useEffect(() => {
    return () => {
      if (recenterTimeoutRef.current) {
        clearTimeout(recenterTimeoutRef.current);
        recenterTimeoutRef.current = null;
      }
      if (recenterAnimRafRef.current != null) {
        cancelAnimationFrame(recenterAnimRafRef.current);
        recenterAnimRafRef.current = null;
      }
    };
  }, []);

  const scheduleAutoRecenter = useCallback(() => {
    if (recenterTimeoutRef.current) clearTimeout(recenterTimeoutRef.current);
    recenterTimeoutRef.current = setTimeout(() => {
      scrollActiveToCenter(true);
      recenterTimeoutRef.current = null;
    }, QUEUE_RECENTER_IDLE_MS);
  }, [scrollActiveToCenter]);

  const onQueueScroll = useCallback(
    (y: number) => {
      if (recenterAnimRafRef.current != null) {
        cancelAnimationFrame(recenterAnimRafRef.current);
        recenterAnimRafRef.current = null;
      }
      if (filteredTrackIndices.length <= 1 || queueLoopBlockHeight <= 0) {
        setQueueScrollY(y);
        scheduleAutoRecenter();
        return;
      }
      let stableY = y;
      if (y < queueLoopBlockHeight * 0.5) {
        stableY = y + queueLoopBlockHeight;
        queueScrollRef.current?.scrollTo({ y: stableY, animated: false });
      } else if (y > queueLoopBlockHeight * 1.5) {
        stableY = y - queueLoopBlockHeight;
        queueScrollRef.current?.scrollTo({ y: stableY, animated: false });
      }
      setQueueScrollY(stableY);
      scheduleAutoRecenter();
    },
    [filteredTrackIndices.length, queueLoopBlockHeight, scheduleAutoRecenter],
  );

  const resetUiAutoHide = useCallback(() => {
    if (uiHideTimeoutRef.current) {
      clearTimeout(uiHideTimeoutRef.current);
      uiHideTimeoutRef.current = null;
    }
    if (compactLandscape) {
      setLandscapeMenuVisible(true);
    } else {
      setUiVisible(true);
    }
    if (!sleepUiAutoHideEnabled) return;
    if (loading || tracks.length === 0 || !current) return;
    uiHideTimeoutRef.current = setTimeout(() => {
      if (compactLandscape) {
        setLandscapeMenuVisible(false);
      } else {
        setUiVisible(false);
      }
      uiHideTimeoutRef.current = null;
    }, MUSIC_UI_AUTO_HIDE_MS);
  }, [compactLandscape, current, loading, sleepUiAutoHideEnabled, tracks.length]);

  useEffect(() => {
    if (!sleepAutoHideEnabled || loading || tracks.length === 0 || !current) {
      if (uiHideTimeoutRef.current) {
        clearTimeout(uiHideTimeoutRef.current);
        uiHideTimeoutRef.current = null;
      }
      if (!compactLandscape) setUiVisible(true);
      return;
    }
    if (!sleepUiAutoHideEnabled) {
      if (compactLandscape) {
        setLandscapeMenuVisible(true);
      } else {
        setUiVisible(true);
      }
      if (uiHideTimeoutRef.current) {
        clearTimeout(uiHideTimeoutRef.current);
        uiHideTimeoutRef.current = null;
      }
      return;
    }
    resetUiAutoHide();
  }, [
    compactLandscape,
    current,
    loading,
    resetUiAutoHide,
    sleepAutoHideEnabled,
    sleepUiAutoHideEnabled,
    tracks.length,
  ]);

  useEffect(() => {
    return () => {
      if (uiHideTimeoutRef.current) {
        clearTimeout(uiHideTimeoutRef.current);
        uiHideTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!compactLandscape) {
      setLandscapeMenuVisible(false);
      return;
    }
    setLandscapeMenuVisible(false);
  }, [compactLandscape]);

  useEffect(() => {
    if (!compactLandscape) return;
    setNowMs(Date.now());
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [compactLandscape]);

  const onLandscapeStageToggle = useCallback(() => {
    if (!compactLandscape) return;
    if (landscapeMenuVisible) {
      setLandscapeMenuVisible(false);
      if (!playing && tracks.length > 0) void togglePlayMusic();
      return;
    }
    setLandscapeMenuVisible(true);
    if (playing) void togglePlayMusic();
  }, [compactLandscape, landscapeMenuVisible, playing, togglePlayMusic, tracks.length]);

  useEffect(() => {
    if (compactLandscape) return;
    setMusicAutoHideChrome(sleepUiAutoHideEnabled && !uiVisible);
    return () => setMusicAutoHideChrome(false);
  }, [compactLandscape, sleepUiAutoHideEnabled, uiVisible]);

  useEffect(() => {
    if (!compactLandscape) return;
    // 横屏音乐沉浸态下，底部主导航图标始终隐藏。
    setMusicAutoHideChrome(true);
    return () => setMusicAutoHideChrome(false);
  }, [compactLandscape]);

  const queue = useMemo(
    () =>
      queueDisplayIndices.length > 0 ? (
        <View style={styles.queue}>
          {queueDisplayIndices.map((index, displayIdx) => {
            const tr = tracks[index]!;
            const active = index === trackIndex;
            const label = tr.title.trim() || musicCopy.untitled;
            const isDownloading = downloadingTrackId === tr.id;
            const needsCache = !tr.localReady && !offlineMusicOnly && isTrackPlayable(tr);
            return (
              <Pressable
                key={`${tr.id}-${displayIdx}`}
                onPress={() => {
                  void playTrackAt(index);
                }}
                style={({ pressed }) => [
                  styles.queueRow,
                  {
                    opacity: rowOpacityByScroll(displayIdx, queueScrollY, active),
                    transform: [{ scale: rowScaleByScroll(displayIdx, queueScrollY, active) }],
                  },
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                {isDownloading ? (
                  <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" style={styles.queueDownloadIcon} />
                ) : needsCache ? (
                  <MaterialIcons
                    name="cloud-download"
                    size={16}
                    color="rgba(255,255,255,0.55)"
                    style={styles.queueDownloadIcon}
                  />
                ) : null}
                <Text
                  style={[styles.queueText, active && styles.queueTextActive]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null,
    [
      downloadingTrackId,
      offlineMusicOnly,
      playTrackAt,
      queueDisplayIndices,
      queueScrollY,
      trackIndex,
      tracks,
    ],
  );

  return (
    <View style={styles.root} onTouchStart={compactLandscape ? undefined : resetUiAutoHide}>
      <StatusBar style="light" />

      {!loading && current ? (
        <View
          pointerEvents="none"
          style={inTab ? shellFullBleedBackdropStyle(fullBleedFrame) : styles.backdrop}
        >
          {showArtwork ? (
            <Image
              source={current.artworkUri ? { uri: current.artworkUri } : undefined}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : (
            <>
              <MusicEnergyGlow
                width={inTab ? fullBleedFrame.width : windowW}
                height={inTab ? fullBleedFrame.height : windowH}
                colors={glowColors}
                analysis={analysis}
                currentSec={musicCurrentSec}
                playing={playing && musicActive}
                flatGradientOnly={album === "睡眠"}
                showCenterOrb={album !== "安静" && album !== "睡眠" && album !== "专注工作"}
                centerOrbSway={album === "下午茶"}
                showSideOrbs={album !== "安静" && album !== "专注工作"}
              />
              {album === "专注工作" ? (
                <WorkSpacePlanets
                  active
                  width={inTab ? fullBleedFrame.width : windowW}
                  height={inTab ? fullBleedFrame.height : windowH}
                />
              ) : null}
              {album === "睡眠" ? (
                <SlowStars
                  active
                  width={inTab ? fullBleedFrame.width : windowW}
                  height={inTab ? fullBleedFrame.height : windowH}
                />
              ) : null}
              {album === "睡眠" ? (
                <SlowMeteors
                  active
                  width={inTab ? fullBleedFrame.width : windowW}
                  height={inTab ? fullBleedFrame.height : windowH}
                />
              ) : null}
            </>
          )}
        </View>
      ) : null}

      {compactLandscape && !chromeVisible && !loading && current ? (
        <View
          pointerEvents="none"
          style={[styles.landscapeTimeOverlay, landscapeSafeHorizontal, { paddingBottom: insets.bottom + 10 }]}
        >
          <Text style={[styles.landscapeTimeText, album === "睡眠" && styles.landscapeTimeTextSleep]}>
            {nowClockText}
          </Text>
        </View>
      ) : null}

      {compactLandscape && !chromeVisible ? (
        <Pressable
          style={styles.landscapeTapLayer}
          onPress={onLandscapeStageToggle}
          accessibilityRole="button"
          accessibilityLabel="切换横屏音乐菜单"
        />
      ) : null}
      {compactLandscape && chromeVisible ? (
        <Pressable
          style={[styles.landscapeCenterTapTarget, landscapeCenterTapPosition]}
          onPress={onLandscapeStageToggle}
          accessibilityRole="button"
          accessibilityLabel="隐藏横屏音乐菜单"
        />
      ) : null}

      {chromeVisible && !inTab && router.canGoBack() ? (
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backBtn,
            { top: insets.top + 2 },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
        >
          <MaterialIcons name="keyboard-arrow-down" size={26} color="rgba(255,255,255,0.7)" />
        </Pressable>
      ) : null}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="rgba(255,255,255,0.45)" />
        </View>
      ) : tracks.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>{musicCopy.noAudio}</Text>
        </View>
      ) : current ? (
        <View
          style={[
            styles.foreground,
            compactLandscape && styles.foregroundLandscape,
            { paddingTop: insets.top + 8, paddingBottom: contentBottomPad },
          ]}
          pointerEvents={compactLandscape ? "box-none" : "auto"}
        >
          <View
            style={[
              styles.upper,
              compactLandscape && styles.upperLandscape,
              compactLandscape && landscapeSafeHorizontal,
            ]}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              setUpperSize((prev) =>
                Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - height) < 0.5
                  ? prev
                  : { width, height },
              );
            }}
          >
            {album === "安静" && upperSize.width > 0 && upperSize.height > 0 ? (
              <SlowFish
                active
                width={upperSize.width}
                height={upperSize.height}
                viewportHeight={inTab ? fullBleedFrame.height : windowH}
                viewportTop={compactLandscape ? 0 : insets.top + 8}
                centerMode={compactLandscape ? "center" : "lower"}
              />
            ) : null}
            {album === "下午茶" && upperSize.width > 0 && upperSize.height > 0 ? (
              <CoffeeBeanOrbit
                active
                width={upperSize.width}
                height={upperSize.height}
                viewportHeight={inTab ? fullBleedFrame.height : windowH}
                viewportTop={compactLandscape ? 0 : insets.top + 8}
                centered={compactLandscape}
                rhythmPulse={coffeeRhythmPulse}
              />
            ) : null}
            {album === "安静" ? (
              <BreathingRing
                active
                centered={compactLandscape}
                containerHeight={upperSize.height}
                viewportHeight={inTab ? fullBleedFrame.height : windowH}
                viewportTop={compactLandscape ? 0 : insets.top + 8}
              />
            ) : null}
            {album === "下午茶" ? (
              <SunOrb
                active
                centered={compactLandscape}
                containerHeight={upperSize.height}
                viewportHeight={inTab ? fullBleedFrame.height : windowH}
                viewportTop={compactLandscape ? 0 : insets.top + 8}
              />
            ) : null}
            {album === "睡眠" ? <SleepCrescentMoon active centered={compactLandscape} /> : null}
          </View>

          <View
            style={[styles.panel, compactLandscape && styles.panelLandscape]}
            onTouchStart={compactLandscape ? resetUiAutoHide : undefined}
          >
            {queue ? (
              <View
                style={[
                  styles.queueWrap,
                  compactLandscape && styles.queueWrapLandscape,
                  !chromeVisible && styles.chromeHidden,
                ]}
                pointerEvents={chromeVisible ? "auto" : "none"}
              >
                <ScrollView
                  ref={queueScrollRef}
                  style={styles.queueScroll}
                  contentContainerStyle={styles.queueScrollContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  onScroll={(e) => onQueueScroll(e.nativeEvent.contentOffset.y)}
                  scrollEventThrottle={16}
                >
                  {queue}
                </ScrollView>
              </View>
            ) : null}
            <View
              style={!chromeVisible ? styles.chromeHidden : undefined}
              pointerEvents={chromeVisible ? "auto" : "none"}
            >
              <View style={styles.albumRow}>
                {albumNames.map((albumName) => {
                  const selected = albumName === album;
                  return (
                    <Pressable
                      key={albumName}
                      onPress={() => selectAlbum(albumName)}
                      style={({ pressed }) => [
                        styles.albumBtn,
                        selected && styles.albumBtnOn,
                        pressed && styles.pressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`${albumName}（${albumCounts[albumName] ?? 0}）`}
                    >
                      <MaterialIcons
                        name={albumIconName(albumName)}
                        size={20}
                        color={selected ? albumSwatchColor(albumName) : "rgba(255,255,255,0.72)"}
                      />
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.transport}>
                <Text style={styles.timeLine}>
                  {formatClock(position)}
                  <Text style={styles.timeSep}> / </Text>
                  {formatClock(duration)}
                </Text>

                <MinimalProgressBar
                  progress={progress}
                  disabled={!duration}
                  accessibilityLabel={musicCopy.progress}
                  onSeekStart={() => setSeekDragging(true)}
                  onSeekPreview={setSeekPreview}
                  onSeekRatio={(r) => {
                    setSeekPreview(r);
                    void seekRatio(r).finally(() => setSeekDragging(false));
                  }}
                />

                <View style={[styles.controls, compactLandscape && styles.controlsLandscape]}>
                  <Pressable
                    onPress={() => {
                      if (filteredTrackIndices.length <= 1 || currentFilteredIndex < 0) {
                        void onPrev();
                        return;
                      }
                      const prevFilteredIndex =
                        currentFilteredIndex <= 0
                          ? filteredTrackIndices.length - 1
                          : currentFilteredIndex - 1;
                      const targetTrackIndex = filteredTrackIndices[prevFilteredIndex]!;
                      void playTrackAt(targetTrackIndex);
                    }}
                    hitSlop={14}
                    style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={musicCopy.prev}
                  >
                    <MaterialIcons name="skip-previous" size={26} color="rgba(255,255,255,0.72)" />
                  </Pressable>
                  <Pressable
                    onPress={() => setMusicRepeatMode(musicRepeatMode === "one" ? "off" : "one")}
                    style={({ pressed }) => [
                      styles.repeatBtn,
                      musicRepeatMode === "one" && styles.repeatBtnOn,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: musicRepeatMode === "one" }}
                    accessibilityLabel={musicRepeatMode === "one" ? "单曲循环已开启" : "单曲循环已关闭"}
                  >
                    <MaterialIcons
                      name="repeat-one"
                      size={17}
                      color={
                        musicRepeatMode === "one" ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.62)"
                      }
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => setMusicRepeatMode(musicRepeatMode === "all" ? "off" : "all")}
                    style={({ pressed }) => [
                      styles.repeatBtn,
                      musicRepeatMode === "all" && styles.repeatBtnOn,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: musicRepeatMode === "all" }}
                    accessibilityLabel={musicRepeatMode === "all" ? "全部循环已开启" : "全部循环已关闭"}
                  >
                    <MaterialIcons
                      name="repeat"
                      size={17}
                      color={
                        musicRepeatMode === "all" ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.62)"
                      }
                    />
                  </Pressable>
                  <Pressable
                    onPress={cycleSleepTimer}
                    style={({ pressed }) => [
                      styles.timerIconBtn,
                      sleepTimerMinutes > 0 && styles.timerIconBtnOn,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: sleepTimerMinutes > 0 }}
                    accessibilityLabel={
                      sleepTimerMinutes > 0
                        ? `睡眠定时 ${sleepTimerMinutes} 分钟，点按切换`
                        : musicCopy.sleepTimerOff
                    }
                  >
                    <MaterialIcons
                      name="timer"
                      size={17}
                      color={sleepTimerMinutes > 0 ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.62)"}
                    />
                    {sleepTimerBadge ? (
                      <View style={styles.timerBadge}>
                        <Text style={styles.timerBadgeText}>{sleepTimerBadge}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      if (filteredTrackIndices.length <= 1 || currentFilteredIndex < 0) {
                        void playNext();
                        return;
                      }
                      const nextFilteredIndex = (currentFilteredIndex + 1) % filteredTrackIndices.length;
                      const targetTrackIndex = filteredTrackIndices[nextFilteredIndex]!;
                      void playTrackAt(targetTrackIndex);
                    }}
                    hitSlop={14}
                    style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={musicCopy.next}
                  >
                    <MaterialIcons name="skip-next" size={26} color="rgba(255,255,255,0.72)" />
                  </Pressable>
                </View>
              </View>
            </View>

          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0a0908",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  landscapeTapLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 8,
  },
  landscapeCenterTapTarget: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 999,
    zIndex: 8,
  },
  landscapeTimeOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 4,
    alignItems: "center",
  },
  landscapeTimeText: {
    fontSize: 56,
    fontVariant: ["tabular-nums"],
    color: "rgba(255,255,255,0.92)",
    backgroundColor: "transparent",
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  landscapeTimeTextSleep: {
    opacity: 0.5,
    color: "rgba(18,141,210,0.95)",
    textShadowColor: "rgba(4,34,62,0.5)",
  },
  foreground: {
    flex: 1,
    zIndex: 2,
  },
  foregroundLandscape: {
    justifyContent: "center",
  },
  upper: {
    flex: 1,
    minHeight: 80,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  upperLandscape: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    justifyContent: "center",
    minHeight: 0,
    paddingBottom: 0,
  },
  centerVisualLandscape: {
    marginBottom: 0,
  },
  panel: {
    paddingHorizontal: 32,
  },
  panelLandscape: {
    position: "absolute",
    right: 18,
    bottom: 12,
    width: "42%",
    minWidth: 280,
    maxWidth: 420,
    zIndex: 3,
    paddingHorizontal: 14,
  },
  chromeHidden: {
    opacity: 0,
  },
  backBtn: {
    position: "absolute",
    left: 12,
    zIndex: 10,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    zIndex: 2,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 22,
    color: "rgba(255,255,255,0.42)",
    textAlign: "center",
  },
  albumRow: {
    width: "100%",
    marginTop: -4,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  albumBtn: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    opacity: 1,
  },
  albumBtnOn: {
    backgroundColor: "rgba(255,255,255,0.16)",
    borderColor: "rgba(255,255,255,0.3)",
    opacity: 1,
  },
  transport: {
    alignItems: "stretch",
  },
  timeLine: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    color: "rgba(255,255,255,0.38)",
    textAlign: "center",
    marginBottom: 10,
  },
  timeSep: {
    color: "rgba(255,255,255,0.22)",
  },
  controls: {
    marginTop: 6,
    width: "100%",
    maxWidth: 292,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  controlsLandscape: {
    maxWidth: 280,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  queueWrap: {
    width: "100%",
    maxWidth: 300,
    height: QUEUE_VIEWPORT_HEIGHT,
    alignSelf: "center",
    marginBottom: 14,
    position: "relative",
  },
  queueWrapLandscape: {
    maxWidth: 340,
    height: 140,
    marginBottom: 10,
  },
  queueScroll: {
    flex: 1,
  },
  queueScrollContent: {
    paddingTop: QUEUE_FADE_BAND,
    paddingBottom: QUEUE_FADE_BAND,
  },
  queue: {
    paddingTop: 4,
  },
  queueRow: {
    minHeight: QUEUE_ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 4,
    gap: 6,
  },
  queueDownloadIcon: {
    marginRight: 2,
  },
  queueText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.62)",
    ...parchmentSans(400),
    textAlign: "center",
  },
  queueTextActive: {
    color: "rgba(255,255,255,0.98)",
    ...parchmentSans(500),
    fontSize: 18,
  },
  breathRingWrap: {
    width: 220,
    height: BREATH_RING_WRAP_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: BREATH_RING_WRAP_MARGIN_BOTTOM,
  },
  coffeeWrap: {
    width: 220,
    height: BREATH_RING_WRAP_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: BREATH_RING_WRAP_MARGIN_BOTTOM,
  },
  coffeeGlow: {
    position: "absolute",
    width: 98,
    height: 98,
    borderRadius: 999,
    backgroundColor: "rgba(255,245,232,0.28)",
    shadowColor: "#fff3e6",
    shadowOpacity: 0.95,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  coffeeCupIcon: {
    textShadowColor: "rgba(255,245,232,0.5)",
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 0 },
  },
  sleepMoonWrap: {
    width: 220,
    height: BREATH_RING_WRAP_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: BREATH_RING_WRAP_MARGIN_BOTTOM + 24,
  },
  sleepMoonImage: {
    width: 86,
    height: 86,
    tintColor: "rgba(229,242,255,0.98)",
  },
  breathPulseCircle: {
    position: "absolute",
    width: 154,
    height: 154,
    borderRadius: 999,
    backgroundColor: "rgba(234,238,244,0.84)",
    shadowColor: "#d6deea",
    shadowOpacity: 0.9,
    shadowRadius: 64,
    shadowOffset: { width: 0, height: 0 },
    elevation: 9,
    overflow: "hidden",
  },
  breathPulseGlow: {
    position: "absolute",
    width: 182,
    height: 182,
    borderRadius: 999,
    backgroundColor: "rgba(217,229,243,0.34)",
    shadowColor: "#d7e6f6",
    shadowOpacity: 1,
    shadowRadius: 72,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  fishLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "visible",
  },
  fishOrbitNode: {
    position: "absolute",
    left: -20,
    top: -7,
    width: 40,
    height: 14,
  },
  fishOrbitGroup: {
    position: "absolute",
    width: 0,
    height: 0,
  },
  fishImage: {
    width: "100%",
    height: "100%",
    tintColor: "rgba(255,255,255,0.95)",
  },
  coffeeBeanLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "visible",
  },
  coffeeOrbitGroup: {
    position: "absolute",
    width: 0,
    height: 0,
  },
  coffeeBean: {
    position: "absolute",
  },
  coffeeBeanImage: {
    width: "100%",
    height: "100%",
    tintColor: "rgb(75, 47, 27)",
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  coffeeBeanImageDark: {
    tintColor: "rgb(255, 252, 245)",
    shadowOpacity: 0,
  },
  coffeeBeanImageFollower: {
    tintColor: "rgb(168, 126, 88)",
    shadowOpacity: 0,
  },
  meteorLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "34%",
    overflow: "hidden",
  },
  meteor: {
    position: "absolute",
    height: 2,
    borderRadius: 999,
    backgroundColor: "rgba(229,243,255,0.82)",
    shadowColor: "#dbeeff",
    shadowOpacity: 0.78,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  starLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  starDot: {
    position: "absolute",
    backgroundColor: "rgba(241,248,255,0.95)",
    shadowColor: "#e5f2ff",
    shadowOpacity: 0.6,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  workPlanetLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  workOrbitAnchor: {
    position: "absolute",
    width: 0,
    height: 0,
  },
  workCoreMistOuter: {
    position: "absolute",
    width: 292,
    height: 292,
    borderRadius: 999,
    backgroundColor: "rgba(164,188,226,0.14)",
  },
  workCoreMistInner: {
    position: "absolute",
    width: 236,
    height: 236,
    borderRadius: 999,
    backgroundColor: "rgba(176,201,236,0.18)",
  },
  workPlanetOrb: {
    position: "absolute",
    shadowOffset: { width: 0, height: 0 },
  },
  pressed: { opacity: 0.65 },
  repeatBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.72,
  },
  repeatBtnOn: {
    opacity: 1,
  },
  repeatText: {
    fontSize: 10,
    ...parchmentSans(600),
    color: "rgba(255,255,255,0.58)",
    letterSpacing: 0.3,
  },
  repeatTextOn: {
    color: "rgba(255,255,255,0.94)",
  },
  timerIconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.72,
    position: "relative",
  },
  timerIconBtnOn: {
    opacity: 1,
  },
  timerBadge: {
    position: "absolute",
    top: -6,
    right: -10,
    minWidth: 18,
    height: 13,
    borderRadius: 999,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  timerBadgeText: {
    fontSize: 9,
    ...parchmentSans(600),
    color: "rgba(255,255,255,0.96)",
    lineHeight: 10,
  },
});
