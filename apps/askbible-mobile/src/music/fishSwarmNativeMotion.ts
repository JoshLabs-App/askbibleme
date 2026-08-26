import { useEffect } from "react";
import { Animated, Easing } from "react-native";
import { FISH_COUNT, pseudoRandom01 } from "./musicAlbumVisualConstants";

/**
 * 鱼群动画跑在 UI 线程，JS 每帧零开销。
 *
 * 关键是「共享时钟」：全场只有 8 个 Animated.Value，100 条鱼全部用 interpolate
 * 从它们派生。native driver 会把每个 timing 展开成 60fps 帧数组，所以
 * 「每条鱼各自一个长动画」会炸开（100 条 × 42 秒 ≈ 2.6MB）；共享之后总量约 100KB。
 *
 * 代价是每条鱼的周期必须量化成主周期的整数倍，否则循环接缝处会跳。
 */

const TAU = Math.PI * 2;

/** 轨道慢（约 19～168 秒一圈），只能用长周期换速度档位；一圈整数倍才能无缝循环 */
const ORBIT_PERIOD_MS = 168_000;
const ORBIT_HARMONICS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

const SHIMMER_PERIOD_MS = 8_400;
const SWIM_PERIODS_MS = [2600, 3120, 3640, 4160, 4680, 5200] as const;

/** 分段线性逼近正弦/三角波的采样数；振幅只有几像素，20 段的误差看不出来 */
const WAVE_STEPS = 20;
const WAVE_INPUT = Array.from({ length: WAVE_STEPS + 1 }, (_, s) => s / WAVE_STEPS);

function nearestIndex(target: number, candidates: readonly number[]): number {
  let best = 0;
  for (let i = 1; i < candidates.length; i++) {
    if (Math.abs(candidates[i] - target) < Math.abs(candidates[best] - target)) best = i;
  }
  return best;
}

const HARMONIC_PERIODS = ORBIT_HARMONICS.map((n) => ORBIT_PERIOD_MS / n);

/** 每条鱼与时间无关的参数，含量化后的周期档位；模块加载时算一次 */
const FISH_SEEDS = Array.from({ length: FISH_COUNT }, (_, i) => {
  const ring = Math.floor(i / 12);
  const slot = i % 12;
  const angleJitter = (pseudoRandom01(i * 19 + 7) - 0.5) * 44;
  const randomSpeed = 0.45 + pseudoRandom01(i * 41 + 9) * 1.7;
  const speedFactor = (0.7 + ring * 0.14) * randomSpeed * 0.58;
  const swimPeriodMs = 2600 + pseudoRandom01(i * 73 + 33) * 2600;

  return {
    // 原实现的 angle 与 orbitOffset 都是静态角度，合成一个基准角
    baseAngleDeg:
      slot * 30 + angleJitter + ring * 2.5 + pseudoRandom01(i * 67 + 21) * 360,
    radius: 132 + ring * 13.5 + pseudoRandom01(i * 23 + 11) * 20,
    size: 0.55 + pseudoRandom01(i * 31 + 17) * 0.68,
    opacity: 0.34 + pseudoRandom01(i * 37 + 3) * 0.28,
    // 原实现一圈耗时 42000/speedFactor，量化到最接近的谐波
    orbitHarmonic:
      ORBIT_HARMONICS[nearestIndex(42_000 / Math.max(speedFactor, 0.0001), HARMONIC_PERIODS)],
    shimmerOffset: i / Math.max(FISH_COUNT, 1),
    swimBucket: nearestIndex(swimPeriodMs, SWIM_PERIODS_MS),
    swimOffset: (i * 0.21) % 1,
    tangentialAmp: 1.6 + pseudoRandom01(i * 79 + 27) * 2.2,
    radialAmp: 1.6 + pseudoRandom01(i * 83 + 31) * 3.2,
    headingAmp: 1.2 + pseudoRandom01(i * 89 + 37) * 2.6,
  };
});

