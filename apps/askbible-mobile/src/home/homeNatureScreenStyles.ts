import { StyleSheet } from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as parchment } from "../read/readParchmentTheme";
import { SPLASH_BACKGROUND as LOGO_COLOR } from "../shell/splash-branding.generated";
import { HOME_SCENE_THUMB_GAP } from "./HomeSceneThumb";
import {
  AMBIENT_CHIP_WIDTH,
  AMBIENT_CHIP_HEIGHT,
  AMBIENT_ICON_GAP,
  HOME_BOTTOM_ICON_ROW_GAP,
  HOME_SCALE_TIMER_ROW_H,
  HOME_SCENE_STRIP_EDGE_PAD,
  HOME_SCENE_STRIP_LANDSCAPE_EDGE_PAD,
  QUICK_CONTROL_ICON_GAP,
  QUICK_CONTROL_HIT_SIZE,
} from "./homeNatureLayoutMetrics";

export const homeNatureScreenStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0a0806",
    overflow: "visible",
  },
  fullBleedBackdropFill: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    backgroundColor: parchment.canvas,
  },
  loadingText: {
    marginTop: 14,
    fontSize: 14,
    color: parchment.muted,
  },
  sceneLoadOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 3,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10,8,6,0.28)",
  },
  sceneLoadText: {
    marginTop: 10,
    fontSize: 13,
    color: "rgba(255,255,255,0.78)",
    letterSpacing: 0.2,
  },
  sceneMusicTapSurface: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 6,
  },
  errorTitle: {
    fontSize: 15,
    color: parchment.ink,
    textAlign: "center",
    lineHeight: 22,
  },
  errorDetail: {
    marginTop: 8,
    fontSize: 12,
    color: parchment.faint,
    textAlign: "center",
  },
  emptyTitle: {
    fontSize: 17,
    ...parchmentSans(600),
    color: parchment.ink,
    textAlign: "center",
  },
  emptyBody: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 22,
    color: parchment.muted,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 22,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: parchment.surfaceSolid,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: parchment.border,
  },
  retryText: {
    fontSize: 14,
    ...parchmentSans(600),
    color: parchment.ink,
  },
  autoImmersiveBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
  },
  topChrome: {
    position: "absolute",
    zIndex: 50,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
  },
  topChromeTrail: {
    alignItems: "center",
  },
  settingsBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  voiceBtn: {
    borderRadius: 999,
  },
  voiceHint: {
    position: "absolute",
    top: 92,
    right: 2,
    fontSize: 11,
    color: "rgba(255,255,255,0.88)",
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: "hidden",
  },
  bottomBand: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    gap: HOME_BOTTOM_ICON_ROW_GAP,
    zIndex: 50,
    elevation: 50,
    alignItems: "center",
  },
  bottomBandLandscape: {
    paddingTop: 0,
    justifyContent: "flex-end",
  },
  bottomBandHidden: {
    opacity: 0,
  },
  homeMusicPlayBtnWrap: {
    zIndex: 51,
    elevation: 51,
  },
  goldenVersePreparingHint: {
    zIndex: 51,
    elevation: 51,
    alignSelf: "center",
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
    fontSize: 12,
    lineHeight: 16,
    color: "rgba(255,255,255,0.88)",
    backgroundColor: "rgba(0,0,0,0.28)",
    textAlign: "center",
  },
  homePlayButtonsRow: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  homeMusicPlayBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  homeMusicPlayBtnActive: {
    backgroundColor: "rgba(255, 177, 1, 0.16)",
  },
  homeMusicPlayBtnDisabled: {
    opacity: 0.4,
  },
  homeMusicPlayBtnPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.97 }],
  },
  homeGoldenVersePlayBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  homeGoldenVersePlayBtnPreparing: {
    backgroundColor: "rgba(255, 177, 1, 0.14)",
  },
  quickControlsRow: {
    zIndex: 51,
    elevation: 51,
    alignSelf: "stretch",
    width: "100%",
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: HOME_SCENE_STRIP_EDGE_PAD,
    minHeight: 72,
  },
  quickControlsRowLandscape: {
    paddingHorizontal: HOME_SCENE_STRIP_LANDSCAPE_EDGE_PAD,
  },
  quickControlSideGroup: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: QUICK_CONTROL_ICON_GAP,
    opacity: 0.5,
  },
  quickControlSideGroupStart: {
    justifyContent: "flex-start",
  },
  quickControlSideGroupEnd: {
    justifyContent: "flex-end",
  },
  quickControlChip: {
    width: QUICK_CONTROL_HIT_SIZE,
    height: QUICK_CONTROL_HIT_SIZE,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  quickControlChipOn: {
    transform: [{ scale: 1.06 }],
  },
  quickControlChipDisabled: {
    opacity: 0.35,
  },
  quickControlChipPressed: {
    opacity: 0.62,
  },
  quickControlAaText: {
    fontSize: 26,
    lineHeight: QUICK_CONTROL_HIT_SIZE,
    fontWeight: "600",
    letterSpacing: -0.6,
    color: "rgba(255,255,255,0.92)",
    textAlign: "center",
    includeFontPadding: false,
  },
  quickControlTimerBadge: {
    position: "absolute",
    top: -2,
    right: -6,
    minWidth: 22,
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
  },
  quickControlTimerBadgeText: {
    color: LOGO_COLOR,
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 12,
  },
  scaleTimerRow: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: AMBIENT_ICON_GAP,
  },
  scaleTimerHit: {
    minWidth: HOME_SCALE_TIMER_ROW_H,
    minHeight: HOME_SCALE_TIMER_ROW_H,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  scaleTimerHitDisabled: {
    opacity: 0.35,
  },
  scaleTimerHitPressed: {
    opacity: 0.62,
  },
  ambientScrollWrap: {
    alignSelf: "stretch",
    height: AMBIENT_CHIP_HEIGHT,
    zIndex: 30,
    elevation: 20,
  },
  ambientScroll: {
    width: "100%",
    height: AMBIENT_CHIP_HEIGHT,
  },
  ambientRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    height: AMBIENT_CHIP_HEIGHT,
    gap: AMBIENT_ICON_GAP,
    paddingLeft: HOME_SCENE_STRIP_EDGE_PAD,
    paddingRight: HOME_SCENE_STRIP_EDGE_PAD,
  },
  ambientChip: {
    width: AMBIENT_CHIP_WIDTH,
    height: AMBIENT_CHIP_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  ambientChipIdle: {
    opacity: 0.6,
  },
  ambientChipSelected: {
    transform: [{ scale: 1.06 }],
  },
  ambientChipDisabled: {
    opacity: 0.55,
  },
  ambientChipPressed: {
    opacity: 0.62,
  },
  sceneList: {
    alignSelf: "stretch",
    flexGrow: 0,
  },
  sceneListScroll: {
    width: "100%",
    direction: "ltr",
  },
  sceneRow: {
    flexDirection: "row",
    direction: "ltr",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    gap: HOME_SCENE_THUMB_GAP,
    paddingTop: 0,
    // 圆图底部接触影留一点空间
    paddingBottom: 6,
    paddingRight: HOME_SCENE_STRIP_EDGE_PAD,
  },
  sceneRowLandscape: {
    paddingTop: 0,
    paddingBottom: 0,
  },
});

