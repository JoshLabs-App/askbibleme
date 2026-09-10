import Foundation

/// 经文标注解码。逐条对应 RN 版 `src/bible/verse-annotations.ts`：
/// speech_spans 是 `[[start, end, code]]` 的 JSON，code 1 = 神言、2 = 人言；
/// 落在 span 外的文本是 plain。切分规则与 TS 侧必须一致，由 fixture 对拍保证。
enum SpeechKind: String {
    case plain, divine, human
}

struct SpeechPart: Equatable {
    let kind: SpeechKind
    let text: String
}

enum VerseAnnotations {
    /// 与 `lib/bible/golden-verse-theme-repeat.ts` 同步
    static let minGoldenThemeRepeatCount = 3

    static func showsGoldenThemeMarker(themeRepeatCount: Int) -> Bool {
        themeRepeatCount >= minGoldenThemeRepeatCount
    }

    /// 解码并过滤：要求整数、start >= 0、end > start、code 为 1 或 2，其余丢弃。
    static func decodeSpeechSpans(_ raw: String?) -> [(start: Int, end: Int, code: Int)] {
        let s = (raw ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !s.isEmpty, let data = s.data(using: .utf8) else { return [] }
        guard let parsed = try? JSONSerialization.jsonObject(with: data),
              let rows = parsed as? [[Any]] else { return [] }

        var out: [(start: Int, end: Int, code: Int)] = []
        for row in rows where row.count >= 3 {
            guard let start = intValue(row[0]),
                  let end = intValue(row[1]),
                  let code = intValue(row[2]),
                  start >= 0, end > start,
                  code == 1 || code == 2 else { continue }
            out.append((start, end, code))
        }
        return out
    }

    /// 按 span 把整节切成若干段；没有有效 span 时返回 nil（调用方按整节 plain 处理）。
    ///
    /// 注意：TS 用 `text.slice()` 按 UTF-16 码元切分，Swift 的 String.Index 是按字素簇，
    /// 两者对中文标点和引号的切点必须一致 —— 所以这里显式走 UTF-16 视图。
    static func speechParts(text: String, rawSpans: String?) -> [SpeechPart]? {
        let spans = decodeSpeechSpans(rawSpans).sorted { $0.start < $1.start }
        guard !spans.isEmpty else { return nil }

        let units = Array(text.utf16)
        var parts: [SpeechPart] = []
        var cursor = 0

        for (start, end, code) in spans {
            let s = min(start, units.count)
            let e = min(end, units.count)
            guard e > s else { continue }
            if s > cursor, let chunk = utf16Slice(units, cursor, s) {
                parts.append(SpeechPart(kind: .plain, text: chunk))
            }
            if let chunk = utf16Slice(units, s, e) {
                parts.append(SpeechPart(kind: code == 1 ? .divine : .human, text: chunk))
            }
            cursor = e
        }

        if cursor < units.count, let chunk = utf16Slice(units, cursor, units.count) {
            parts.append(SpeechPart(kind: .plain, text: chunk))
        }
        return parts.isEmpty ? nil : parts
    }

    private static func utf16Slice(_ units: [UInt16], _ from: Int, _ to: Int) -> String? {
        guard from < to, to <= units.count else { return nil }
        return String(decoding: units[from..<to], as: UTF16.self)
    }

    private static func intValue(_ any: Any) -> Int? {
        if let n = any as? Int { return n }
        if let n = any as? Double, n == n.rounded() { return Int(n) }
        if let n = any as? NSNumber {
            let d = n.doubleValue
            return d == d.rounded() ? n.intValue : nil
        }
        return nil
    }
}
