"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/** 与 iOS MusicHomeScreen 常量一致 */
const METEOR_COUNT = 4;
const STAR_COUNT = 28;
const FOCUS_ORB_CENTER_Y_RATIO = 0.382;

function pseudoRandom01(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function cubicInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function useViewportSize(active: boolean) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [animMs, setAnimMs] = useState(0);
  const animMsRef = useRef(0);
  const lastFrameRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const sync = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };
    sync();
    window.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("resize", sync);
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

  return { size, animMs };
}

function WorkBackdropPlanets({ active, visible }: { active: boolean; visible: boolean }) {
  const { size, animMs } = useViewportSize(active);
  if (!visible || size.width <= 0) return null;

  const cx = size.width * 0.5;
  const cy = size.height * FOCUS_ORB_CENTER_Y_RATIO;
  const mistCycleMs = 13600;
  const mistT = (animMs % mistCycleMs) / mistCycleMs;
  const mistHalf = mistT <= 0.5 ? mistT * 2 : (1 - mistT) * 2;
  const mistEased = cubicInOut(mistHalf);
  const mistOuterOpacity = 0.1 + mistEased * (0.24 - 0.1);
  const mistInnerOpacity = 0.26 - mistEased * (0.26 - 0.12);
  const orbitADeg = ((animMs % 72000) / 72000) * 360;
  const orbitBDeg = ((animMs % 32000) / 32000) * 360;

  return (
    <div className="music-home-work-planet-layer" aria-hidden>
      <span
        className="music-home-work-core-mist-outer"
        style={{ left: cx - 146, top: cy - 146, opacity: active ? mistOuterOpacity : 0.1 }}
      />
      <span
        className="music-home-work-core-mist-inner"
        style={{ left: cx - 118, top: cy - 118, opacity: active ? mistInnerOpacity : 0.26 }}
      />
      <span
        className="music-home-work-planet-orb music-home-work-planet-orb--core"
        style={{ left: cx - 88, top: cy - 88 }}
      />
      <span
        className="music-home-work-orbit-anchor"
        style={{ left: cx, top: cy, transform: `rotate(${orbitADeg}deg)` }}
      >
        <span
          className="music-home-work-planet-orb music-home-work-planet-orb--sat-a"
          style={{ transform: "rotate(18deg) translateX(176px)" }}
        />
      </span>
      <span
        className="music-home-work-orbit-anchor"
        style={{ left: cx, top: cy, transform: `rotate(${orbitBDeg}deg)` }}
      >
        <span
          className="music-home-work-planet-orb music-home-work-planet-orb--sat-b"
          style={{ transform: "rotate(-142deg) translateX(152px)" }}
        />
      </span>
    </div>
  );
}

type StarLayout = {
  x: number;
  y: number;
  size: number;
  baseOpacity: number;
  durationA: number;
  durationB: number;
  trailSpan: number;
  trailTilt: number;
  phase: number;
};

function buildStarLayouts(width: number, height: number): StarLayout[] {
  return Array.from({ length: STAR_COUNT }, (_, i) => ({
    x: width * (0.06 + pseudoRandom01(i * 13 + 1) * 0.88),
    y: height * (0.05 + pseudoRandom01(i * 17 + 2) * 0.5),
    size: 1.5 + pseudoRandom01(i * 23 + 3) * 2.2,
    baseOpacity: 0.22 + pseudoRandom01(i * 37 + 11) * 0.56,
    durationA: 2600 + Math.floor(pseudoRandom01(i * 29 + 3) * 3600),
    durationB: 2800 + Math.floor(pseudoRandom01(i * 31 + 7) * 3400),
    trailSpan: 1.8 + pseudoRandom01(i * 29 + 5) * 4.2,
    trailTilt: (pseudoRandom01(i * 31 + 7) - 0.5) * 0.8,
    phase: pseudoRandom01(i * 41 + 9) * 4000,
  }));
}

function starOpacityAt(star: StarLayout, animMs: number, active: boolean): number {
  if (!active) return star.baseOpacity;
  const cycle = star.durationA + star.durationB;
  const elapsed = ((animMs + star.phase) % cycle + cycle) % cycle;
  if (elapsed < star.durationA) {
    const t = elapsed / star.durationA;
    return star.baseOpacity + t * (0.78 - star.baseOpacity);
  }
  const t = (elapsed - star.durationA) / star.durationB;
  return 0.78 - t * (0.78 - star.baseOpacity);
}

