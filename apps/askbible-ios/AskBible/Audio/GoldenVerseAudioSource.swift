import Foundation

/// 金句语音音源。对应共享库 `lib/bible/golden-verse-audio.ts` + `lib/bible/parse-verse-key.ts`：
/// R2 直链点播，对象键 `audio/golden-verses/{书}-{章}-{节}-32kbps.mp3`（英文 WEB 在 golden-verses-web-en）。
/// 禁止回落到 askbible.me / Render。
enum GoldenVerseAudioSource {
    static let r2PublicBase = "https://pub-f30fb48025d841f09c37bb9b52df5354.r2.dev"
    static let suffix = "-32kbps.mp3"

    struct Location: Equatable {
        let bookId: String
        let chapter: Int
        let verse: Int
    }

    private static let rangeRe = try! NSRegularExpression(pattern: "^([A-Z0-9]{2,8})\\.([0-9]+)\\.([0-9]+)-")
    private static let singleRe = try! NSRegularExpression(pattern: "^([A-Z0-9]{2,8})\\.([0-9]+)\\.([0-9]+)$")

    /// 解析 `PRO.3.5` / `GEN.1.1-GEN.1.3`（区间取起点）；大小写不敏感；章节必须 ≥ 1
    static func parseVerseKey(_ key: String) -> Location? {
        let s = key.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        guard !s.isEmpty else { return nil }
        let ns = s as NSString
        let all = NSRange(location: 0, length: ns.length)
        let m = rangeRe.firstMatch(in: s, range: all) ?? singleRe.firstMatch(in: s, range: all)
        guard let m else { return nil }
        guard let chapter = Int(ns.substring(with: m.range(at: 2))),
              let verse = Int(ns.substring(with: m.range(at: 3))),
              chapter >= 1, verse >= 1 else { return nil }
        return Location(bookId: ns.substring(with: m.range(at: 1)), chapter: chapter, verse: verse)
    }

    /// `golden-verses/GEN-1-1-32kbps.mp3`；translationId 只认 web-en，其余都是 cuv-simp
    static func relativePath(verseKey: String, translationId: String = "cuv-simp") -> String? {
        guard let loc = parseVerseKey(verseKey) else { return nil }
        let subdir = translationId == "web-en" ? "golden-verses-web-en" : "golden-verses"
        return "\(subdir)/\(loc.bookId)-\(loc.chapter)-\(loc.verse)\(suffix)"
    }

    static func remoteURL(verseKey: String, translationId: String = "cuv-simp") -> URL? {
        guard let rel = relativePath(verseKey: verseKey, translationId: translationId) else { return nil }
        return URL(string: r2PublicBase + "/audio/" + rel)
    }
}
