import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import {
  FISH_COUNT,
  FISH_SHAPE,
  coffeeVisualCenterY,
  pseudoRandom01,
  visualStyles,
} from "./musicAlbumVisualShared";

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
  const [motionMs, setMotionMs] = useState(0);

  useEffect(() => {
    if (!active) {
      setMotionMs(0);
      return;
    }
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setMotionMs(Date.now() - startedAt);
    }, 33);

    return () => {
      clearInterval(timer);
    };
  }, [active]);

  const cx = width * 0.5;
  const cy = coffeeVisualCenterY(height, centerMode === "center", viewportHeight, viewportTop);
  const orbitTurns = motionMs / 42000;
  const shimmerPhase = (motionMs % 8200) / 8200;

  return (
    <View pointerEvents="none" style={visualStyles.fishLayer}>
      <View
        style={[
          visualStyles.fishOrbitGroup,
          {
            left: cx,
            top: cy,
          },
        ]}
      >
        {Array.from({ length: FISH_COUNT }, (_, i) => {
          const ring = Math.floor(i / 12);
          const slot = i % 12;
          const angleBase = slot * 30;
          const angleJitter = (pseudoRandom01(i * 19 + 7) - 0.5) * 44;
          const angle = angleBase + angleJitter + ring * 2.5;
          const radiusBase = 132 + ring * 13.5;
          const radiusJitter = pseudoRandom01(i * 23 + 11) * 20;
          const radius = radiusBase + radiusJitter;
          const size = 0.55 + pseudoRandom01(i * 31 + 17) * 0.68;
          const opacity = 0.34 + pseudoRandom01(i * 37 + 3) * 0.28;
          const ringSpeedBoost = 0.7 + ring * 0.14;
          const randomSpeed = 0.45 + pseudoRandom01(i * 41 + 9) * 1.7;
          const speedFactor = ringSpeedBoost * randomSpeed * 0.58;
          const orbitOffset = pseudoRandom01(i * 67 + 21) * 360;
          const fishOrbitAngle = orbitTurns * 360 * speedFactor + orbitOffset;
          const localShimmer = (shimmerPhase + i / FISH_COUNT) % 1;
          const shimmerOpacityFactor =
            localShimmer <= 0.5 ? 0.88 + localShimmer * 0.24 : 1 - (localShimmer - 0.5) * 0.24;
          const bobY = localShimmer <= 0.5 ? -2.4 + localShimmer * 9.6 : 2.4 - (localShimmer - 0.5) * 9.6;
          const swimPhase = (motionMs / (2600 + pseudoRandom01(i * 73 + 33) * 2600) + i * 0.21) % 1;
          const swimWave = Math.sin(swimPhase * Math.PI * 2);
          const tangentialSway = swimWave * (1.6 + pseudoRandom01(i * 79 + 27) * 2.2);
          const radialSway = Math.cos(swimPhase * Math.PI * 2) * (1.6 + pseudoRandom01(i * 83 + 31) * 3.2);
          const headingWiggle = swimWave * (1.2 + pseudoRandom01(i * 89 + 37) * 2.6);
          return (
            <View
              key={`fish-${i}`}
              style={[
                visualStyles.fishOrbitNode,
                {
                  opacity: opacity * shimmerOpacityFactor,
                  transform: [
                    { rotate: `${angle + fishOrbitAngle}deg` },
                    { translateX: radius + radialSway },
                    { translateY: tangentialSway },
                    { translateY: bobY },
                    { rotate: `${headingWiggle}deg` },
                    { rotate: "90deg" },
                    { scale: size },
                  ],
                },
              ]}
            >
              <Image source={FISH_SHAPE} style={visualStyles.fishImage} resizeMode="contain" />
            </View>
          );
        })}
      </View>
    </View>
  );
}
