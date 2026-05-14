"use client";

import type { HomeAtmospherePresetId } from "@/lib/home/home-atmosphere";

type PresetClasses = {
  driftA: string;
  driftB: string;
  veil: string;
  sheen: string;
  grain: string;
  bokeh1: string;
  bokeh2: string;
};

/** 静态色与层次（无循环 keyframe）。 */
const CLASSES: Record<HomeAtmospherePresetId, PresetClasses> = {
  lagoon: { driftA: "", driftB: "", veil: "", sheen: "", grain: "", bokeh1: "", bokeh2: "" },
  parchment: { driftA: "", driftB: "", veil: "", sheen: "", grain: "", bokeh1: "", bokeh2: "" },
  dawn: { driftA: "", driftB: "", veil: "", sheen: "", grain: "", bokeh1: "", bokeh2: "" },
  dusk: { driftA: "", driftB: "", veil: "", sheen: "", grain: "", bokeh1: "", bokeh2: "" },
  mist: { driftA: "", driftB: "", veil: "", sheen: "", grain: "", bokeh1: "", bokeh2: "" },
  ember: { driftA: "", driftB: "", veil: "", sheen: "", grain: "", bokeh1: "", bokeh2: "" },
};

type PresetLayers = {
  rootBg: string;
  layerA: string;
  layerB: string;
  bokeh1: string;
  bokeh2: string;
  sheen: string;
  veil: string;
};

/** 与 `HomeAtmospherePresetId` / 后台「首页氛围」一致； former calm/ember/aurora 已并入 parchment/ember/dawn。 */
const LAYERS: Record<HomeAtmospherePresetId, PresetLayers> = {
  lagoon: {
    rootBg: "#143C60",
    layerA:
      "radial-gradient(ellipse 78% 64% at 32% 32%, rgba(125, 211, 252, 0.55) 0%, rgba(186, 230, 253, 0.35) 48%, transparent 72%)",
    layerB:
      "radial-gradient(ellipse 70% 58% at 72% 48%, rgba(165, 243, 252, 0.45) 0%, rgba(224, 242, 254, 0.4) 50%, transparent 74%)",
    bokeh1: "bg-sky-300/35",
    bokeh2: "bg-cyan-200/30",
    sheen:
      "radial-gradient(ellipse 58% 48% at 48% 28%, rgba(255, 255, 255, 0.55) 0%, rgba(224, 242, 254, 0.25) 42%, transparent 68%)",
    veil:
      "linear-gradient(165deg, rgba(255, 255, 255, 0.42) 0%, rgba(224, 242, 254, 0.22) 45%, rgba(186, 230, 253, 0.38) 100%)",
  },
  parchment: {
    rootBg: "#1f1a17",
    layerA:
      "radial-gradient(ellipse 70% 60% at 40% 35%, rgba(155, 112, 78, 0.45) 0%, rgba(72, 58, 44, 0.32) 50%, transparent 72%)",
    layerB:
      "radial-gradient(ellipse 65% 55% at 60% 40%, rgba(88, 78, 108, 0.36) 0%, rgba(42, 36, 48, 0.3) 50%, transparent 70%)",
    bokeh1: "bg-amber-200/20",
    bokeh2: "bg-orange-300/18",
    sheen:
      "radial-gradient(ellipse 55% 45% at 42% 38%, rgba(255, 205, 168, 0.32) 0%, rgba(240, 170, 130, 0.1) 40%, transparent 68%)",
    veil:
      "linear-gradient(165deg, rgba(105, 85, 65, 0.5) 0%, rgba(52, 44, 36, 0.6) 45%, rgba(26, 22, 18, 0.82) 100%)",
  },
  dawn: {
    rootBg: "#0f141c",
    layerA:
      "radial-gradient(ellipse 68% 58% at 32% 40%, rgba(72, 140, 160, 0.42) 0%, rgba(28, 52, 72, 0.38) 52%, transparent 74%)",
    layerB:
      "radial-gradient(ellipse 62% 52% at 68% 36%, rgba(98, 72, 148, 0.4) 0%, rgba(36, 28, 58, 0.36) 50%, transparent 72%)",
    bokeh1: "bg-cyan-300/22",
    bokeh2: "bg-indigo-400/20",
    sheen:
      "radial-gradient(ellipse 52% 42% at 48% 42%, rgba(180, 220, 255, 0.28) 0%, rgba(120, 160, 220, 0.12) 42%, transparent 70%)",
    veil:
      "linear-gradient(165deg, rgba(38, 58, 78, 0.55) 0%, rgba(22, 28, 42, 0.72) 48%, rgba(10, 12, 20, 0.9) 100%)",
  },
  dusk: {
    rootBg: "#06060a",
    layerA:
      "radial-gradient(ellipse 66% 56% at 38% 38%, rgba(99, 102, 241, 0.38) 0%, rgba(36, 28, 62, 0.42) 52%, transparent 74%)",
    layerB:
      "radial-gradient(ellipse 60% 50% at 72% 42%, rgba(168, 85, 247, 0.32) 0%, rgba(42, 24, 58, 0.4) 50%, transparent 72%)",
    bokeh1: "bg-violet-400/22",
    bokeh2: "bg-indigo-500/18",
    sheen:
      "radial-gradient(ellipse 54% 44% at 44% 40%, rgba(196, 181, 253, 0.22) 0%, rgba(109, 76, 204, 0.1) 42%, transparent 70%)",
    veil:
      "linear-gradient(165deg, rgba(22, 18, 38, 0.62) 0%, rgba(12, 10, 22, 0.82) 48%, rgba(4, 4, 10, 0.94) 100%)",
  },
  mist: {
    rootBg: "#070d10",
    layerA:
      "radial-gradient(ellipse 68% 58% at 28% 42%, rgba(45, 212, 191, 0.28) 0%, rgba(22, 48, 52, 0.44) 54%, transparent 74%)",
    layerB:
      "radial-gradient(ellipse 62% 52% at 74% 38%, rgba(148, 163, 184, 0.34) 0%, rgba(28, 38, 48, 0.42) 50%, transparent 72%)",
    bokeh1: "bg-teal-300/20",
    bokeh2: "bg-slate-400/18",
    sheen:
      "radial-gradient(ellipse 52% 42% at 50% 44%, rgba(167, 243, 208, 0.2) 0%, rgba(94, 234, 212, 0.1) 42%, transparent 70%)",
    veil:
      "linear-gradient(165deg, rgba(22, 38, 42, 0.58) 0%, rgba(14, 22, 28, 0.78) 48%, rgba(6, 10, 14, 0.92) 100%)",
  },
  ember: {
    rootBg: "#1f1a17",
    layerA:
      "radial-gradient(ellipse 70% 60% at 40% 35%, rgba(165, 118, 82, 0.52) 0%, rgba(80, 62, 48, 0.38) 50%, transparent 72%)",
    layerB:
      "radial-gradient(ellipse 65% 55% at 60% 40%, rgba(95, 82, 118, 0.45) 0%, rgba(45, 38, 52, 0.38) 50%, transparent 70%)",
    bokeh1: "bg-amber-200/25",
    bokeh2: "bg-orange-300/20",
    sheen:
      "radial-gradient(ellipse 55% 45% at 42% 38%, rgba(255, 210, 175, 0.4) 0%, rgba(255, 180, 140, 0.14) 40%, transparent 68%)",
    veil:
      "linear-gradient(165deg, rgba(110, 88, 68, 0.55) 0%, rgba(55, 46, 38, 0.65) 45%, rgba(28, 24, 20, 0.85) 100%)",
  },
};

