/**
 * Selah 音乐驱动视觉子系统（单一入口）。
 * audio → engine → visual state → CSS 变量；勿在 UI 里直接读 audio.currentTime 驱动动效。
 */
export * from "./types";
export * from "./tuning";
export * from "./engine";
export * from "./presets/atmosphere";
export * from "./presets/home-atmosphere";
export * from "./effects";
export { HomeAtmosphereVisualProvider } from "./providers/HomeAtmosphereVisualContext";
export { MusicShellAtmosphereOverrideProvider } from "./providers/MusicShellAtmosphereOverrideContext";
export { MusicShellVisualProvider } from "./providers/MusicShellVisualContext";
export { MusicVisualTuningProvider } from "./providers/MusicVisualTuningContext";
export { ApplyRepoVisualDefaults } from "./components/ApplyRepoVisualDefaults";
export {
  useHomeAtmosphereVisual,
  useHomeAtmosphereVisualOptional,
  useMusicShellAtmosphereOverride,
  useMusicShellAtmosphereOverrideOptional,
  useMusicShellVisual,
  useMusicVisualTuning,
  useResolvedHomeAtmospherePreset,
} from "./hooks";
