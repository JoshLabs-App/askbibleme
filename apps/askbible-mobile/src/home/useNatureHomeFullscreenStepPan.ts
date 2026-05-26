import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import { SHELL_VIDEO_ANIM_NATIVE_DRIVER } from "./shellVideoAnimation";

const FULLSCREEN_PAN_STEP_MS = 5 * 60 * 1000;
const FULLSCREEN_PAN_STEPS = 6;
const FULLSCREEN_PAN_LAST_INDEX = FULLSCREEN_PAN_STEPS - 1;

/**
 * 全屏背景位移：30 分钟分 6 段（每 5 分钟一段），从左到右，最后一段停在最右。
 */
export function useNatureHomeFullscreenStepPan(
  enabled: boolean,
  contentWidth: number,
  viewportWidth: number,
  resetKey = "",
): Animated.Value {
  const panX = useRef(new Animated.Value(0)).current;
  const currentStepRef = useRef(0);
  const startedAtRef = useRef(0);

  const panDistance = Math.max(0, contentWidth - viewportWidth);

  useEffect(() => {
    panX.stopAnimation();
    panX.setValue(0);
    currentStepRef.current = 0;
    startedAtRef.current = Date.now();

    if (!enabled || panDistance < 1) {
      return;
    }

    const syncStep = () => {
      const elapsed = Date.now() - startedAtRef.current;
      const totalSteps = Math.floor(elapsed / FULLSCREEN_PAN_STEP_MS);
      const nextStep = totalSteps % FULLSCREEN_PAN_STEPS;
      if (nextStep === currentStepRef.current) return;

      const wrapped = nextStep < currentStepRef.current;
      currentStepRef.current = nextStep;

      if (wrapped) {
        panX.stopAnimation();
        panX.setValue(0);
      }

      const ratio = nextStep / FULLSCREEN_PAN_LAST_INDEX;
      const targetX = -panDistance * ratio;

      Animated.timing(panX, {
        toValue: targetX,
        duration: 900,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: SHELL_VIDEO_ANIM_NATIVE_DRIVER,
      }).start();
    };

    const id = setInterval(syncStep, 1000);
    return () => clearInterval(id);
  }, [enabled, panDistance, panX, resetKey]);

  return panX;
}
