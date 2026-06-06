"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { MusicHomeAlbumIconGlyph } from "@/components/music/MusicHomeIcons";

/** 与 iOS MusicHomeScreen 常量一致 */
const FISH_COUNT = 100;
const COFFEE_BEAN_COUNT = 34;
const FOCUS_ORB_CENTER_Y_RATIO = 0.382;
const BREATH_RING_WRAP_HEIGHT = 190;
const BREATH_RING_WRAP_MARGIN_BOTTOM = 6;
const FISH_BASE_W = 40;
const FISH_BASE_H = 14;

function pseudoRandom01(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
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

function CoffeeBeanOrbit({ rhythmPulse, centered }: { rhythmPulse: number; centered?: boolean }) {
  return (
    <div
      className={[
        "music-home-coffee-bean-layer",
        centered ? "music-home-center-visual-landscape" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden
      style={{ "--coffee-rhythm": rhythmPulse } as CSSProperties}
    >
      {Array.from({ length: COFFEE_BEAN_COUNT }, (_, i) => {
        const ring = i % 10;
        const slot = Math.floor(i / 10);
        const angle = slot * 36 + ring * 4 + (pseudoRandom01(i * 5 + 1) - 0.5) * 8;
        const radius = 72 + ring * 14 + pseudoRandom01(i * 13 + 3) * 12;
        const duration = 24 + pseudoRandom01(i * 31 + 7) * 10;
        const delay = pseudoRandom01(i * 43 + 5) * -duration;
        const beanW = 10 + pseudoRandom01(i * 17 + 9) * 8;
        const isLight = i === 0 || i === 3 || i === 7;
        return (
          <span
            key={`bean-${i}`}
            className={[
              "music-home-coffee-bean",
              isLight ? "music-home-coffee-bean--light" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{
              ["--bean-angle" as string]: `${angle}deg`,
              ["--bean-radius" as string]: `${radius}px`,
              ["--bean-orbit-duration" as string]: `${duration}s`,
              ["--bean-orbit-delay" as string]: `${delay}s`,
              width: `${beanW}px`,
              height: `${beanW * 0.62}px`,
            }}
          />
        );
      })}
    </div>
  );
}

function SunOrb({ centered }: { centered?: boolean }) {
  return (
    <div
      className={[
        "music-home-sun-orb-wrap",
        centered ? "music-home-center-visual-landscape" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden
    >
      <span className="music-home-sun-orb-glow" />
      <MusicHomeAlbumIconGlyph kind="coffee" color="#fff7ef" className="music-home-sun-orb-cup" />
    </div>
  );
}

function SleepCrescentMoon({ centered }: { centered?: boolean }) {
  return (
    <div
      className={[
        "music-home-sleep-moon-wrap",
        centered ? "music-home-center-visual-landscape" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden
    >
      <Image
        src="/music/sleep-crescent-moon.png"
        alt=""
        width={154}
        height={154}
        className="music-home-sleep-moon-image"
        draggable={false}
      />
    </div>
  );
}

type Props = {
  album: string;
  centered?: boolean;
  rhythmPulse?: number;
};

/** 对齐 iOS upper 区：安静=鱼+呼吸环；下午茶=咖啡豆+杯；睡眠=月 */
export function MusicHomeVisuals({ album, centered = false, rhythmPulse = 0 }: Props) {
  if (album === "安静") {
    return <CalmVisual centered={centered} />;
  }
  if (album === "下午茶") {
    return (
      <>
        <CoffeeBeanOrbit rhythmPulse={rhythmPulse} centered={centered} />
        <SunOrb centered={centered} />
      </>
    );
  }
  if (album === "睡眠") {
    return <SleepCrescentMoon centered={centered} />;
  }
  return null;
}
