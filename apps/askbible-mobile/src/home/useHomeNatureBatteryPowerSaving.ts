import { useEffect, useMemo, useState } from "react";
import { requireOptionalNativeModule } from "expo-modules-core";

/** 与 expo-battery BatteryState 对齐；避免顶层 import 在未链原生模块时闪退。 */
export const BatteryState = {
  UNKNOWN: 0,
  UNPLUGGED: 1,
  CHARGING: 2,
  FULL: 3,
} as const;

type BatteryStateValue = (typeof BatteryState)[keyof typeof BatteryState];

type ExpoBatteryNative = {
  getBatteryLevelAsync?: () => Promise<number>;
  getBatteryStateAsync?: () => Promise<number>;
  isLowPowerModeEnabledAsync?: () => Promise<boolean>;
  addListener: (
    eventName: string,
    listener: (event: Record<string, unknown>) => void,
  ) => { remove: () => void };
};

const ExpoBattery = requireOptionalNativeModule<ExpoBatteryNative>("ExpoBattery");

/** 未插电且电量 ≤ 20% 视为低电量（与常见系统「低电量」提示接近）。 */
export const HOME_NATURE_LOW_BATTERY_LEVEL = 0.2;

export function shouldForceNaturePowerSaving(args: {
  batteryLevel: number;
  batteryState: BatteryStateValue;
  lowPowerMode: boolean;
}): boolean {
  if (args.lowPowerMode) return true;
  const level = args.batteryLevel;
  if (!(level >= 0) || level > HOME_NATURE_LOW_BATTERY_LEVEL) return false;
  if (args.batteryState === BatteryState.CHARGING || args.batteryState === BatteryState.FULL) {
    return false;
  }
  return true;
}

function useSafePowerState(): {
  batteryLevel: number;
  batteryState: BatteryStateValue;
  lowPowerMode: boolean;
} {
  const [batteryLevel, setBatteryLevel] = useState(-1);
  const [batteryState, setBatteryState] = useState<BatteryStateValue>(BatteryState.UNKNOWN);
  const [lowPowerMode, setLowPowerMode] = useState(false);

  useEffect(() => {
    if (!ExpoBattery) return;

    let cancelled = false;
    const safe = <T,>(promise: Promise<T> | undefined, apply: (value: T) => void) => {
      if (!promise) return;
      void promise.then((value) => {
        if (!cancelled) apply(value);
      });
    };

    safe(ExpoBattery.getBatteryLevelAsync?.(), setBatteryLevel);
    safe(ExpoBattery.getBatteryStateAsync?.(), (value) => {
      setBatteryState(value as BatteryStateValue);
    });
    safe(ExpoBattery.isLowPowerModeEnabledAsync?.(), setLowPowerMode);

    const levelSub = ExpoBattery.addListener("Expo.batteryLevelDidChange", (event) => {
      const next = event.batteryLevel;
      if (typeof next === "number") setBatteryLevel(next);
    });
    const stateSub = ExpoBattery.addListener("Expo.batteryStateDidChange", (event) => {
      const next = event.batteryState;
      if (typeof next === "number") setBatteryState(next as BatteryStateValue);
    });
    const modeSub = ExpoBattery.addListener("Expo.powerModeDidChange", (event) => {
      if (typeof event.lowPowerMode === "boolean") setLowPowerMode(event.lowPowerMode);
    });

    return () => {
      cancelled = true;
      levelSub.remove();
      stateSub.remove();
      modeSub.remove();
    };
  }, []);

  return { batteryLevel, batteryState, lowPowerMode };
}

/** 系统低电量或 Low Power Mode → 首页自动等同「开模糊」。 */
export function useHomeNatureBatteryPowerSaving(): boolean {
  const { batteryLevel, batteryState, lowPowerMode } = useSafePowerState();
  return useMemo(
    () =>
      shouldForceNaturePowerSaving({
        batteryLevel,
        batteryState,
        lowPowerMode,
      }),
    [batteryLevel, batteryState, lowPowerMode],
  );
}
