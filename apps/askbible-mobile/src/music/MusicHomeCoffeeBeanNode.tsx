import { Animated, Image } from "react-native";
import { COFFEE_BEAN_SHAPE } from "./musicAlbumVisualConstants";
import { visualStyles } from "./musicAlbumVisualShared";
import { resolveCoffeeBeanNodeLayout } from "./coffeeBeanNodeLayout";
import { useCoffeeBeanNodeMotion } from "./useCoffeeBeanNodeMotion";
import type { CoffeeOrbitLayout } from "./coffeeOrbitLayout";

type Props = {
  index: number;
  bobV: Animated.Value;
  orbitV: Animated.Value;
  leaderOrbitV: Animated.Value;
  layout: CoffeeOrbitLayout;
  pulseV: Animated.Value;
};

export function MusicHomeCoffeeBeanNode({ index, bobV, orbitV, leaderOrbitV, layout, pulseV }: Props) {
  const node = resolveCoffeeBeanNodeLayout(index, layout);
  const motion = useCoffeeBeanNodeMotion(node, bobV, orbitV, leaderOrbitV, pulseV);

  return (
    <Animated.View
      style={[
        visualStyles.coffeeBean,
        {
          width: motion.beanW,
          height: motion.beanH,
          marginLeft: -motion.beanW / 2,
          marginTop: -motion.beanH / 2,
          opacity: motion.beanOpacity,
          transform: [
            { rotate: `${motion.angle}deg` },
            { rotate: motion.isFollower ? motion.orbitSpinFollower : motion.orbitSpin },
            { translateX: motion.radius },
            { translateX: motion.isFollower ? motion.followRadiusDrift : motion.mainRadiusDrift },
            { rotate: motion.isFollower ? motion.followOrbitWobble : motion.mainOrbitWobble },
            { translateX: motion.danceSwayX },
            { translateY: motion.pulseTranslateY },
            { translateY: motion.danceFloatY },
            { translateY: motion.bobY },
            { rotate: motion.danceRotate },
            { scale: motion.danceScale },
            { scale: motion.pulseScale },
          ],
        },
      ]}
    >
      <Image
        source={COFFEE_BEAN_SHAPE}
        style={[visualStyles.coffeeBeanImage, motion.reverseDark && visualStyles.coffeeBeanImageDark]}
        resizeMode="contain"
      />
    </Animated.View>
  );
}
