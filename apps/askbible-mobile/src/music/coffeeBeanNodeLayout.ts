import type { CoffeeOrbitLayout } from "./coffeeOrbitLayout";
import {
  COFFEE_BEAN_COUNT,
  FOLLOW_WHITE_COFFEE_BEAN_INDICES,
  WHITE_COFFEE_BEAN_INDEX,
  pseudoRandom01,
} from "./musicAlbumVisualConstants";

export type CoffeeBeanNodeLayout = {
  reverseDark: boolean;
  isFollower: boolean;
  followIndex: number;
  direction: number;
  angle: number;
  radius: number;
  beanW: number;
  beanH: number;
  orbitPhaseDeg: number;
  followerBaseDeg: number;
  beanOpacity: number;
  pulseLiftFactor: number;
  pulseScaleFactor: number;
};

export function resolveCoffeeBeanNodeLayout(index: number, layout: CoffeeOrbitLayout): CoffeeBeanNodeLayout {
  const { orbitInnerRadius, orbitOuterRadius } = layout;
  const reverseDark = index === WHITE_COFFEE_BEAN_INDEX;
  const followIndex = FOLLOW_WHITE_COFFEE_BEAN_INDICES.indexOf(
    index as (typeof FOLLOW_WHITE_COFFEE_BEAN_INDICES)[number],
  );
  const isFollower = followIndex >= 0;
  const direction = reverseDark || isFollower ? -1 : 1;
  const ringCount = 10;
  const ring = index % ringCount;
  const slotsPerRing = Math.ceil(COFFEE_BEAN_COUNT / ringCount);
  const slot = Math.floor(index / ringCount);
  const angleBase = slot * (360 / slotsPerRing) + ring * 4;
  const leaderAngleBase = (pseudoRandom01(WHITE_COFFEE_BEAN_INDEX * 5 + 1) - 0.5) * 8;
  const followGap = 10 + pseudoRandom01(index * 71 + 4) * 2;
  const angle = isFollower
    ? leaderAngleBase + (followIndex + 1) * (followGap * 0.36)
    : angleBase + (pseudoRandom01(index * 5 + 1) - 0.5) * 4;
  const ringRatio = ringCount <= 1 ? 0 : ring / (ringCount - 1);
  const radiusBase = orbitInnerRadius + (orbitOuterRadius - orbitInnerRadius) * ringRatio;
  const leaderTrackRadius = orbitOuterRadius - 2;
  const leaderRadius = leaderTrackRadius + (pseudoRandom01(WHITE_COFFEE_BEAN_INDEX * 13 + 3) - 0.5) * 4;
  const radius = reverseDark
    ? leaderRadius
    : isFollower
      ? leaderRadius + followIndex * 2 + (pseudoRandom01(index * 79 + 6) - 0.5) * 2
      : radiusBase + pseudoRandom01(index * 13 + 3) * 18;
  const beanW = 20 + pseudoRandom01(index * 17 + 9) * 18;
  const beanH = beanW * (0.56 + pseudoRandom01(index * 13 + 5) * 0.2);
  const orbitPhaseDeg = pseudoRandom01(index * 61 + 21) * 360;
  const leaderOrbitBaseDeg = pseudoRandom01(WHITE_COFFEE_BEAN_INDEX * 61 + 21) * 360;
  const leaderPhaseLag = isFollower ? 16 + followIndex * 12 : 0;
  const followerBaseDeg = leaderOrbitBaseDeg + leaderPhaseLag;
  const mainBeanOpacity = 0.22 + pseudoRandom01(index * 97 + 13) * 0.18;

  return {
    reverseDark,
    isFollower,
    followIndex,
    direction,
    angle,
    radius,
    beanW,
    beanH,
    orbitPhaseDeg,
    followerBaseDeg,
    beanOpacity: reverseDark ? 0.62 : mainBeanOpacity,
    pulseLiftFactor: isFollower ? 0.35 : 1,
    pulseScaleFactor: isFollower ? 0.06 : 0.1,
  };
}
