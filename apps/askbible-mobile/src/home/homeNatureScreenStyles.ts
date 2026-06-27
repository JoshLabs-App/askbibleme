import { StyleSheet } from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as parchment } from "../read/readParchmentTheme";
import { HOME_SCENE_THUMB_GAP } from "./HomeSceneThumb";
import {
  AMBIENT_ICON_GAP,
  AMBIENT_ICON_SIZE,
  HOME_SCENE_STRIP_EDGE_PAD,
} from "./homeNatureScreenConstants";

export const homeNatureScreenStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#ffffff",
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
    alignItems: "center",
    gap: 4,
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
    zIndex: 50,
    elevation: 50,
    alignItems: "center",
  },
  bottomBandLandscape: {
    paddingTop: 0,
    justifyContent: "flex-end",
  },
  homeMusicPlayBtnWrap: {
    zIndex: 51,
    elevation: 51,
  },
  homeMusicPlayBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
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
  ambientScrollWrap: {
    alignSelf: "stretch",
    marginBottom: 4,
    zIndex: 30,
    elevation: 20,
  },
  ambientScroll: {
    width: "100%",
  },
  ambientRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: AMBIENT_ICON_GAP,
    paddingLeft: HOME_SCENE_STRIP_EDGE_PAD,
    paddingRight: HOME_SCENE_STRIP_EDGE_PAD,
    paddingVertical: 2,
  },
  ambientChip: {
    width: AMBIENT_ICON_SIZE,
    height: AMBIENT_ICON_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  ambientChipSelected: {
    transform: [{ scale: 1.12 }],
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
    alignItems: "center",
    justifyContent: "flex-start",
    gap: HOME_SCENE_THUMB_GAP,
    paddingTop: 6,
    paddingBottom: 6,
    paddingRight: HOME_SCENE_STRIP_EDGE_PAD,
  },
  sceneRowLandscape: {
    paddingTop: 2,
    paddingBottom: 0,
  },
});
