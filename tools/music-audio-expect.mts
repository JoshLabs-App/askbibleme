// TS 侧期望值：直接调 RN 那份逻辑（tsx 跑），不另抄一遍。
// 由 tools/music-audio-check.mjs 调起，stdin 协议与两端 harness 相同。
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// RN 包不是 ESM（没有 "type":"module"），具名 import 会被 cjs 词法器漏检，用命名空间 import
import * as remoteNs from "../apps/askbible-mobile/src/media/musicAudioRemote";
import * as catalogNs from "../apps/askbible-mobile/src/music/musicAlbumCatalog";
// tsx 把 CJS 模块挂在 default 上，命名空间本身没有具名导出
const unwrap = (ns: any) => (ns && ns.default && typeof ns.default === "object" ? { ...ns.default, ...ns } : ns);
const remote: any = unwrap(remoteNs);
const catalog: any = unwrap(catalogNs);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let playback: any = null;
try {
  playback = unwrap(await import("../apps/askbible-mobile/src/music/musicAlbumPlayback"));
} catch (e: any) {
  console.error("WARN musicAlbumPlayback 导入失败，专辑规则只做 Swift↔Kotlin 对拍：" + String(e?.message ?? e).split("\n").slice(0, 3).join(" | "));
}

const lines = readFileSync(0, "utf8").split("\n");
if (lines[lines.length - 1] === "") lines.pop();
let cursor = 0;
const take = () => (cursor < lines.length ? lines[cursor++] : "");
const n = Number(take());
const srcs = Array.from({ length: n }, take);
const m = Number(take());
const raws = Array.from({ length: m }, take);

const gen = JSON.parse(readFileSync(path.join(ROOT, "tools/.music-catalog.json"), "utf8")) as Array<{
  id: string; title: string; artist: string; album: string; src: string; durationSec: number; bundled: boolean;
}>;
const tracks = gen.map((t) => ({
  id: t.id, title: t.title, artist: t.artist, album: t.album, src: t.src, catalogSrc: t.src,
  localReady: t.bundled, analysisSrc: null, artworkUri: null,
  gradientColors: ["#000", "#000", "#000"] as const,
  ...(t.durationSec > 0 ? { durationSec: t.durationSec } : {}),
}));

const albums = [...catalog.KNOWN_MUSIC_ALBUMS, "未知专辑"];
const out: any = {
  urls: srcs.map((src) => ({ src, url: remote.buildMusicAudioRemoteUrl(src) ?? null })),
  normalize: raws.map((raw) => ({ raw, album: catalog.normalizeMusicAlbumLabel(raw) })),
  catalog: {
    count: gen.length,
    bundled: gen.filter((t) => t.bundled).map((t) => t.id),
    albums: gen.reduce((acc: Record<string, number>, t) => ((acc[t.album] = (acc[t.album] || 0) + 1), acc), {}),
  },
};
if (playback) {
  out.rules = albums.map((album) => ({
    album,
    repeatMode: playback.defaultRepeatModeForAlbum(album) ?? null,
    gain: playback.defaultMusicGainForAlbum(album),
    sleepFrom0: playback.resolveSleepTimerOnAlbumSwitch(album, 0) ?? null,
    sleepFrom30: playback.resolveSleepTimerOnAlbumSwitch(album, 30) ?? null,
    short: catalog.musicAlbumShortLabel(album),
  }));
  const starts: any[] = [];
  for (const album of catalog.KNOWN_MUSIC_ALBUMS) {
    const pick = (from: number) => {
      const idx = playback.pickAlbumStartTrackIndex(tracks, album, from);
      starts.push({ album, from, startId: idx == null ? null : tracks[idx].id });
    };
    pick(-1);
    let last = -1;
    tracks.forEach((t, i) => { if (t.album === album) last = i; });
    if (last >= 0) pick(last);
  }
  out.starts = starts;
}
process.stdout.write(JSON.stringify(out));
