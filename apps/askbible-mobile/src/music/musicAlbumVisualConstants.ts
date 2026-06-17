export const METEOR_COUNT = 4;
export const STAR_COUNT = 28;
export const FISH_COUNT = 100;
export const COFFEE_BEAN_COUNT = 34;
export const WHITE_COFFEE_BEAN_INDEX = 0;
export const FOLLOW_WHITE_COFFEE_BEAN_INDICES = [1, 2, 3] as const;
export const COFFEE_CUP_ICON_SIZE = 88;
export const FOCUS_ORB_CENTER_Y_RATIO = 0.382;
export const COFFEE_ORBIT_VISIBLE_PADDING = 4;
export const COFFEE_ORBIT_MIN_RADIUS = 34;
export const BREATH_RING_WRAP_HEIGHT = 190;
export const BREATH_RING_WRAP_MARGIN_BOTTOM = 6;
export const FISH_SHAPE = require("../../assets/images/fish-shape.png");
export const SLEEP_MOON_SHAPE = require("../../assets/images/sleep-crescent-moon.png");
export const COFFEE_BEAN_SHAPE = require("../../assets/images/coffee-bean-shape.png");

export function pseudoRandom01(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function coffeeVisualCenterY(
  containerHeight: number,
  centered: boolean,
  viewportHeight: number,
  viewportTop: number,
): number {
  if (centered) return containerHeight / 2;
  const focusCenterYOnScreen = viewportHeight * FOCUS_ORB_CENTER_Y_RATIO;
  return focusCenterYOnScreen - viewportTop;
}