function starTrailAt(star: StarLayout, opacity: number): { tx: number; ty: number } {
  const span = star.trailSpan;
  const tilt = star.trailTilt;
  if (opacity <= 0.22) return { tx: -span, ty: span * (0.24 + tilt) };
  if (opacity >= 0.78) return { tx: span, ty: span * (0.24 - tilt) };
  if (opacity <= 0.5) {
    const t = (opacity - 0.22) / (0.5 - 0.22);
    return {
      tx: -span + t * span,
      ty: span * (0.24 + tilt) - t * span * (0.24 + tilt + 0.18),
    };
  }
  const t = (opacity - 0.5) / (0.78 - 0.5);
  return {
    tx: t * span,
    ty: -span * 0.18 + t * span * (0.18 + 0.24 - tilt),
  };
}

type MeteorLayout = {
  startX: number;
  startY: number;
  driftX: number;
  driftY: number;
  scale: number;
  len: number;
  durationMs: number;
  phase: number;
};

function buildMeteorLayouts(width: number, height: number): MeteorLayout[] {
  return Array.from({ length: METEOR_COUNT }, (_, i) => ({
    startX: width * (0.1 + pseudoRandom01(i * 3 + 1) * 0.74),
    startY: height * (0.03 + pseudoRandom01(i * 5 + 2) * 0.1),
    driftX: -(44 + pseudoRandom01(i * 11 + 3) * 30),
    driftY: 14 + pseudoRandom01(i * 13 + 4) * 20,
    scale: 0.72 + pseudoRandom01(i * 19 + 5) * 0.85,
    len: 22 + pseudoRandom01(i * 23 + 6) * 22,
    durationMs: 15000 + Math.floor(pseudoRandom01(i * 43 + 7) * 9000),
    phase: pseudoRandom01(i * 47 + 11) * 12000,
  }));
}

function meteorStyleAt(meteor: MeteorLayout, animMs: number, active: boolean) {
  if (!active) return { opacity: 0, transform: "rotate(-32deg) scale(1)" };
  const elapsed = ((animMs + meteor.phase) % meteor.durationMs + meteor.durationMs) % meteor.durationMs;
  const t = elapsed / meteor.durationMs;
  let opacity = 0;
  if (t >= 0.1 && t <= 0.84) {
    if (t < 0.1 + 0.01) opacity = (t - 0.1) / 0.01 * 0.26;
    else if (t > 0.83) opacity = ((0.84 - t) / 0.01) * 0.22;
    else opacity = 0.26 - (t - 0.1) * (0.04 / 0.74);
  }
  const tx = t * meteor.driftX;
  const ty = t * meteor.driftY;
  return {
    opacity,
    transform: `translate(${tx}px, ${ty}px) rotate(-32deg) scale(${meteor.scale})`,
  };
}

function SleepBackdropSky({ active, visible }: { active: boolean; visible: boolean }) {
  const { size, animMs } = useViewportSize(active);
  const stars = useMemo(
    () => (size.width > 0 ? buildStarLayouts(size.width, size.height) : []),
    [size.height, size.width],
  );
  const meteors = useMemo(
    () => (size.width > 0 ? buildMeteorLayouts(size.width, size.height) : []),
    [size.height, size.width],
  );

  if (!visible || size.width <= 0) return null;

  return (
    <div className="music-home-sleep-sky-layer" aria-hidden>
      {stars.map((star, i) => {
        const opacity = starOpacityAt(star, animMs, active);
        const { tx, ty } = starTrailAt(star, opacity);
        return (
          <span
            key={`star-${i}`}
            className="music-home-sleep-star-dot"
            style={{
              left: star.x,
              top: star.y,
              width: star.size,
              height: star.size,
              opacity,
              transform: `translate(${tx}px, ${ty}px)`,
            }}
          />
        );
      })}
      <div className="music-home-sleep-meteor-layer">
        {meteors.map((meteor, i) => {
          const style = meteorStyleAt(meteor, animMs, active);
          return (
            <span
              key={`meteor-${i}`}
              className="music-home-sleep-meteor-streak"
              style={{
                width: meteor.len,
                left: meteor.startX,
                top: meteor.startY,
                opacity: style.opacity,
                transform: style.transform,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

type Props = {
  album: string;
  decorVisible?: boolean;
  decorActive?: boolean;
};

/** 对齐 iOS backdrop：专注工作行星、睡眠全屏星野 + 流星 */
export function MusicHomeBackdropScene({
  album,
  decorVisible = true,
  decorActive = false,
}: Props) {
  if (album === "专注工作") {
    return <WorkBackdropPlanets visible={decorVisible} active={decorActive} />;
  }
  if (album === "睡眠") {
    return <SleepBackdropSky visible={decorVisible} active={decorActive} />;
  }
  return null;
}
