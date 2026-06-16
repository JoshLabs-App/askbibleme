"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MusicHomeAlbumIconGlyph } from "@/components/music/MusicHomeIcons";

/** 与 iOS MusicHomeScreen 常量一致 */
const FISH_COUNT = 100;
const COFFEE_BEAN_COUNT = 34;
const WHITE_COFFEE_BEAN_INDEX = 0;
const FOLLOW_WHITE_COFFEE_BEAN_INDICES = [1, 2, 3] as const;
const COFFEE_CUP_ICON_SIZE = 88;
const COFFEE_ORBIT_VISIBLE_PADDING = 4;
const COFFEE_ORBIT_MIN_RADIUS = 34;
const FOCUS_ORB_CENTER_Y_RATIO = 0.382;
const BREATH_RING_WRAP_HEIGHT = 190;
const BREATH_RING_WRAP_MARGIN_BOTTOM = 6;
const FISH_BASE_W = 40;
const FISH_BASE_H = 14;

function pseudoRandom01(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** 咖啡豆专用 PRNG — 与 iOS 完全一致（无 +78.233） */
function coffeePseudoRandom01(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function musicVisualCenterY(
  containerHeight: number,
  centered: boolean,
  viewportHeight: number,
  viewportTop: number,
): number {
  if (centered) return containerHeight / 2;
  const focusCenterYOnScreen = viewportHeight * FOCUS_ORB_CENTER_Y_RATIO;
  return focusCenterYOnScreen - viewportTop;
}

function cubicInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function interpolateCurve(t: number, inputRange: readonly number[], outputRange: readonly number[]): number {
  if (t <= inputRange[0]!) return outputRange[0]!;
  if (t >= inputRange[inputRange.length - 1]!) return outputRange[outputRange.length - 1]!;
  for (let k = 0; k < inputRange.length - 1; k += 1) {
    const a = inputRange[k]!;
    const b = inputRange[k + 1]!;
    if (t >= a && t <= b) {
      const p = (t - a) / (b - a);
      return outputRange[k]! + p * (outputRange[k + 1]! - outputRange[k]!);
    }
  }
  return outputRange[outputRange.length - 1]!;
}

function bobPhase01(animMs: number, delayMs: number, halfMs: number): number {
  const cycle = delayMs + halfMs * 2;
  const elapsed = ((animMs % cycle) + cycle) % cycle;
  if (elapsed < delayMs) return 0;
  const bobElapsed = elapsed - delayMs;
  if (bobElapsed < halfMs) return bobElapsed / halfMs;
  return 1 - (bobElapsed - halfMs) / halfMs;
}

function orbitPhase01(animMs: number, durationMs: number): number {
  return ((animMs % durationMs) + durationMs) % durationMs / durationMs;
}

type CoffeeOrbitRadii = {
  inner: number;
  outer: number;
};

function computeCoffeeOrbitRadii(
  width: number,
  height: number,
  viewportHeight: number,
  viewportTop: number,
  centered: boolean,
): CoffeeOrbitRadii {
  const cx = width * 0.5;
  const cy = musicVisualCenterY(height, centered, viewportHeight, viewportTop);
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
  const inner = Math.max(
    COFFEE_ORBIT_MIN_RADIUS,
    Math.min(desiredOrbitInnerRadius, maxVisibleOrbitRadius - 12),
  );
  const outer = Math.max(inner + 12, Math.min(desiredOrbitOuterRadius, maxVisibleOrbitRadius));
  return { inner, outer };
}

type CoffeeBeanLayout = {
  i: number;
  reverseDark: boolean;
  isFollower: boolean;
  followIndex: number;
  direction: number;
  angle: number;
  radius: number;
  beanW: number;
  beanH: number;
  orbitPhaseDeg: number;
  leaderOrbitBaseDeg: number;
  leaderPhaseLag: number;
  orbitDurationMs: number;
  bobDelayMs: number;
  bobHalfMs: number;
  beanOpacity: number;
};

function buildCoffeeBeanLayouts(radii: CoffeeOrbitRadii): CoffeeBeanLayout[] {
  const { inner: orbitInnerRadius, outer: orbitOuterRadius } = radii;
  const leaderAngleBase = (coffeePseudoRandom01(WHITE_COFFEE_BEAN_INDEX * 5 + 1) - 0.5) * 8;
  const leaderTrackRadius = orbitOuterRadius - 2;
  const leaderRadius =
    leaderTrackRadius + (coffeePseudoRandom01(WHITE_COFFEE_BEAN_INDEX * 13 + 3) - 0.5) * 4;
  const leaderOrbitBaseDeg = coffeePseudoRandom01(WHITE_COFFEE_BEAN_INDEX * 61 + 21) * 360;
  const ringCount = 10;

  return Array.from({ length: COFFEE_BEAN_COUNT }, (_, i) => {
    const reverseDark = i === WHITE_COFFEE_BEAN_INDEX;
    const followIndex = FOLLOW_WHITE_COFFEE_BEAN_INDICES.indexOf(
      i as (typeof FOLLOW_WHITE_COFFEE_BEAN_INDICES)[number],
    );
    const isFollower = followIndex >= 0;
    const direction = reverseDark || isFollower ? -1 : 1;
    const ring = i % ringCount;
    const slotsPerRing = Math.ceil(COFFEE_BEAN_COUNT / ringCount);
    const slot = Math.floor(i / ringCount);
    const angleBase = slot * (360 / slotsPerRing) + ring * 4;
    const followGap = 10 + coffeePseudoRandom01(i * 71 + 4) * 2;
    const angle = isFollower
      ? leaderAngleBase + (followIndex + 1) * (followGap * 0.36)
      : angleBase + (coffeePseudoRandom01(i * 5 + 1) - 0.5) * 4;
    const ringRatio = ringCount <= 1 ? 0 : ring / (ringCount - 1);
    const radiusBase = orbitInnerRadius + (orbitOuterRadius - orbitInnerRadius) * ringRatio;
    const radius = reverseDark
      ? leaderRadius
      : isFollower
        ? leaderRadius + followIndex * 2 + (coffeePseudoRandom01(i * 79 + 6) - 0.5) * 2
        : radiusBase + coffeePseudoRandom01(i * 13 + 3) * 18;
    const beanW = 20 + coffeePseudoRandom01(i * 17 + 9) * 18;
    const beanH = beanW * (0.56 + coffeePseudoRandom01(i * 13 + 5) * 0.2);
    const isLeader = i === WHITE_COFFEE_BEAN_INDEX;
    const baseDuration = isLeader ? 24500 : isFollower ? 27200 : 29400;
    const jitter = Math.floor(coffeePseudoRandom01(i * 31 + 7) * 9000);
    const orbitDurationMs = baseDuration + jitter;
    const bobDelayMs = 120 + Math.floor(coffeePseudoRandom01(i * 53 + 11) * 1200);
    const bobHalfMs = 5200 + Math.floor(coffeePseudoRandom01(i * 43 + 5) * 2800);
    const mainBeanOpacity = 0.22 + coffeePseudoRandom01(i * 97 + 13) * 0.18;
    const beanOpacity = reverseDark ? 0.62 : mainBeanOpacity;
    const leaderPhaseLag = isFollower ? 16 + followIndex * 12 : 0;

    return {
      i,
      reverseDark,
      isFollower,
      followIndex,
      direction,
      angle,
      radius,
      beanW,
      beanH,
      orbitPhaseDeg: coffeePseudoRandom01(i * 61 + 21) * 360,
      leaderOrbitBaseDeg,
      leaderPhaseLag,
      orbitDurationMs,
      bobDelayMs,
      bobHalfMs,
      beanOpacity,
    };
  });
}

function coffeeBeanTransform(
  bean: CoffeeBeanLayout,
  animMs: number,
  leaderOrbitV: number,
  rhythmPulse: number,
): string {
  const bobV = bobPhase01(animMs, bean.bobDelayMs, bean.bobHalfMs);
  const orbitV = bean.isFollower ? leaderOrbitV : orbitPhase01(animMs, bean.orbitDurationMs);

  const orbitSpinDeg = bean.isFollower
    ? bean.leaderOrbitBaseDeg + bean.leaderPhaseLag + orbitV * bean.direction * 360
    : bean.orbitPhaseDeg + orbitV * bean.direction * 360;

  const bobY = interpolateCurve(bobV, [0, 0.25, 0.5, 0.75, 1], [-14, -2, 16, 3, -14]);
  const danceSwayX = interpolateCurve(bobV, [0, 0.25, 0.5, 0.75, 1], [-6, 3, 8, -2, -6]);
  const danceFloatY = interpolateCurve(bobV, [0, 0.25, 0.5, 0.75, 1], [0, -3, 4, -2, 0]);
  const danceRotate = interpolateCurve(bobV, [0, 0.25, 0.5, 0.75, 1], [-16, -4, 18, 6, -16]);
  const danceScale = interpolateCurve(bobV, [0, 0.25, 0.5, 0.75, 1], [0.86, 0.98, 1.16, 1.02, 0.86]);

  const orbitWobble = bean.isFollower
    ? interpolateCurve(bobV, [0, 0.5, 1], [-3, 4, -3])
    : interpolateCurve(bobV, [0, 0.25, 0.5, 0.75, 1], [-3, -1, 4, 1, -3]);
  const radiusDrift = bean.isFollower
    ? interpolateCurve(bobV, [0, 0.5, 1], [0, 12, 0])
    : interpolateCurve(bobV, [0, 0.25, 0.5, 0.75, 1], [0, 2, 14, 6, 0]);

  const pulseLift = rhythmPulse * (bean.isFollower ? 0.35 : 1);
  const pulseScale = 1 + rhythmPulse * (bean.isFollower ? 0.06 : 0.1);

  return [
    `rotate(${bean.angle}deg)`,
    `rotate(${orbitSpinDeg}deg)`,
    `translateX(${bean.radius}px)`,
    `translateX(${radiusDrift}px)`,
    `rotate(${orbitWobble}deg)`,
    `translateX(${danceSwayX}px)`,
    `translateY(${-pulseLift}px)`,
    `translateY(${danceFloatY}px)`,
    `translateY(${bobY}px)`,
    `rotate(${danceRotate}deg)`,
    `scale(${danceScale * pulseScale})`,
  ].join(" ");
}

function CalmVisual({ centered = false }: { centered?: boolean }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [viewport, setViewport] = useState({ height: 0, top: 0 });
  const [motionMs, setMotionMs] = useState(0);

  useEffect(() => {
    const sync = () => {
      const el = stageRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
      setViewport({ height: window.innerHeight, top: rect.top });
    };
    sync();
    const ro = new ResizeObserver(sync);
    if (stageRef.current) ro.observe(stageRef.current);
    window.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("resize", sync);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("resize", sync);
    };
  }, []);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => setMotionMs(Date.now() - startedAt), 33);
    return () => window.clearInterval(timer);
  }, []);

  const cx = size.width * 0.5;
  const cy = musicVisualCenterY(size.height, centered, viewport.height, viewport.top);
  const baseY = size.height - (BREATH_RING_WRAP_MARGIN_BOTTOM + BREATH_RING_WRAP_HEIGHT / 2);
  const targetY = musicVisualCenterY(size.height, centered, viewport.height, viewport.top);
  const ringTranslateY = centered ? 0 : targetY - baseY;

  const orbitTurns = motionMs / 42000;
  const shimmerPhase = (motionMs % 8200) / 8200;

  return (
    <div ref={stageRef} className="music-home-calm-stage" aria-hidden>
      {size.width > 0 ? (
        <div className="music-home-fish-layer">
          <div className="music-home-fish-orbit-group" style={{ left: cx, top: cy }}>
            {Array.from({ length: FISH_COUNT }, (_, i) => {
              const ring = Math.floor(i / 12);
              const slot = i % 12;
              const angleBase = slot * 30;
              const angleJitter = (pseudoRandom01(i * 19 + 7) - 0.5) * 44;
              const angle = angleBase + angleJitter + ring * 2.5;
              const radiusBase = 132 + ring * 13.5;
              const radiusJitter = pseudoRandom01(i * 23 + 11) * 20;
              const radius = radiusBase + radiusJitter;
              const sizeScale = 0.55 + pseudoRandom01(i * 31 + 17) * 0.68;
              const opacity = 0.34 + pseudoRandom01(i * 37 + 3) * 0.28;
              const ringSpeedBoost = 0.7 + ring * 0.14;
              const randomSpeed = 0.45 + pseudoRandom01(i * 41 + 9) * 1.7;
              const speedFactor = ringSpeedBoost * randomSpeed * 0.58;
              const orbitOffset = pseudoRandom01(i * 67 + 21) * 360;
              const fishOrbitAngle = orbitTurns * 360 * speedFactor + orbitOffset;
              const localShimmer = (shimmerPhase + i / FISH_COUNT) % 1;
              const shimmerOpacityFactor =
                localShimmer <= 0.5 ? 0.88 + localShimmer * 0.24 : 1 - (localShimmer - 0.5) * 0.24;
              const bobY =
                localShimmer <= 0.5 ? -2.4 + localShimmer * 9.6 : 2.4 - (localShimmer - 0.5) * 9.6;
              const swimPhase =
                (motionMs / (2600 + pseudoRandom01(i * 73 + 33) * 2600) + i * 0.21) % 1;
              const swimWave = Math.sin(swimPhase * Math.PI * 2);
              const tangentialSway = swimWave * (1.6 + pseudoRandom01(i * 79 + 27) * 2.2);
              const radialSway =
                Math.cos(swimPhase * Math.PI * 2) * (1.6 + pseudoRandom01(i * 83 + 31) * 3.2);
              const headingWiggle = swimWave * (1.2 + pseudoRandom01(i * 89 + 37) * 2.6);

              return (
                <div
                  key={`fish-${i}`}
                  className="music-home-fish-orbit-node"
                  style={{
                    opacity: opacity * shimmerOpacityFactor,
                    transform: `rotate(${angle + fishOrbitAngle}deg) translateX(${radius + radialSway}px) translateY(${tangentialSway + bobY}px) rotate(${headingWiggle + 90}deg) scale(${sizeScale})`,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/music/fish-shape.png"
                    alt=""
                    width={FISH_BASE_W}
                    height={FISH_BASE_H}
                    className="music-home-fish-image"
                    draggable={false}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div
        className={[
          "music-home-breath-ring-wrap",
          centered ? "music-home-center-visual-landscape" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={ringTranslateY !== 0 ? { transform: `translateY(${ringTranslateY}px)` } : undefined}
      >
        <span className="music-home-breath-glow" />
        <span className="music-home-breath-circle" />
      </div>
    </div>
  );
}

function CoffeeVisual({
  centered = false,
  rhythmPulse = 0,
  active = false,
}: {
  centered?: boolean;
  rhythmPulse?: number;
  active?: boolean;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [viewport, setViewport] = useState({ height: 0, top: 0 });
  const [animMs, setAnimMs] = useState(0);
  const animMsRef = useRef(0);
  const rafRef = useRef(0);
  const lastFrameRef = useRef(0);

  useEffect(() => {
    const sync = () => {
      const el = stageRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
      setViewport({ height: window.innerHeight, top: rect.top });
    };
    sync();
    const ro = new ResizeObserver(sync);
    if (stageRef.current) ro.observe(stageRef.current);
    window.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("scroll", sync);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("scroll", sync);
    };
  }, []);

  useEffect(() => {
    const tick = (now: number) => {
      if (lastFrameRef.current > 0 && active) {
        animMsRef.current += now - lastFrameRef.current;
        setAnimMs(animMsRef.current);
      }
      lastFrameRef.current = now;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active]);

  const orbitRadii = useMemo(
    () =>
      size.width > 0
        ? computeCoffeeOrbitRadii(size.width, size.height, viewport.height, viewport.top, centered)
        : { inner: COFFEE_ORBIT_MIN_RADIUS, outer: COFFEE_ORBIT_MIN_RADIUS + 12 },
    [centered, size.height, size.width, viewport.height, viewport.top],
  );

  const beanLayouts = useMemo(() => buildCoffeeBeanLayouts(orbitRadii), [orbitRadii]);

  const cx = size.width * 0.5;
  const cy = musicVisualCenterY(size.height, centered, viewport.height, viewport.top);
  const baseY = size.height - (BREATH_RING_WRAP_MARGIN_BOTTOM + BREATH_RING_WRAP_HEIGHT / 2);
  const targetY = musicVisualCenterY(size.height, centered, viewport.height, viewport.top);
  const coffeeTranslateY = centered ? 0 : targetY - baseY;

  const leaderLayout = beanLayouts[WHITE_COFFEE_BEAN_INDEX];
  const leaderOrbitV = leaderLayout ? orbitPhase01(animMs, leaderLayout.orbitDurationMs) : 0;

  const glowCycleMs = 10400;
  const glowT = (animMs % glowCycleMs) / glowCycleMs;
  const glowHalf = glowT <= 0.5 ? glowT * 2 : (1 - glowT) * 2;
  const cupGlowOpacity = 0.16 + cubicInOut(glowHalf) * (0.34 - 0.16);

  return (
    <div ref={stageRef} className="music-home-coffee-stage" aria-hidden>
      {size.width > 0 ? (
        <div className="music-home-coffee-bean-layer">
          <div className="music-home-coffee-orbit-group" style={{ left: cx, top: cy }}>
            {beanLayouts.map((bean) => (
              <div
                key={`coffee-bean-${bean.i}`}
                className="music-home-coffee-bean"
                style={{
                  width: bean.beanW,
                  height: bean.beanH,
                  marginLeft: -bean.beanW / 2,
                  marginTop: -bean.beanH / 2,
                  opacity: bean.beanOpacity,
                  transform: coffeeBeanTransform(bean, animMs, leaderOrbitV, rhythmPulse),
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/music/coffee-bean-shape.png"
                  alt=""
                  className={[
                    "music-home-coffee-bean-image",
                    bean.reverseDark ? "music-home-coffee-bean-image--light" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  draggable={false}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div
        className={[
          "music-home-coffee-wrap",
          centered ? "music-home-center-visual-landscape" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={coffeeTranslateY !== 0 ? { transform: `translateY(${coffeeTranslateY}px)` } : undefined}
      >
        <span className="music-home-coffee-glow" style={{ opacity: active ? cupGlowOpacity : 0.16 }} />
        <MusicHomeAlbumIconGlyph
          kind="coffee"
          color="#fff7ef"
          className="music-home-coffee-cup-icon"
        />
      </div>
    </div>
  );
}

function SleepVisual({ centered, active }: { centered?: boolean; active?: boolean }) {
  const [animMs, setAnimMs] = useState(0);
  const animMsRef = useRef(0);
  const lastFrameRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const tick = (now: number) => {
      if (lastFrameRef.current > 0 && active) {
        animMsRef.current += now - lastFrameRef.current;
        setAnimMs(animMsRef.current);
      }
      lastFrameRef.current = now;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active]);

  const moonCycleMs = 14400;
  const moonT = (animMs % moonCycleMs) / moonCycleMs;
  const moonHalf = moonT <= 0.5 ? moonT * 2 : (1 - moonT) * 2;
  const moonOpacity = active ? 0.42 + cubicInOut(moonHalf) * (0.78 - 0.42) : 0.42;

  return (
    <div className="music-home-sleep-stage" aria-hidden>
      <div
        className={[
          "music-home-sleep-moon-wrap",
          centered ? "music-home-center-visual-landscape" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/music/sleep-crescent-moon.png"
          alt=""
          width={86}
          height={86}
          className="music-home-sleep-moon-image"
          style={{ opacity: moonOpacity }}
          draggable={false}
        />
      </div>
    </div>
  );
}

type Props = {
  album: string;
  centered?: boolean;
  rhythmPulse?: number;
  /** 对齐 iOS albumDecorVisible */
  decorVisible?: boolean;
  /** 对齐 iOS albumDecorMotionActive（不含 isFocused；Web 音乐页恒为 focused） */
  decorActive?: boolean;
};

/** 对齐 iOS upper 区：安静=鱼+呼吸环；下午茶=咖啡豆+杯；睡眠=月 */
export function MusicHomeVisuals({
  album,
  centered = false,
  rhythmPulse = 0,
  decorVisible = true,
  decorActive = false,
}: Props) {
  if (!decorVisible) return null;

  if (album === "安静") {
    return <CalmVisual centered={centered} />;
  }
  if (album === "下午茶") {
    return <CoffeeVisual centered={centered} rhythmPulse={rhythmPulse} active={decorActive} />;
  }
  if (album === "睡眠") {
    return <SleepVisual centered={centered} active={decorActive} />;
  }
  return null;
}
