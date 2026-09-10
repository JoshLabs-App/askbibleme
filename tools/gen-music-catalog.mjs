#!/usr/bin/env node
/**
 * 从 RN 的 assets/content/music-companion.json 生成两端的音乐曲库（MusicCatalog.swift / .kt）。
 *
 * TS 侧是唯一数据源；这里把 RN 的 enrichPlaybackTracks + inferTrackAlbum + 公开过滤
 * （publicMusicStore：hidden !== true）压成一份静态表。两端从同一次生成出来，
 * 数据本身不会分叉；会分叉的是手写的 URL 解析与专辑规则，那部分由
 * tools/music-audio-check.mjs 三方对拍。
 *
 *   node tools/gen-music-catalog.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MOBILE = path.join(ROOT, "apps/askbible-mobile");
const store = JSON.parse(readFileSync(path.join(MOBILE, "assets/content/music-companion.json"), "utf8"));

// 与 musicAlbumCatalog.ts 的 KNOWN_MUSIC_ALBUMS 同序 —— 音乐页心境条就按这个顺序排
const KNOWN = ["安静", "下午茶", "赞美诗", "钢琴", "睡眠", "专注工作"];
const DEFAULT_ALBUM = "安静";

// 安装包内置的曲目 = assets/music/tracks 里实际存在的文件（与 bundled-music-tracks.ts 一致）
const bundledIds = new Set(
  readdirSync(path.join(MOBILE, "assets/music/tracks"))
    .filter((f) => f.endsWith(".mp3"))
    .map((f) => f.replace(/\.mp3$/, "")),
);

function localized(field, locale = "zh-CN") {
  if (field == null) return "";
  if (typeof field === "string") return field.trim();
  return (field[locale] || field.en || field["zh-CN"] || "").trim();
}

// 照抄 trackArtworkGradients.ts 的 inferTrackAlbum（去掉 remark 的自定义专辑分支：曲库里没有这种数据）
function inferAlbum(t) {
  const tags = Array.isArray(t.tags) ? t.tags : [];
  for (const a of KNOWN) if (tags.includes(a)) return a;
  if (tags.includes("工作")) return "专注工作";
  const first = tags.map((x) => String(x).trim()).find(Boolean);
  if (first) return first;
  const remark = localized(t.remark, "zh-CN");
  if (remark.includes("专注工作") || remark.includes("工作")) return "专注工作";
  for (const a of KNOWN) if (remark.includes(a)) return a;
  return DEFAULT_ALBUM;
}

const tracks = store.audioTracks
  .filter((t) => t.hidden !== true)
  .map((t) => ({
    id: t.id,
    title: localized(t.title, "zh-CN"),
    titleEn: localized(t.title, "en"),
    artist: localized(t.artist, "zh-CN"),
    album: inferAlbum(t),
    src: String(t.src || "").trim(),
    durationSec: typeof t.durationSec === "number" && t.durationSec > 0 ? Math.round(t.durationSec) : 0,
    bundled: bundledIds.has(t.id),
  }));

const esc = (s) => JSON.stringify(s);
const header = (lang) =>
  `// 由 tools/gen-music-catalog.mjs 从 apps/askbible-mobile/assets/content/music-companion.json 生成，勿手改。\n` +
  `// ${tracks.length} 首；内置 ${tracks.filter((t) => t.bundled).length} 首，其余经 R2 点播。${lang === "kt" ? "" : ""}\n`;

const swift = header("swift") + `
/// 一首曲子。字段对应 RN 版 PlaybackTrack 里原生真正用到的那几项。
struct MusicTrack: Identifiable, Hashable {
    let id: String
    /// zh-CN 优先，回落 en / 纯字符串（resolveMusicLocalizedField）
    let title: String
    let titleEn: String
    let artist: String
    /// 已归一化的专辑名（inferTrackAlbum）
    let album: String
    /// companion 原始 src：/music/uploads/… 或 https 直链
    let src: String
    let durationSec: Int
    /// 安装包内置（assets/music/tracks）
    let bundled: Bool
}

enum MusicCatalog {
    /// 与 RN KNOWN_MUSIC_ALBUMS 同序
    static let albums = [${KNOWN.map(esc).join(", ")}]
    static let defaultAlbum = ${esc(DEFAULT_ALBUM)}

    static let tracks: [MusicTrack] = [
${tracks.map((t) => `        MusicTrack(id: ${esc(t.id)}, title: ${esc(t.title)}, titleEn: ${esc(t.titleEn)}, artist: ${esc(t.artist)}, album: ${esc(t.album)}, src: ${esc(t.src)}, durationSec: ${t.durationSec}, bundled: ${t.bundled}),`).join("\n")}
    ]
}
`;

const kotlin = header("kt") + `package me.askbible.native_.data

/** 一首曲子。字段对应 RN 版 PlaybackTrack 里原生真正用到的那几项。 */
data class MusicTrack(
    val id: String,
    /** zh-CN 优先，回落 en / 纯字符串（resolveMusicLocalizedField） */
    val title: String,
    val titleEn: String,
    val artist: String,
    /** 已归一化的专辑名（inferTrackAlbum） */
    val album: String,
    /** companion 原始 src：/music/uploads/… 或 https 直链 */
    val src: String,
    val durationSec: Int,
    /** 安装包内置（assets/music） */
    val bundled: Boolean,
)

object MusicCatalog {
    /** 与 RN KNOWN_MUSIC_ALBUMS 同序 */
    val albums = listOf(${KNOWN.map(esc).join(", ")})
    const val DEFAULT_ALBUM = ${esc(DEFAULT_ALBUM)}

    val tracks: List<MusicTrack> = listOf(
${tracks.map((t) => `        MusicTrack(${esc(t.id)}, ${esc(t.title)}, ${esc(t.titleEn)}, ${esc(t.artist)}, ${esc(t.album)}, ${esc(t.src)}, ${t.durationSec}, ${t.bundled}),`).join("\n")}
    )
}
`;

writeFileSync(path.join(ROOT, "apps/askbible-ios/AskBible/Model/MusicCatalog.swift"), swift);
writeFileSync(path.join(ROOT, "apps/askbible-android/core/src/main/kotlin/me/askbible/native_/data/MusicCatalog.kt"), kotlin);
// 给对拍脚本用的中间产物
writeFileSync(path.join(ROOT, "tools/.music-catalog.json"), JSON.stringify(tracks));
const byAlbum = {};
for (const t of tracks) byAlbum[t.album] = (byAlbum[t.album] || 0) + 1;
console.log(`音乐曲库已生成：${tracks.length} 首，内置 ${tracks.filter((t) => t.bundled).length} 首；专辑分布 ${JSON.stringify(byAlbum)}`);
