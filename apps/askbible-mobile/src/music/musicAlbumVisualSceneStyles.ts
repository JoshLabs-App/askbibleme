import { StyleSheet } from "react-native";

export const musicAlbumVisualSceneStyleDefs = {
  fishLayer: {
    ...StyleSheet.absoluteFillObject,
    // 向下溢出到曲目区，避免上半舞台裁切鱼群
    bottom: -220,
    overflow: "visible",
  },
  fishOrbitGroup: {
    position: "absolute",
    width: 0,
    height: 0,
  },
  // 精灵与轨道节点合并为同一图层：省掉每条鱼一层包裹 View
  fishSprite: {
    position: "absolute",
    left: -20,
    top: -7,
    width: 40,
    height: 14,
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
} as const;
