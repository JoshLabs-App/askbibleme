import Foundation

/// 「读后两版」正文的归一化规则。逐条搬自 RN `src/bible/info-edition-format.ts`
/// （网站 `lib/bible/info-edition-v1-format.ts` 同源），由 check:info-edition 与 TS / Kotlin 三端对拍。
enum InfoEditionFormat {
    /// 查找资料里隐藏的版块标题（INFO_EDITION_KEY_SCENES_HEADING_PATTERNS）
    static let keyScenesHeadingPatterns = ["^关键画面$", "^關鍵畫面$", "(?i)^Key\\s+Scenes$", "(?i)^Key\\s+Visuals$"]

    static func matches(_ pattern: String, _ s: String) -> Bool {
        s.range(of: pattern, options: .regularExpression) != nil
    }

    private static func isHeadingLine(_ line: String) -> Bool { matches("^#{1,6}\\s+\\S", line.trimmingCharacters(in: .whitespaces)) }
    private static func isHorizontalRule(_ line: String) -> Bool { matches("^(?:-{3,}|\\*{3,}|_{3,})\\s*$", line.trimmingCharacters(in: .whitespaces)) }

    /// 与 TS `.trim()` 一致：去掉首尾空白（含换行）
    private static func trim(_ s: String) -> String { s.trimmingCharacters(in: .whitespacesAndNewlines) }

    /// 把三个以上连续换行压成两个
    private static func collapseBlankLines(_ s: String) -> String {
        s.replacingOccurrences(of: "\n{3,}", with: "\n\n", options: .regularExpression)
    }

    /// stripInfoEditionSectionByHeading：删掉指定标题（≤ 3 级）到下一个同级或更高级标题之间的整段
    static func stripSection(_ markdown: String, headingPatterns: [String]) -> String {
        if trim(markdown).isEmpty { return markdown }
        let lines = markdown.components(separatedBy: "\r\n").joined(separator: "\n").components(separatedBy: "\n")
        var keep: [String] = []
        var i = 0
        func heading(_ line: String) -> (level: Int, text: String)? {
            guard let re = try? NSRegularExpression(pattern: "^(#{1,6})\\s+(.*\\S)\\s*$"),
                  let m = re.firstMatch(in: line, range: NSRange(line.startIndex..., in: line)),
                  let r1 = Range(m.range(at: 1), in: line), let r2 = Range(m.range(at: 2), in: line) else { return nil }
            return (line[r1].count, String(line[r2]))
        }
        while i < lines.count {
            if let h = heading(lines[i]), h.level <= 3, headingPatterns.contains(where: { matches($0, h.text) }) {
                let startLevel = h.level
                i += 1
                while i < lines.count {
                    if let nh = heading(lines[i]), nh.level <= startLevel { break }
                    i += 1
                }
                continue
            }
            keep.append(lines[i]); i += 1
        }
        return trim(collapseBlankLines(keep.joined(separator: "\n")))
    }

    /// normalizeInfoEditionCompareMarkdown：去 code fence、首个标题升一级其余 # 降为 ##、
    /// 贴着标题 / 边界 / 另一条分隔线的 --- 丢掉、软换行合并、首行强制成 H1、旧式「X第N章导读」标题、嵌套列表拉平。
    static func normalize(_ raw: String) -> String {
        var text = trim(raw)
        if let re = try? NSRegularExpression(pattern: "^```(?:markdown|md)?\\s*\\n?([\\s\\S]*?)\\n?```$", options: .caseInsensitive),
           let m = re.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
           let r = Range(m.range(at: 1), in: text) {
            text = trim(String(text[r]))
        }
        var lines = text.components(separatedBy: "\r\n").joined(separator: "\n").components(separatedBy: "\n")
        var cleaned: [String] = []
        var firstHeadingSeen = false
        let headingRe = try! NSRegularExpression(pattern: "^(\\s*)#{1,6}(\\s+\\S.*)$")
        let singleHashRe = try! NSRegularExpression(pattern: "^(\\s*)#(\\s+\\S.*)$")

        func nearestMeaningful(_ start: Int, _ step: Int) -> String? {
            var i = start
            while i >= 0 && i < lines.count {
                let c = trim(lines[i])
                if !c.isEmpty { return c }
                i += step
            }
            return nil
        }

        for i in lines.indices {
            let line0 = lines[i]
            if let m = headingRe.firstMatch(in: line0, range: NSRange(line0.startIndex..., in: line0)),
               let r1 = Range(m.range(at: 1), in: line0), let r2 = Range(m.range(at: 2), in: line0) {
                if !firstHeadingSeen {
                    firstHeadingSeen = true
                    lines[i] = "\(line0[r1])#\(line0[r2])"
                } else if let sm = singleHashRe.firstMatch(in: line0, range: NSRange(line0.startIndex..., in: line0)),
                          let s1 = Range(sm.range(at: 1), in: line0), let s2 = Range(sm.range(at: 2), in: line0) {
                    lines[i] = "\(line0[s1])##\(line0[s2])"
                }
            }
            let line = lines[i]
            if !isHorizontalRule(line) { cleaned.append(line); continue }
            let prev = nearestMeaningful(i - 1, -1)
            let next = nearestMeaningful(i + 1, 1)
            let shouldDrop = prev == nil || next == nil
                || isHorizontalRule(prev!) || isHorizontalRule(next!)
                || isHeadingLine(prev!) || isHeadingLine(next!)
            if !shouldDrop { cleaned.append(line) }
        }

        let merged = enforcePrimaryHeadingStructure(mergeHardWrappedParagraphLines(cleaned))
        text = trim(collapseBlankLines(merged.joined(separator: "\n")))
        // 手机上把嵌套列表的缩进拉平：保留顶层序号，去掉嵌套的圆点 / 序号前缀
        text = text.replacingOccurrences(of: "(?m)^[ \\t]+[-*+]\\s+", with: "", options: .regularExpression)
        text = text.replacingOccurrences(of: "(?m)^[ \\t]+\\d+\\.\\s+", with: "", options: .regularExpression)
        return text
    }

