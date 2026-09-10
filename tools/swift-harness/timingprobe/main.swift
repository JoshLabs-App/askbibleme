import Foundation

// 与 Kotlin 的 timingMain() 用同一组合成时间轴和探测点，比对定位算法是否一致
let timings = [
    VerseTiming(verse: 1, start: 7.15, end: 12.04),
    VerseTiming(verse: 2, start: 12.04, end: 19.08),
    VerseTiming(verse: 3, start: 19.08, end: 22.68),
    VerseTiming(verse: 4, start: 22.68, end: 27.58),
    VerseTiming(verse: 31, start: 280.0, end: 290.54),
]
let probes: [Double] = [-1.0, 0.0, 6.15, 7.15, 9.59, 12.04, 20.0, 22.68, 27.57, 27.6, 285.0, 290.54, 295.0]

struct Row: Encodable { let t: Double; let verse: Int? }
let rows = probes.map { Row(t: $0, verse: VerseTimingLookup.activeVerse(at: $0, in: timings)) }
let enc = JSONEncoder()
enc.outputFormatting = [.sortedKeys]
FileHandle.standardOutput.write(try enc.encode(rows))
