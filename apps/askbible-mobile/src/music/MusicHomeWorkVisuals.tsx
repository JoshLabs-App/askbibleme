import { Animated, View } from "react-native";
import { FOCUS_ORB_CENTER_Y_RATIO, visualStyles } from "./musicAlbumVisualShared";
import { useWorkSpacePlanetMotion } from "./useWorkSpacePlanetMotion";

export function WorkSpacePlanets({
  active,
  visible,
  width,
  height,
}: {
  active: boolean;
  visible: boolean;
  width: number;
  height: number;
}) {
  const { orbitADeg, orbitBDeg, mistOuterOpacity, mistInnerOpacity } = useWorkSpacePlanetMotion(active);

  if (!visible) return null;
  const cx = width * 0.5;
  const cy = height * FOCUS_ORB_CENTER_Y_RATIO;

  return (
    <View pointerEvents="none" style={visualStyles.workPlanetLayer}>
      <Animated.View
        style={[
          visualStyles.workCoreMistOuter,
          {
            left: cx - 146,
            top: cy - 146,
            opacity: mistOuterOpacity,
          },
        ]}
      />
      <Animated.View
        style={[
          visualStyles.workCoreMistInner,
          {
            left: cx - 118,
            top: cy - 118,
            opacity: mistInnerOpacity,
          },
        ]}
      />
      <View
        style={[
          visualStyles.workPlanetOrb,
          {
            width: 176,
            height: 176,
            borderRadius: 176,
            left: cx - 88,
            top: cy - 88,
            backgroundColor: "rgba(160,182,222,0.34)",
            shadowColor: "#9fb8e8",
            shadowOpacity: 0.5,
            shadowRadius: 30,
          },
        ]}
      />
      <Animated.View
        style={[
          visualStyles.workOrbitAnchor,
          {
            left: cx,
            top: cy,
            transform: [{ rotate: orbitADeg }],
          },
        ]}
      >
        <View
          style={[
            visualStyles.workPlanetOrb,
            {
              width: 56,
              height: 56,
              borderRadius: 56,
              backgroundColor: "rgba(124,150,198,0.26)",
              shadowColor: "#89a9dd",
              shadowOpacity: 0.44,
              shadowRadius: 20,
              transform: [{ rotate: "18deg" }, { translateX: 176 }],
            },
          ]}
        />
      </Animated.View>
      <Animated.View
        style={[
          visualStyles.workOrbitAnchor,
          {
            left: cx,
            top: cy,
            transform: [{ rotate: orbitBDeg }],
          },
        ]}
      >
        <View
          style={[
            visualStyles.workPlanetOrb,
            {
              width: 42,
              height: 42,
              borderRadius: 42,
              backgroundColor: "rgba(193,214,245,0.3)",
              shadowColor: "#bdd3f5",
              shadowOpacity: 0.48,
              shadowRadius: 14,
              transform: [{ rotate: "-142deg" }, { translateX: 152 }],
            },
          ]}
        />
      </Animated.View>
    </View>
  );
}
