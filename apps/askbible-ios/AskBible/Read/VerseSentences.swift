import Foundation

/// 跟读高亮的「句」切分。
///
/// 时间轴（`verse-timings`）只精确到**节**，一节可能长达三四行，整节铺底看起来就是
/// 「按行高亮」，和耳朵听到的位置对不上（Josh 2026-09-19）。
/// 这里把一节再切成句，节内按字数比例插值定位当前句 —— 每到一节边界都会重新对齐，
/// 误差被限制在一节之内，长节的观感提升最明显。
///
/// 切分规则与 `lib/read/verse-sentences.ts` / `VerseSentences.kt` 必须保持一致。
enum VerseSentences {
    /// 句末标点。冒号、逗号、顿号不算断句 —— 中文经文里逗号极多，按逗号切会碎成一片。
    private static let terminators: Set<Character> = ["。", "！", "？", "；", "!", "?", ";"]
    /// 紧跟在句末标点后面、应当并进同一句的收尾符号
    private static let trailing: Set<Character> = ["”", "’", "」", "』", "）", ")", "》", "\"", "'"]
    /// 短于这个长度的尾巴并进上一句，避免出现只高亮一个引号的碎片
    private static let minLength = 2

    /// 返回各句在 `text` 里的字符下标区间（前闭后开）
    static func split(_ text: String) -> [Range<Int>] {
        let chars = Array(text)
        guard !chars.isEmpty else { return [] }
        var out: [Range<Int>] = []
        var start = 0
        var i = 0
        while i < chars.count {
            guard terminators.contains(chars[i]) else { i += 1; continue }
            var end = i + 1
            // 连续的句末标点（「？！」）和收尾引号都并进本句
            while end < chars.count, terminators.contains(chars[end]) || trailing.contains(chars[end]) {
                end += 1
            }
            out.append(start..<end)
            start = end
            i = end
        }
        if start < chars.count { out.append(start..<chars.count) }
        if out.isEmpty { return [0..<chars.count] }

        // 合并过短的碎片到上一句
        var merged: [Range<Int>] = []
        for r in out {
            if let last = merged.last, r.count < minLength {
                merged[merged.count - 1] = last.lowerBound..<r.upperBound
            } else {
                merged.append(r)
            }
        }
        return merged
    }

    /// 按节内进度（0…1）定位当前句。权重用「非空白字符数」，朗读快慢在一节之内基本均匀。
    /// - Returns: 命中句的字符区间；`text` 为空时返回 nil
    static func sentence(at progress: Double, in text: String) -> Range<Int>? {
        let ranges = split(text)
        guard !ranges.isEmpty else { return nil }
        if ranges.count == 1 { return ranges[0] }
        let chars = Array(text)
        let weights = ranges.map { r in
            max(1, chars[r].filter { !$0.isWhitespace }.count)
        }
        let total = weights.reduce(0, +)
        let target = Double(total) * min(max(progress, 0), 1)
        var acc = 0
        for (i, w) in weights.enumerated() {
            acc += w
            if Double(acc) > target { return ranges[i] }
        }
        return ranges[ranges.count - 1]
    }
}
