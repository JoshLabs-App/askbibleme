import {
  COFFEE_CUP_ICON_SIZE,
  COFFEE_ORBIT_MIN_RADIUS,
  COFFEE_ORBIT_VISIBLE_PADDING,
  coffeeVisualCenterY,
} from "./musicAlbumVisualConstants";

export type CoffeeOrbitLayout = {
  cx: number;
  cy: number;
  orbitInnerRadius: number;
  orbitOuterRadius: number;
};

export function resolveCoffeeOrbitLayout(args: {
  width: number;
  height: number;
  viewportHeight: number;
  viewportTop: number;
  centered: boolean;
}): CoffeeOrbitLayout {
  const { width, height, viewportHeight, viewportTop, centered } = args;
  const cx = width * 0.5;
  const cy = coffeeVisualCenterY(height, centered, viewportHeight, viewportTop);
  const cyOnScreen = viewportTop + cy;
  const maxVisibleOrbitRadius = Math.max(
    COFFEE_ORBIT_MIN_RADIUS + 16,
    Math.min(
      cx - COFFEE_ORBIT_VISIBLE_PADDING,
      width - cx - COFFEE_ORBIT_VISIBLE_PADDING,
      cyOnScreen - COFFEE_ORBIT_VISIBLE_PADDING,
      viewportHeight - cyOnScreen - COFFEE_ORBIT_VISIBLE_PADDING,
    ),
  );
  const cupOuterRadius = COFFEE_CUP_ICON_SIZE * 0.56;
  const centerKeepOutRadius = cupOuterRadius + 32;
  const desiredOrbitInnerRadius = centerKeepOutRadius + 8;
  const desiredOrbitOuterRadius = desiredOrbitInnerRadius + 880;
  const orbitInnerRadius = Math.max(
    COFFEE_ORBIT_MIN_RADIUS,
    Math.min(desiredOrbitInnerRadius, maxVisibleOrbitRadius - 12),
  );
  const orbitOuterRadius = Math.max(
    orbitInnerRadius + 12,
    Math.min(desiredOrbitOuterRadius, maxVisibleOrbitRadius),
  );
  return { cx, cy, orbitInnerRadius, orbitOuterRadius };
}
