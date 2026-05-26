import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { chromeScrimGradientColors } from "../shell/chromeScrim";
import { readShellChromeTune } from "./natureHomePrefs";

type Props = {
  bottomInset: number;
  prefsVersion?: number;
};

/** 顶/底压边：与网站 `shellChromeTopLayerStyle` / `shellChromeBottomLayerStyleForNatureVideoStage` 同源 */
export function HomeChromeScrim({ bottomInset, prefsVersion = 0 }: Props) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    void readShellChromeTune().then(() => setTick((n) => n + 1));
  }, [prefsVersion]);

  const scrim = useMemo(() => chromeScrimGradientColors(), [tick]);

  return (
    <>
      <View pointerEvents="none" style={[styles.topWrap, { height: scrim.topHeightPx }]}>
        <LinearGradient
          colors={scrim.top.colors as [string, string, ...string[]]}
          locations={scrim.top.locations as [number, number, ...number[]]}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.bottomWrap,
          { height: scrim.bottomHeightPx + bottomInset, paddingBottom: bottomInset },
        ]}
      >
        <LinearGradient
          colors={scrim.bottom.colors as [string, string, ...string[]]}
          locations={scrim.bottom.locations as [number, number, ...number[]]}
          start={{ x: 0.5, y: 1 }}
          end={{ x: 0.5, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  topWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    zIndex: 4,
  },
  bottomWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 4,
  },
});
