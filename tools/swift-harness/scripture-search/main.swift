import Foundation

// 经文搜索 / 收藏规则对拍 harness：协议见 tools/scripture-search-check.mjs（每行一条制表符分隔的用例，输出 JSON 字符串数组）
func jsonString(_ v: Any) -> String {
    let data = try! JSONSerialization.data(withJSONObject: v, options: [.withoutEscapingSlashes, .sortedKeys])
    return String(decoding: data, as: UTF8.self)
}
var out: [String] = []
while let line = readLine() {
    if line.isEmpty { continue }
    let f = line.components(separatedBy: "\t")
    switch f[0] {
    case "norm": out.append(ScriptureSearchRules.normalize(f[1]))
    case "esc": out.append(ScriptureSearchRules.escapeLike(f[1]))
    case "scope":
        let ref = f[4].isEmpty ? nil : SearchChapterRef(bookId: f[4], chapter: Int(f[5]) ?? 0)
        out.append(ScriptureSearchRules.isVerseInScope(f[1], Int(f[2]) ?? 0, ScriptureSearchScope(rawValue: f[3]) ?? .all, ref) ? "1" : "0")
    case "split":
        let segs = ScriptureSearchRules.split(f[1], keyword: f[2]).map { ["text": $0.text, "match": $0.match] as [String: Any] }
        out.append(jsonString(segs))
    case "recent":
        let terms = (try? JSONSerialization.jsonObject(with: Data(f[1].utf8)) as? [String]) ?? []
        out.append(jsonString(RecentSearchRules.normalizeTerms(RecentSearchRules.push(f[2], into: terms))))
    case "recentnorm":
        let terms = (try? JSONSerialization.jsonObject(with: Data(f[1].utf8)) as? [String]) ?? []
        out.append(jsonString(RecentSearchRules.normalizeTerms(terms)))
    case "bmkey": out.append(VerseBookmarkRules.key(translationId: f[1], bookId: f[2], chapter: Int(f[3]) ?? 0, verse: Int(f[4]) ?? 0))
    case "bmparse":
        let store = VerseBookmarkRules.parse(f.count > 1 && !f[1].isEmpty ? f[1] : nil, now: 1)
        var norm: [String: Any] = [:]
        for (k, b) in store {
            norm[k] = ["bookId": b.bookId, "bookName": b.bookName, "chapter": b.chapter, "verse": b.verse,
                       "translationId": b.translationId, "text": b.text, "savedAtSet": true] as [String: Any]
        }
        out.append(jsonString(norm))
    case "tpparse":
        let stored = TranslationPrefsRules.parse(f[1].isEmpty ? nil : f[1], allowed: f[2].split(separator: ",").map(String.init), defaultId: f[3])
        out.append(jsonString(["primary": stored.primaryId, "secondary": stored.secondaryId ?? NSNull()] as [String: Any]))
    case "tpser": out.append(TranslationPrefsRules.serialize(primaryId: f[1], secondaryId: f[2].isEmpty ? nil : f[2]))
    default: out.append("skip")
    }
}
FileHandle.standardOutput.write(jsonString(out).data(using: .utf8)!)
