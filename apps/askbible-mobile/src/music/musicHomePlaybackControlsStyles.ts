import { StyleSheet } from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import { SPLASH_BACKGROUND as LOGO_COLOR } from "../shell/splash-branding.generated";
import { shellPlaybackTransportLayoutStyles as layout } from "../shell/shellPlaybackTransportLayout";

/** 音乐页播放坞：布局复用 shellPlaybackTransportLayout，仅补深色配色 */
export const musicHomePlaybackControlsStyles = StyleSheet.create({
  playerDock: {
    width: "100%",
    alignSelf: "stretch",
  },
  scrubber: layout.scrubber,
  scrubberBar: layout.scrubberBar,
  timeStart: layout.timeStart,
  timeEnd: layout.timeEnd,
  timeText: {
    fontSize: 12,
    ...parchmentSans(500),
    color: "rgba(255,255,255,0.42)",
    fontVariant: ["tabular-nums"],
  },
  transport: layout.transport,
  transportMain: layout.transportMain,
  transportBtn: layout.transportBtn,
  playBtn: {
    ...layout.playBtn,
    backgroundColor: "#FFFFFF",
  },
  /** 首页视频上的播放圆：与四颗图标同一套黑阴影 */
  playBtnHomeShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.55,
    shadowRadius: 6,
    elevation: 6,
  },
  playBtnPlaying: {
    backgroundColor: LOGO_COLOR,
  },
  playBtnPressed: layout.playBtnPressed,
  playBtnDisabled: layout.transportDisabled,
  playIcon: layout.playIcon,
  loopBtn: layout.loopBtn,
  loopBtnOn: {
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  timerBtn: {
    position: "absolute",
    zIndex: 110,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  timerBadge: {
    position: "absolute",
    top: 2,
    right: 0,
    minWidth: 20,
    height: 15,
    borderRadius: 999,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  timerBadgeText: {
    fontSize: 10,
    ...parchmentSans(600),
    color: "rgba(255,255,255,0.96)",
    lineHeight: 11,
  },
  pressed: { opacity: 0.88 },
});
