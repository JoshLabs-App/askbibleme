import { Animated, View } from "react-native";
import { FISH_ORBIT_GROUPS, useFishSwarmClocks } from "./fishSwarmNativeMotion";
import { FISH_SHAPE, coffeeVisualCenterY, visualStyles } from "./musicAlbumVisualShared";

export function SlowFish({
  active,
  width,
  height,
  viewportHeight,
  viewportTop = 0,
  centerMode = "lower",
}: {
  active: boolean;
  width: number;
  height: number;
  viewportHeight: number;
  viewportTop?: number;
  centerMode?: "lower" | "center";
}) {
  useFishSwarmClocks(active);

  const cx = width * 0.5;
  const cy = coffeeVisualCenterY(height, centerMode === "center", viewportHeight, viewportTop);

  return (
    <View pointerEvents="none" style={visualStyles.fishLayer}>
      <View style={[visualStyles.fishOrbitGroup, { left: cx, top: cy }]}>
        {FISH_ORBIT_GROUPS.map((group) => (
          <Animated.View
            key={`orbit-${group.harmonic}`}
            style={[visualStyles.fishOrbitGroup, { transform: [{ rotate: group.rotate }] }]}
          >
            {group.fish.map((fish, i) => (
              <Animated.Image
                key={`fish-${group.harmonic}-${i}`}
                source={FISH_SHAPE}
                resizeMode="contain"
                style={[
                  visualStyles.fishSprite,
                  {
                    opacity: fish.opacity,
                    transform: [
                      { rotate: `${fish.seed.baseAngleDeg}deg` },
                      { translateX: fish.translateX },
                      { translateY: fish.translateY },
                      { rotate: fish.headingDeg },
                      { scale: fish.seed.size },
                    ],
                  },
                ]}
              />
            ))}
          </Animated.View>
        ))}
      </View>
    </View>
  );
}
