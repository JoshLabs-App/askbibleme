"use client";

import { useEffect, useRef } from "react";

function pseudoRandom01(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

type Props = { album: string };

/** 对齐 iOS backdrop：专注工作行星、睡眠全屏星野 + 流星 */
export function MusicHomeBackdropScene({ album }: Props) {
  const starsRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (album !== "睡眠") return;
    const canvas = starsRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const stars = Array.from({ length: 72 }, (_, i) => ({
      x: pseudoRandom01(i * 13 + 1),
      y: pseudoRandom01(i * 17 + 3) * 0.85,
      r: 0.5 + pseudoRandom01(i * 29 + 5) * 1.6,
      phase: pseudoRandom01(i * 31 + 7) * Math.PI * 2,
    }));

    let raf = 0;
    const draw = (t: number) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const twinkle = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t / 1100 + s.phase));
        ctx.fillStyle = `rgba(210, 228, 255, ${twinkle * 0.75})`;
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [album]);

  if (album === "专注工作") {
    return (
      <div className="music-home-backdrop-scene music-home-backdrop-scene--work" aria-hidden>
        <span className="music-home-work-mist music-home-work-mist--outer" />
        <span className="music-home-work-mist music-home-work-mist--inner" />
        <span className="music-home-work-planet music-home-work-planet--core" />
        <span className="music-home-work-orbit music-home-work-orbit--a">
          <span className="music-home-work-planet music-home-work-planet--sat-a" />
        </span>
        <span className="music-home-work-orbit music-home-work-orbit--b">
          <span className="music-home-work-planet music-home-work-planet--sat-b" />
        </span>
      </div>
    );
  }

  if (album === "睡眠") {
    return (
      <div className="music-home-backdrop-scene music-home-backdrop-scene--sleep" aria-hidden>
        <canvas ref={starsRef} className="music-home-backdrop-stars" />
        <span className="music-home-sleep-meteor music-home-sleep-meteor--a" />
        <span className="music-home-sleep-meteor music-home-sleep-meteor--b" />
        <span className="music-home-sleep-meteor music-home-sleep-meteor--c" />
      </div>
    );
  }

  return null;
}