// 全场共享的时钟：1 条轨道 + 1 条闪烁 + 6 条摆尾
const orbitClock = new Animated.Value(0);
const shimmerClock = new Animated.Value(0);
const swimClocks = SWIM_PERIODS_MS.map(() => new Animated.Value(0));

/**
 * 采样一个周期为 1 的波形。c=0 与 c=1 落在同一相位，所以循环接缝无跳变。
 */
function sampleWave(offset: number, f: (u: number) => number): number[] {
  return WAVE_INPUT.map((c) => f((((c + offset) % 1) + 1) % 1));
}

/** 原实现的三角波：u≤0.5 从 at0 升到 atHalf，之后降回 at0 */
function triangle(u: number, at0: number, atHalf: number): number {
  return u <= 0.5
    ? at0 + (atHalf - at0) * (u * 2)
    : atHalf + (at0 - atHalf) * ((u - 0.5) * 2);
}

function buildFishMotion(seed: (typeof FISH_SEEDS)[number]) {
  const swim = swimClocks[seed.swimBucket];

  const swimY = swim.interpolate({
    inputRange: WAVE_INPUT,
    outputRange: sampleWave(seed.swimOffset, (u) => Math.sin(u * TAU) * seed.tangentialAmp),
  });
  const bobY = shimmerClock.interpolate({
    inputRange: WAVE_INPUT,
    outputRange: sampleWave(seed.shimmerOffset, (u) => triangle(u, -2.4, 2.4)),
  });

  return {
    seed,
    opacity: shimmerClock.interpolate({
      inputRange: WAVE_INPUT,
      outputRange: sampleWave(seed.shimmerOffset, (u) => seed.opacity * triangle(u, 0.88, 1)),
    }),
    translateX: swim.interpolate({
      inputRange: WAVE_INPUT,
      outputRange: sampleWave(
        seed.swimOffset,
        (u) => seed.radius + Math.cos(u * TAU) * seed.radialAmp,
      ),
    }),
    // 摆尾与闪烁周期不同，只能在原生侧相加
    translateY: Animated.add(swimY, bobY),
    headingDeg: swim.interpolate({
      inputRange: WAVE_INPUT,
      outputRange: sampleWave(
        seed.swimOffset,
        (u) => 90 + Math.sin(u * TAU) * seed.headingAmp,
      ).map((v) => `${v}deg`),
    }),
  };
}

export type FishSpriteMotion = ReturnType<typeof buildFishMotion>;

/** 按轨道谐波分组：同组共用一个 rotate 节点，省掉近百个 */
export const FISH_ORBIT_GROUPS = ORBIT_HARMONICS.map((harmonic) => ({
  harmonic,
  rotate: orbitClock.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", `${360 * harmonic}deg`],
  }),
  fish: FISH_SEEDS.filter((f) => f.orbitHarmonic === harmonic).map(buildFishMotion),
})).filter((group) => group.fish.length > 0);

function linearLoop(value: Animated.Value, duration: number) {
  return Animated.loop(
    Animated.timing(value, {
      toValue: 1,
      duration,
      easing: Easing.linear,
      useNativeDriver: true,
    }),
    { resetBeforeIteration: false },
  );
}

/** 只在装饰动画该动时跑；停下时把时钟归零 */
export function useFishSwarmClocks(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const loops = [
      linearLoop(orbitClock, ORBIT_PERIOD_MS),
      linearLoop(shimmerClock, SHIMMER_PERIOD_MS),
      ...swimClocks.map((value, i) => linearLoop(value, SWIM_PERIODS_MS[i])),
    ];
    loops.forEach((loop) => loop.start());
    return () => {
      loops.forEach((loop) => loop.stop());
      orbitClock.setValue(0);
      shimmerClock.setValue(0);
      swimClocks.forEach((value) => value.setValue(0));
    };
  }, [active]);
}
