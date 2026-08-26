import { Image } from "react-native";
import { normalizeScripturePlaybackRate } from "../music/music-playback-prefs";
import { shellPlaybackTransportMetrics as tm } from "../shell/shellPlaybackTransportLayout";

const SPEED_ICONS = {
  0.75: require("../../assets/images/scripture-speed/scripture-speed-075.png"),
  1: require("../../assets/images/scripture-speed/scripture-speed-1.png"),
  1.25: require("../../assets/images/scripture-speed/scripture-speed-125.png"),
  1.5: require("../../assets/images/scripture-speed/scripture-speed-15.png"),
  1.75: require("../../assets/images/scripture-speed/scripture-speed-175.png"),
  2: require("../../assets/images/scripture-speed/scripture-speed-2.png"),
} as const;

type Props = {
  rate: number;
  color: string;
};

/** 语速档位用预渲染图，不受系统字体大小影响。 */
export function ScriptureSpeedRateIcon({ rate, color }: Props) {
  const key = normalizeScripturePlaybackRate(rate) as keyof typeof SPEED_ICONS;
  return (
    <Image
      source={SPEED_ICONS[key] ?? SPEED_ICONS[1]}
      style={{ width: tm.speedBtnSize, height: 22, tintColor: color }}
      resizeMode="contain"
    />
  );
}