    private static func isParagraphText(_ line: String) -> Bool {
        let t = trim(line)
        if t.isEmpty { return false }
        if isHorizontalRule(t) { return false }
        if matches("^(#{1,6}\\s|>|\\* |- |\\+ |```|~~~)", t) { return false }
        if matches("^\\d+\\.\\s", t) { return false }
        return true
    }

    /// 行尾两个以上空格视为软换行：与下一行正文并成一段
    private static func mergeHardWrappedParagraphLines(_ lines: [String]) -> [String] {
        var out: [String] = []
        var i = 0
        while i < lines.count {
            var currentRaw = lines[i]
            if !isParagraphText(currentRaw) { out.append(currentRaw); i += 1; continue }
            var current = currentRaw.replacingOccurrences(of: "\\s+$", with: "", options: .regularExpression)
            while matches("\\s{2,}$", currentRaw), i + 1 < lines.count, isParagraphText(lines[i + 1]) {
                current += " " + trim(lines[i + 1])
                i += 1
                currentRaw = lines[i]
            }
            out.append(current)
            i += 1
        }
        return out
    }

    private static func enforcePrimaryHeadingStructure(_ lines: [String]) -> [String] {
        var next = lines
        guard let first = next.firstIndex(where: { !trim($0).isEmpty }) else { return next }
        let firstLine = next[first]
        if let re = try? NSRegularExpression(pattern: "^(\\s*)#{1,6}\\s+(\\S.*)$"),
           let m = re.firstMatch(in: firstLine, range: NSRange(firstLine.startIndex..., in: firstLine)),
           let r1 = Range(m.range(at: 1), in: firstLine), let r2 = Range(m.range(at: 2), in: firstLine) {
            next[first] = "\(firstLine[r1])# \(firstLine[r2])"
        } else {
            next[first] = "# \(trim(firstLine))"
        }
        let singleHashRe = try! NSRegularExpression(pattern: "^(\\s*)#(\\s+\\S.*)$")
        if first + 1 < next.count {
            for i in (first + 1)..<next.count {
                let l = next[i]
                if let m = singleHashRe.firstMatch(in: l, range: NSRange(l.startIndex..., in: l)),
                   let r1 = Range(m.range(at: 1), in: l), let r2 = Range(m.range(at: 2), in: l) {
                    next[i] = "\(l[r1])##\(l[r2])"
                }
            }
        }
        // 旧式标题「# 马太福音第23章导读」→「# 马太福音 23章」
        let firstHeading = next[first]
        if let re = try? NSRegularExpression(pattern: "^(\\s*#\\s*)(.+?)\\s*第?\\s*(\\d+)\\s*章\\s*导读\\s*$"),
           let m = re.firstMatch(in: firstHeading, range: NSRange(firstHeading.startIndex..., in: firstHeading)),
           let p = Range(m.range(at: 1), in: firstHeading), let b = Range(m.range(at: 2), in: firstHeading),
           let n = Range(m.range(at: 3), in: firstHeading) {
            next[first] = "\(firstHeading[p])\(trim(String(firstHeading[b]))) \(firstHeading[n])章"
        }
        return next
    }

    /// 阅读器最终喂给 Markdown 渲染的文本：归一化后，查找资料再去掉「关键画面」版块
    static func readerText(_ markdown: String, variant: InfoEditionVariant) -> String {
        var text = normalize(markdown)
        if variant == .info { text = stripSection(text, headingPatterns: keyScenesHeadingPatterns) }
        return text
    }

    /// splitPrimaryHeading：首个有内容的行若是「# 标题」就摘成页头，并吃掉紧跟的一个空行
    static func splitPrimaryHeading(_ markdown: String) -> (heading: String?, body: String) {
        var lines = markdown.components(separatedBy: "\n")
        guard let first = lines.firstIndex(where: { !trim($0).isEmpty }) else { return (nil, markdown) }
        let line = lines[first]
        guard let re = try? NSRegularExpression(pattern: "^#\\s+(.+)$"),
              let m = re.firstMatch(in: line, range: NSRange(line.startIndex..., in: line)),
              let r = Range(m.range(at: 1), in: line) else { return (nil, markdown) }
        let heading = trim(String(line[r]))
        lines.remove(at: first)
        if first < lines.count, trim(lines[first]).isEmpty { lines.remove(at: first) }
        return (heading, trim(lines.joined(separator: "\n")))
    }
}

enum InfoEditionVariant: String { case guide, info }