type Props = {
  preset: HomeAtmospherePresetId;
};

export function AmbientBackdrop({ preset }: Props) {
  const c = CLASSES[preset];
  const L = LAYERS[preset];

  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 isolate min-h-full min-w-full overflow-hidden"
      style={{ backgroundColor: L.rootBg }}
    >
      <div
        className={`absolute -left-[20%] -top-[25%] h-[150%] w-[140%] rounded-full opacity-100 ${c.driftA}`}
        style={{ background: L.layerA }}
        aria-hidden
      />
      <div
        className={`absolute -right-[15%] bottom-[-30%] h-[130%] w-[130%] rounded-full opacity-100 ${c.driftB}`}
        style={{ background: L.layerB }}
        aria-hidden
      />
      <div
        className={`pointer-events-none absolute left-[8%] top-[28%] h-[min(42vw,14rem)] w-[min(42vw,14rem)] rounded-full blur-2xl ${L.bokeh1} ${c.bokeh1}`}
        aria-hidden
      />
      <div
        className={`pointer-events-none absolute bottom-[22%] right-[6%] h-[min(38vw,12rem)] w-[min(38vw,12rem)] rounded-full blur-2xl ${L.bokeh2} ${c.bokeh2}`}
        aria-hidden
      />
      <div
        className={`pointer-events-none absolute -left-[8%] top-[5%] h-[130%] w-[120%] rounded-full mix-blend-screen ${c.sheen}`}
        style={{ background: L.sheen }}
        aria-hidden
      />
      <div
        className={`absolute inset-0 opacity-90 ${c.veil}`}
        style={{ background: L.veil }}
        aria-hidden
      />
      <div
        className={`pointer-events-none absolute inset-0 opacity-[0.1] mix-blend-overlay ${c.grain}`}
        style={{
          backgroundImage:
            "repeating-radial-gradient(circle at 20% 30%, rgba(255,255,255,0.12) 0, rgba(255,255,255,0.12) 1px, transparent 1px, transparent 4px)",
        }}
        aria-hidden
      />
    </div>
  );
}
