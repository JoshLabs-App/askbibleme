"use client";

import { useEffect, useState } from "react";

export type NatureMediaPolicy = {
  documentVisible: boolean;
  /** 低电量且未插电：前台自然视频仅走静图（无 getBattery 时为 false） */
  lowBatteryStatic: boolean;
  saveData: boolean;
  /** `navigator.deviceMemory`（GB），Chrome 等；未知为 undefined */
  deviceMemoryGb: number | undefined;
};

type BatteryLike = {
  charging: boolean;
  level: number;
  addEventListener(type: string, fn: () => void): void;
  removeEventListener(type: string, fn: () => void): void;
};

/**
 * 自然首页：文档可见性、Save-Data、设备内存线索、电量（若可用），供视频与预取做保守策略。
 */
export function useNatureMediaPolicy(): NatureMediaPolicy {
  const [documentVisible, setDocumentVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState === "visible",
  );
  const [lowBatteryStatic, setLowBatteryStatic] = useState(false);
  const [saveData, setSaveData] = useState(false);
  const [deviceMemoryGb, setDeviceMemoryGb] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVis = () => setDocumentVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const c = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    setSaveData(Boolean(c?.saveData));
    const dm = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    setDeviceMemoryGb(typeof dm === "number" && dm > 0 ? dm : undefined);
  }, []);

  useEffect(() => {
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryLike> };
    if (typeof nav.getBattery !== "function") return;

    let cancelled = false;
    let battery: BatteryLike | null = null;
    const sync = () => {
      if (cancelled || !battery) return;
      const level = battery.level;
      setLowBatteryStatic(!battery.charging && level > 0 && level <= 0.2);
    };

    void nav.getBattery().then((b) => {
      if (cancelled) return;
      battery = b;
      sync();
      b.addEventListener("chargingchange", sync);
      b.addEventListener("levelchange", sync);
    });

    return () => {
      cancelled = true;
      if (battery) {
        battery.removeEventListener("chargingchange", sync);
        battery.removeEventListener("levelchange", sync);
      }
    };
  }, []);

  return { documentVisible, lowBatteryStatic, saveData, deviceMemoryGb };
}
