import Foundation

// 金句音源 / 选句算法对拍 harness。stdin 协议（行）：
//   K、K 行经文键；E、E 行 "verseKey weight"；R、R 行 rng；N、N 行 now(ms)
// 输出 {paths, picks, memory}，交给 tools/golden-verse-check.mjs 与 Kotlin / TS 比对。
let input = String(data: FileHandle.standardInput.readDataToEndOfFile(), encoding: .utf8) ?? ""
var lines = input.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
if lines.last == "" { lines.removeLast() }
var cursor = 0
func take() -> String { defer { cursor += 1 }; return cursor < lines.count ? lines[cursor] : "" }
let k = Int(take()) ?? 0
let keys = (0..<k).map { _ in take() }
let e = Int(take()) ?? 0
let entries: [HomeVerseEntry] = (0..<e).map { _ in
    let parts = take().split(separator: " ")
    return HomeVerseEntry(verseKey: String(parts[0]), weight: Int(parts[1]) ?? 1)
}
let r = Int(take()) ?? 0
var rngValues = (0..<r).map { _ in Double(take()) ?? 0 }
let n = Int(take()) ?? 0
let nows = (0..<n).map { _ in Double(take()) ?? 0 }
let t = Int(take()) ?? 0
let texts = (0..<t).map { _ in take() }

var rngCursor = 0
func rng() -> Double { defer { rngCursor += 1 }; return rngCursor < rngValues.count ? rngValues[rngCursor] : 0 }

struct PathRow: Encodable { let key: String; let cuv: String?; let web: String?; let url: String? }
struct MemRow: Encodable { let lastShownAt: Int; let intervalMs: Int; let level: Int }
struct StripRow: Encodable { let text: String; let out: String }
struct Out: Encodable { let paths: [PathRow]; let picks: [String]; let memory: [String: MemRow]; let rngUsed: Int; let strips: [StripRow] }

var memory: [String: PrayerMemoryRow] = [:]
var picks: [String] = []
for now in nows {
    let key = HomeVersePool.pickNext(entries, memory: memory, now: now, rng: rng)
    picks.append(key)
    if !key.isEmpty { HomeVersePool.advanceMemory(&memory, verseKey: key, now: now) }
}
let out = Out(
    paths: keys.map { PathRow(key: $0,
                              cuv: GoldenVerseAudioSource.relativePath(verseKey: $0),
                              web: GoldenVerseAudioSource.relativePath(verseKey: $0, translationId: "web-en"),
                              url: GoldenVerseAudioSource.remoteURL(verseKey: $0)?.absoluteString) },
    picks: picks,
    memory: memory.mapValues { MemRow(lastShownAt: Int($0.lastShownAt), intervalMs: Int($0.intervalMs), level: $0.level) },
    rngUsed: rngCursor,
    strips: texts.map { StripRow(text: $0, out: VerseDisplayNotes.strip($0)) }
)
let enc = JSONEncoder()
enc.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
FileHandle.standardOutput.write(try enc.encode(out))
