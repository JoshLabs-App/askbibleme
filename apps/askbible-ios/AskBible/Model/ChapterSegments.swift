import Foundation

/// 一章的分段元数据：小标题（起始节 → 标题）与段落起点。
/// 对应 RN buildChapterSegmentMeta 的产物；数据由 tools/gen-chapter-segments.mts 按 t1（故事化小标题）模式生成。
struct ChapterSegmentMeta {
    let headings: [Int: [String]]
    let paragraphStarts: Set<Int>
    static let empty = ChapterSegmentMeta(headings: [:], paragraphStarts: [])
}

enum ChapterSegments {
    private static var books: [String: [String: [String: Any]]] = {
        guard let url = Bundle.main.url(forResource: "chapter-segments", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: [String: [String: Any]]] else { return [:] }
        return obj
    }()

    /// english = 英文译本的面（RN preferEnglishTitles）：小标题只取 USFM 的英文 T1（`he`），没有就不显示；
    /// 段落起点若英文那套不同则用 `pe`。中文面下 zh-TW 由调用方再转繁。
    static func meta(bookId: String, chapter: Int, english: Bool = false) -> ChapterSegmentMeta {
        guard let entry = books[bookId.uppercased()]?[String(chapter)] else { return .empty }
        var headings: [Int: [String]] = [:]
        for (k, v) in (entry[english ? "he" : "h"] as? [String: [String]]) ?? [:] { if let n = Int(k) { headings[n] = v } }
        let starts = Set((entry[english ? "pe" : "p"] as? [Int]) ?? (entry["p"] as? [Int]) ?? [])
        return ChapterSegmentMeta(headings: headings, paragraphStarts: starts)
    }

    /// 对应 buildParagraphGroups：段落起点或带小标题的节开新段
    static func paragraphGroups(_ verses: [LoadedVerse], meta: ChapterSegmentMeta) -> [[LoadedVerse]] {
        var groups: [[LoadedVerse]] = []
        var current: [LoadedVerse] = []
        for (i, v) in verses.enumerated() {
            let isStart = i == 0 || meta.paragraphStarts.contains(v.number) || !(meta.headings[v.number] ?? []).isEmpty
            if isStart, !current.isEmpty { groups.append(current); current = [] }
            current.append(v)
        }
        if !current.isEmpty { groups.append(current) }
        return groups
    }
}
