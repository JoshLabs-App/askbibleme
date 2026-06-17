import { View } from "react-native";
import { COFFEE_BEAN_COUNT, WHITE_COFFEE_BEAN_INDEX } from "./musicAlbumVisualConstants";
import { visualStyles } from "./musicAlbumVisualShared";
import { resolveCoffeeOrbitLayout } from "./coffeeOrbitLayout";
import { MusicHomeCoffeeBeanNode } from "./MusicHomeCoffeeBeanNode";
import { useCoffeeBeanOrbitMotion } from "./useCoffeeBeanOrbitMotion";

type Props = {
  active: boolean;
  visible: boolean;
  width: number;
  height: number;
  viewportHeight: number;
  viewportTop?: number;
  centered?: boolean;
  rhythmPulse?: number;
};

export function CoffeeBeanOrbit({
  active,
  visible,
  width,
  height,
  viewportHeight,
  viewportTop = 0,
  centered = false,
  rhythmPulse = 0,
}: Props) {
  const { orbitValuesRef, bobValuesRef } = useCoffeeBeanOrbitMotion(active);

  if (!visible) return null;

  const layout = resolveCoffeeOrbitLayout({ width, height, viewportHeight, viewportTop, centered });
  const leaderOrbitV = orbitValuesRef[WHITE_COFFEE_BEAN_INDEX]!;

  return (
    <View pointerEvents="none" style={visualStyles.coffeeBeanLayer}>
      <View style={[visualStyles.coffeeOrbitGroup, { left: layout.cx, top: layout.cy }]}>
        {bobValuesRef.map((_, i) => (
          <MusicHomeCoffeeBeanNode
            key={`coffee-bean-${i}`}
            index={i}
            bobV={bobValuesRef[i]!}
            orbitV={orbitValuesRef[i]!}
            leaderOrbitV={leaderOrbitV}
            layout={layout}
            rhythmPulse={rhythmPulse}
          />
        ))}
      </View>
    </View>
  );
}
