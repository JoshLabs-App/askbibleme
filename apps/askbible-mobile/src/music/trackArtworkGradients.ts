import type { MusicCompanionStore } from "./types";
import { resolveMusicLocalizedField } from "../i18n/site-copy";
import { DEFAULT_MUSIC_ALBUM, KNOWN_MUSIC_ALBUMS } from "./musicAlbumCatalog";
import type { BackgroundVisual } from "./types";

export const FALLBACK_GRADIENTS: readonly (readonly [string, string, string])[] = [
  ["#4a3f35", "#2a2420", "#141210"],
  ["#3d4a42", "#243028", "#121816"],
  ["#4a3d4a", "#2a2430", "#161418"],
  ["#3f4248", "#252830", "#121418"],
  ["#484035", "#2c2820", "#181610"],
  ["#3a4548", "#222c30", "#101618"],
] as const;

function firstTag(tags: string[]): string | null {
  for (const raw of tags) {
    const t = raw.trim();
    if (t) return t;
  }
  return null;
}

function albumFromRemark(remark: string): string | null {
  const trimmed = remark.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/专辑[:：]\s*([^\n;；。]+)/);
  if (m?.[1]) {
    const fromPrefix = m[1].trim();
    if (fromPrefix) return fromPrefix;
  }
  return null;
}

export function inferTrackAlbum(track: MusicCompanionStore["audioTracks"][number]): string {
  const tags = Array.isArray(track.tags) ? track.tags : [];
  for (const album of KNOWN_MUSIC_ALBUMS) {
    if (tags.includes(album)) return album;
  }
  if (tags.includes("工作")) return "专注工作";
  const customFromTag = firstTag(tags);
  if (customFromTag) return customFromTag;
  const remark = resolveMusicLocalizedField(track.remark).trim();
  if (remark.includes("专注工作") || remark.includes("工作")) return "专注工作";
  for (const album of KNOWN_MUSIC_ALBUMS) {
    if (remark.includes(album)) return album;
  }
  const customFromRemark = albumFromRemark(remark);
  if (customFromRemark) return customFromRemark;
  return DEFAULT_MUSIC_ALBUM;
}

function hashTrackId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function gradientColorsForTrackId(trackId: string): readonly [string, string, string] {
  return FALLBACK_GRADIENTS[hashTrackId(trackId) % FALLBACK_GRADIENTS.length]!;
}

export function colorsFromCssGradient(css: string | undefined): readonly [string, string, string] | null {
  if (!css?.trim()) return null;
  const hex = css.match(/#[0-9a-fA-F]{3,8}/g);
  if (!hex || hex.length < 2) return null;
  const a = hex[0]!;
  const b = hex[Math.min(1, hex.length - 1)]!;
  const c = hex[Math.min(hex.length - 1, 2)]!;
  return [a, b, c] as const;
}

export function visualForTrack(store: MusicCompanionStore, trackId: string): BackgroundVisual | null {
  const visuals = store.backgroundVisuals ?? [];
  if (!visuals.length) return null;
  const scene =
    store.scenes.find((s) => s.audioTrackId === trackId) ??
    store.scenes.find((s) => s.id === store.defaultSceneId);
  if (!scene?.backgroundVisualId) return visuals[0] ?? null;
  return visuals.find((v) => v.id === scene.backgroundVisualId) ?? visuals[0] ?? null;
}
