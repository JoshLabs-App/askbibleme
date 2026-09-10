import Foundation

// 音乐音源 / 专辑规则对拍 harness。stdin 协议：N、N 行 src；M、M 行专辑别名。
// 输出一份 JSON，交给 tools/music-audio-check.mjs 与 Kotlin / TS 两端比对。
let input = String(data: FileHandle.standardInput.readDataToEndOfFile(), encoding: .utf8) ?? ""
var lines = input.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
if lines.last == "" { lines.removeLast() }
var cursor = 0
func take() -> String { defer { cursor += 1 }; return cursor < lines.count ? lines[cursor] : "" }
let n = Int(take()) ?? 0
let srcs = (0..<n).map { _ in take() }
let m = Int(take()) ?? 0
let raws = (0..<m).map { _ in take() }

struct UrlRow: Encodable { let src: String; let url: String? }
struct NormRow: Encodable { let raw: String; let album: String }
struct RuleRow: Encodable {
    let album: String; let repeatMode: String?; let gain: Float
    let sleepFrom0: Int?; let sleepFrom30: Int?; let short: String
}
struct StartRow: Encodable { let album: String; let from: Int; let startId: String? }
struct CatalogRow: Encodable { let count: Int; let bundled: [String]; let albums: [String: Int] }
struct Out: Encodable {
    let urls: [UrlRow]; let normalize: [NormRow]; let rules: [RuleRow]; let starts: [StartRow]; let catalog: CatalogRow
}

let tracks = MusicCatalog.tracks
let albumsToRule = MusicCatalog.albums + ["未知专辑"]
var starts: [StartRow] = []
for a in MusicCatalog.albums {
    starts.append(StartRow(album: a, from: -1, startId: MusicAlbumRules.startIndex(tracks, album: a, current: -1).map { tracks[$0].id }))
    // 当前曲已在该专辑（取专辑最后一首）→ 不动
    if let last = tracks.indices.last(where: { tracks[$0].album == a }) {
        starts.append(StartRow(album: a, from: last, startId: MusicAlbumRules.startIndex(tracks, album: a, current: last).map { tracks[$0].id }))
    }
}
var byAlbum: [String: Int] = [:]
for t in tracks { byAlbum[t.album, default: 0] += 1 }

let out = Out(
    urls: srcs.map { UrlRow(src: $0, url: MusicAudioSource.remoteURL($0)?.absoluteString) },
    normalize: raws.map { NormRow(raw: $0, album: MusicAlbumRules.normalize($0)) },
    rules: albumsToRule.map { a in
        RuleRow(album: a, repeatMode: MusicAlbumRules.defaultRepeatMode(a)?.rawValue, gain: MusicAlbumRules.defaultGain(a),
                sleepFrom0: MusicAlbumRules.sleepTimerOnSwitch(to: a, currentMinutes: 0),
                sleepFrom30: MusicAlbumRules.sleepTimerOnSwitch(to: a, currentMinutes: 30),
                short: MusicAlbumRules.shortLabel(a))
    },
    starts: starts,
    catalog: CatalogRow(count: tracks.count, bundled: tracks.filter { $0.bundled }.map { $0.id }, albums: byAlbum)
)
let enc = JSONEncoder()
enc.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
FileHandle.standardOutput.write(try enc.encode(out))
