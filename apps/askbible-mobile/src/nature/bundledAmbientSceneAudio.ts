import type { NatureAmbientSceneSlotId } from "./ambientSceneSlots";

export const BUNDLED_AMBIENT_SCENE_AUDIO: Partial<Record<NatureAmbientSceneSlotId, number>> = {
  "scene-fire": require("../../assets/audio/scenes/scene-campfire-forest-452486.mp3"),
  "scene-water": require("../../assets/audio/scenes/scene-water-lake-120.mp3"),
  "scene-rain": require("../../assets/audio/scenes/scene-rain-drops-roof-ofs.mp3"),
  "scene-waves": require("../../assets/audio/scenes/scene-waves-ocean.mp3"),
  "scene-thunder": require("../../assets/audio/scenes/scene-thunderstorm-28.mp3"),
  "scene-birds": require("../../assets/audio/scenes/scene-birds-forest-810419.mp3"),
  "scene-wind": require("../../assets/audio/scenes/scene-wind-hum-1177.mp3"),
  "scene-white-noise": require("../../assets/audio/scenes/scene-white-noise-41.mp3"),
  "scene-cafe": require("../../assets/audio/scenes/scene-cafe-120.mp3"),
};
