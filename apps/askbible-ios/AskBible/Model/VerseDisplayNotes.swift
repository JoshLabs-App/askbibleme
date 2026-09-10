import Foundation

/// 首页 / 轮播等短展示用：去掉括注。逐行对应共享库 `lib/bible/strip-zh-verse-display-notes.ts`：
/// · `〔…〕` 译注整段去掉
/// · 经节**开头**的 `(…)` / `（…）`（诗前「（上行之诗）」「（大卫的诗）」）反复剥，最多 8 层
/// · 连续空白折成一个空格；剥空了就退回原文
enum VerseDisplayNotes {
    /// JS 的 \s / trim 字符集（含 NBSP、全角空格 U+3000、U+FEFF）。
    /// 三端都用这一份显式集合 —— Swift 的 \s、Java 的 \s、Kotlin 的 trim() 各有各的定义，直接用会漂。
    static let jsWhitespace: Set<Character> = ["\u{9}", "\u{A}", "\u{B}", "\u{C}", "\u{D}", "\u{20}", "\u{A0}", "\u{1680}", "\u{2000}", "\u{2001}", "\u{2002}", "\u{2003}", "\u{2004}", "\u{2005}", "\u{2006}", "\u{2007}", "\u{2008}", "\u{2009}", "\u{200A}", "\u{2028}", "\u{2029}", "\u{202F}", "\u{205F}", "\u{3000}", "\u{FEFF}"]
    private static let wsClass = "[\\t\\n\\x{0B}\\x{0C}\\r \\x{A0}\\x{1680}\\x{2000}-\\x{200A}\\x{2028}\\x{2029}\\x{202F}\\x{205F}\\x{3000}\\x{FEFF}]"
    private static let notesRe = try! NSRegularExpression(pattern: "\\x{3014}[\\s\\S]*?\\x{3015}")
    private static let halfRe = try! NSRegularExpression(pattern: "^" + wsClass + "*\\([^)]*\\)" + wsClass + "*")
    private static let fullRe = try! NSRegularExpression(pattern: "^" + wsClass + "*（[^）]*）" + wsClass + "*")
    private static let collapseRe = try! NSRegularExpression(pattern: wsClass + "{2,}")

    static func jsTrim(_ s: String) -> String {
        var sub = Substring(s)
        while let f = sub.first, jsWhitespace.contains(f) { sub = sub.dropFirst() }
        while let l = sub.last, jsWhitespace.contains(l) { sub = sub.dropLast() }
        return String(sub)
    }

    private static func replace(_ re: NSRegularExpression, in s: String, with template: String) -> String {
        re.stringByReplacingMatches(in: s, range: NSRange(location: 0, length: (s as NSString).length), withTemplate: template)
    }

    static func strip(_ text: String) -> String {
        let raw = jsTrim(text)
        if raw.isEmpty { return "" }
        var s = replace(notesRe, in: raw, with: "")
        for _ in 0..<8 {
            let next = replace(fullRe, in: replace(halfRe, in: s, with: ""), with: "")
            if next == s { break }
            s = next
        }
        let collapsed = jsTrim(replace(collapseRe, in: s, with: " "))
        return collapsed.isEmpty ? raw : collapsed
    }
}
