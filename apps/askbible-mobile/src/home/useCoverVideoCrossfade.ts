import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing } from "react-native";
import { SHELL_VIDEO_ANIM_NATIVE_DRIVER } from "./shellVideoAnimation";

/** 场景交叉淡入淡出时长（并行：旧片淡出 + 新片淡入） */
const CROSSFADE_MS = 580;

/**
 * 双槽位 A/B 常驻：按 sceneId 切换隐藏槽，首帧就绪后并行交叉淡入淡出。
 * 配合 APK 内 `require()` + 启动预解压，不依赖网络拉流。
 */
export function useCoverVideoCrossfade(nextSceneId: string, animated = true) {
  const trimmed = nextSceneId.trim();
  const [slotAScene, setSlotAScene] = useState(trimmed);
  const [slotBScene, setSlotBScene] = useState(trimmed);
  const opacityA = useRef(new Animated.Value(1)).current;
  const opacityB = useRef(new Animated.Value(0)).current;
  const activeSlotRef = useRef<"a" | "b">("a");
  const hasPlayedRef = useRef(false);
  const transitioningRef = useRef(false);
  const pendingIncomingRef = useRef<"a" | "b" | null>(null);
  const [slotAReady, setSlotAReady] = useState(false);
  const [slotBReady, setSlotBReady] = useState(false);

  const crossfadeAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  const snapActiveOpacity = useCallback(() => {
    if (activeSlotRef.current === "a") {
      opacityA.setValue(1);
      opacityB.setValue(0);
    } else {
      opacityA.setValue(0);
      opacityB.setValue(1);
    }
  }, [opacityA, opacityB]);

  const startCrossfade = useCallback(
    (incoming: "a" | "b") => {
      const fadeIn = incoming === "a" ? opacityA : opacityB;
      const fadeOut = incoming === "a" ? opacityB : opacityA;

      crossfadeAnimRef.current?.stop();
      if (!animated) {
        activeSlotRef.current = incoming;
        transitioningRef.current = false;
        pendingIncomingRef.current = null;
        if (incoming === "a") {
          opacityA.setValue(1);
          opacityB.setValue(0);
          setSlotBReady(false);
        } else {
          opacityA.setValue(0);
          opacityB.setValue(1);
          setSlotAReady(false);
        }
        crossfadeAnimRef.current = null;
        return;
      }
      fadeIn.setValue(0);
      fadeOut.setValue(1);

      crossfadeAnimRef.current = Animated.parallel([
        Animated.timing(fadeIn, {
          toValue: 1,
          duration: CROSSFADE_MS,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: SHELL_VIDEO_ANIM_NATIVE_DRIVER,
        }),
        Animated.timing(fadeOut, {
          toValue: 0,
          duration: CROSSFADE_MS,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: SHELL_VIDEO_ANIM_NATIVE_DRIVER,
        }),
      ]);
      crossfadeAnimRef.current.start(({ finished }) => {
        if (!finished) return;
        activeSlotRef.current = incoming;
        transitioningRef.current = false;
        pendingIncomingRef.current = null;
        crossfadeAnimRef.current = null;
        if (incoming === "a") {
          opacityB.setValue(0);
          setSlotBReady(false);
        } else {
          opacityA.setValue(0);
          setSlotAReady(false);
        }
      });
    },
    [animated, opacityA, opacityB],
  );

  const tryStartPendingCrossfade = useCallback(
    (slot: "a" | "b") => {
      if (!transitioningRef.current || pendingIncomingRef.current !== slot) return;
      const ready = slot === "a" ? slotAReady : slotBReady;
      if (!ready) return;
      startCrossfade(slot);
    },
    [slotAReady, slotBReady, startCrossfade],
  );

  useEffect(() => {
    if (!trimmed) return;

    const activeScene = activeSlotRef.current === "a" ? slotAScene : slotBScene;
    if (trimmed === activeScene && !transitioningRef.current) return;
    if (transitioningRef.current && pendingIncomingRef.current) {
      crossfadeAnimRef.current?.stop();
      crossfadeAnimRef.current = null;
      snapActiveOpacity();
      const incoming = activeSlotRef.current === "a" ? "b" : "a";
      const incomingAlreadyHasScene =
        incoming === "a" ? slotAScene === trimmed : slotBScene === trimmed;
      if (incoming === "a") {
        if (slotAScene !== trimmed) setSlotAScene(trimmed);
        setSlotAReady(incomingAlreadyHasScene);
      } else {
        if (slotBScene !== trimmed) setSlotBScene(trimmed);
        setSlotBReady(incomingAlreadyHasScene);
      }
      pendingIncomingRef.current = incoming;
      return;
    }

    if (!hasPlayedRef.current) {
      setSlotAScene(trimmed);
      setSlotBScene(trimmed);
      activeSlotRef.current = "a";
      opacityA.setValue(1);
      opacityB.setValue(0);
      return;
    }

    const incoming: "a" | "b" = activeSlotRef.current === "a" ? "b" : "a";
    transitioningRef.current = true;
    pendingIncomingRef.current = incoming;

    const incomingAlreadyHasScene =
      incoming === "a" ? slotAScene === trimmed : slotBScene === trimmed;

    if (incoming === "a") {
      if (slotAScene !== trimmed) setSlotAScene(trimmed);
      setSlotAReady(incomingAlreadyHasScene);
    } else {
      if (slotBScene !== trimmed) setSlotBScene(trimmed);
      setSlotBReady(incomingAlreadyHasScene);
    }
  }, [trimmed, slotAScene, slotBScene, opacityA, opacityB, snapActiveOpacity]);

  const onSlotAReady = useCallback(() => {
    if (!hasPlayedRef.current) {
      hasPlayedRef.current = true;
      setSlotAReady(true);
      return;
    }
    setSlotAReady(true);
    tryStartPendingCrossfade("a");
  }, [tryStartPendingCrossfade]);

  const onSlotBReady = useCallback(() => {
    setSlotBReady(true);
    tryStartPendingCrossfade("b");
  }, [tryStartPendingCrossfade]);

  useEffect(() => {
    tryStartPendingCrossfade("a");
  }, [slotAReady, tryStartPendingCrossfade]);

  useEffect(() => {
    tryStartPendingCrossfade("b");
  }, [slotBReady, tryStartPendingCrossfade]);

  const allowInitialPoster = !hasPlayedRef.current;

  return {
    slotAScene,
    slotBScene,
    opacityA,
    opacityB,
    onSlotAReady,
    onSlotBReady,
    allowInitialPoster,
  };
}
