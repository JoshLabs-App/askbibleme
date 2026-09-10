import SwiftUI

/// 文章正文用到的 Markdown 子集（与 RN ReadChapterInfoEditionMarkdown 渲染的那套一致）：
/// 段落 / ## ### #### 标题 / 无序与有序列表 / 引用 / 分隔线 / 表格，行内粗体与链接。
enum MarkdownBlock: Equatable {
    case heading(level: Int, text: String)
    case paragraph(String)
    case bullets([String])
    case ordered([String])
    case quote(String)
    case rule
    case table(rows: [[String]])
}

enum MarkdownParser {
    static func parse(_ markdown: String) -> [MarkdownBlock] {
        var blocks: [MarkdownBlock] = []
        var para: [String] = []
        var bullets: [String] = []
        var ordered: [String] = []
        var quote: [String] = []
        var table: [[String]] = []

        func flush() {
            if !para.isEmpty { blocks.append(.paragraph(para.joined(separator: "\n"))); para = [] }
            if !bullets.isEmpty { blocks.append(.bullets(bullets)); bullets = [] }
            if !ordered.isEmpty { blocks.append(.ordered(ordered)); ordered = [] }
            if !quote.isEmpty { blocks.append(.quote(quote.joined(separator: "\n"))); quote = [] }
            if !table.isEmpty { blocks.append(.table(rows: table)); table = [] }
        }

        for raw in markdown.replacingOccurrences(of: "\r\n", with: "\n").components(separatedBy: "\n") {
            let line = raw.trimmingCharacters(in: .whitespaces)
            if line.isEmpty { flush(); continue }
            if line.hasPrefix("#") {
                let hashes = line.prefix { $0 == "#" }.count
                if hashes <= 6, line.dropFirst(hashes).hasPrefix(" ") {
                    flush()
                    blocks.append(.heading(level: hashes, text: String(line.dropFirst(hashes)).trimmingCharacters(in: .whitespaces)))
                    continue
                }
            }
            if line == "---" || line == "***" || line == "___" { flush(); blocks.append(.rule); continue }
            if line.hasPrefix(">") {
                if !para.isEmpty || !bullets.isEmpty || !ordered.isEmpty || !table.isEmpty { flush() }
                quote.append(String(line.dropFirst()).trimmingCharacters(in: .whitespaces)); continue
            }
            if line.hasPrefix("|") {
                if !para.isEmpty || !bullets.isEmpty || !ordered.isEmpty || !quote.isEmpty { flush() }
                let cells = line.split(separator: "|", omittingEmptySubsequences: false).dropFirst().dropLast()
                    .map { $0.trimmingCharacters(in: .whitespaces) }
                // 表头分隔行 |---|---| 跳过
                if cells.allSatisfy({ $0.allSatisfy { $0 == "-" || $0 == ":" } && !$0.isEmpty }) { continue }
                table.append(cells); continue
            }
            if line.hasPrefix("- ") || line.hasPrefix("* ") || line.hasPrefix("• ") {
                if !para.isEmpty || !ordered.isEmpty || !quote.isEmpty || !table.isEmpty { flush() }
                bullets.append(String(line.dropFirst(2)).trimmingCharacters(in: .whitespaces)); continue
            }
            if let dot = line.firstIndex(of: "."), line[line.startIndex..<dot].allSatisfy(\.isNumber), !line[line.startIndex..<dot].isEmpty,
               line[line.index(after: dot)...].hasPrefix(" ") {
                if !para.isEmpty || !bullets.isEmpty || !quote.isEmpty || !table.isEmpty { flush() }
                ordered.append(String(line[line.index(after: dot)...]).trimmingCharacters(in: .whitespaces)); continue
            }
            if !bullets.isEmpty || !ordered.isEmpty || !quote.isEmpty || !table.isEmpty { flush() }
            para.append(line)
        }
        flush()
        return blocks
    }
}

/// 正文渲染。字号随阅读档位缩放：textScale = verseFontSize / 16（RN 同式），body 16/30、h2 18/30、h3 16/27，
/// 强调色 #A56A2D，粗体 600 强调色，链接强调色不加下划线（plainScriptureLinks），引用左线 3 强调色、文字 #8C562A。
struct MarkdownBody: View {
    let markdown: String
    var size: ReadSize = .default
    let theme: Parchment

    static let accent = Color(rgb: 0xA56A2D)
    private static let quoteInk = Color(rgb: 0x8C562A)
    /// RN postReadingTheme.mdBody：rgba(28,20,16,.82)（探索文章与读后两版同一套正文色）
    static let bodyInk = Color(red: 28 / 255, green: 20 / 255, blue: 16 / 255, opacity: 0.82)

    private var scale: CGFloat { max(0.8, min(2.8, size.metrics.verseFontSize / 16)) }
    private func sx(_ n: CGFloat) -> CGFloat { max(1, (n * scale * 10).rounded() / 10) }

    var body: some View {
        let blocks = MarkdownParser.parse(markdown)
        VStack(alignment: .leading, spacing: 0) {
            ForEach(blocks.indices, id: \.self) { i in
                block(blocks[i])
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func block(_ b: MarkdownBlock) -> some View {
        switch b {
        case .heading(let level, let text):
            switch level {
            case 1:
                inline(text, size: sx(20), weight: .bold, color: Self.accent, line: sx(32))
                    .tracking(0.5).frame(maxWidth: .infinity).multilineTextAlignment(.center)
                    .padding(.bottom, sx(22) + sx(8))
            case 2:
                inline(text, size: sx(18), weight: .bold, color: Self.accent, line: sx(30))
                    .tracking(0.3).padding(.top, sx(24)).padding(.bottom, sx(14) + sx(5))
            default:
                inline(text, size: sx(16), weight: .semibold, color: Self.accent, line: sx(27))
                    .padding(.top, sx(22)).padding(.bottom, sx(10))
            }
        case .paragraph(let text):
            inline(text, size: sx(16), weight: .regular, color: Self.bodyInk, line: sx(30))
                .padding(.bottom, sx(18))
        case .bullets(let items):
            // RN bullet_list_icon 宽 0：条目不带圆点，逐条成段（间距 10）
            VStack(alignment: .leading, spacing: sx(10)) {
                ForEach(items.indices, id: \.self) { i in
                    inline(items[i], size: sx(16), weight: .regular, color: Self.bodyInk, line: sx(30))
                }
            }
            .padding(.top, sx(6)).padding(.bottom, sx(18))
        case .ordered(let items):
            VStack(alignment: .leading, spacing: sx(10)) {
                ForEach(items.indices, id: \.self) { i in
                    HStack(alignment: .top, spacing: sx(4)) {
                        Text("\(i + 1).")
                            .font(.system(size: sx(15), weight: .medium))
                            .foregroundStyle(Self.accent)
                            .lineSpacing(max(0, sx(30) - sx(15)))
                            .frame(minWidth: sx(18), alignment: .leading)
                        inline(items[i], size: sx(16), weight: .regular, color: Self.bodyInk, line: sx(30))
                    }
                }
            }
            .padding(.top, sx(6)).padding(.bottom, sx(18))
        case .quote(let text):
            inline(text, size: sx(16), weight: .regular, color: Self.quoteInk, line: sx(30))
                .padding(.leading, sx(14))
                .overlay(alignment: .leading) { Rectangle().fill(Self.accent).frame(width: 3) }
                .padding(.vertical, sx(16))
        case .rule:
            // RN hr：高 0、透明 —— 分隔线不画
            EmptyView()
        case .table(let rows):
            VStack(alignment: .leading, spacing: 0) {
                ForEach(rows.indices, id: \.self) { r in
                    HStack(alignment: .top, spacing: 8) {
                        ForEach(rows[r].indices, id: \.self) { c in
                            inline(rows[r][c], size: sx(14), weight: r == 0 ? .semibold : .regular,
                                   color: r == 0 ? Self.accent : theme.inkSoft, line: sx(22))
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                    .padding(.vertical, 6)
                    Rectangle().fill(theme.border.opacity(0.6)).frame(height: 1 / UIScreen.main.scale)
                }
            }
            .padding(.bottom, sx(18))
        }
    }

    /// 行内：粗体 → 600 强调色；链接 → 强调色、不加下划线；其余按传入样式
    private func inline(_ text: String, size fontSize: CGFloat, weight: Font.Weight, color: Color, line: CGFloat) -> some View {
        var attr = (try? AttributedString(markdown: text, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)))
            ?? AttributedString(text)
        attr.font = .system(size: fontSize, weight: weight)
        attr.foregroundColor = color
        for run in attr.runs {
            if let intent = run.inlinePresentationIntent, intent.contains(.stronglyEmphasized) {
                attr[run.range].font = .system(size: fontSize, weight: .semibold)
                attr[run.range].foregroundColor = Self.accent
            }
            if run.link != nil {
                attr[run.range].foregroundColor = Self.accent
                attr[run.range].underlineStyle = nil
            }
        }
        return Text(attr)
            .lineSpacing(max(0, line - fontSize))
            .fixedSize(horizontal: false, vertical: true)
    }
}

/// 文章里的站内链接：/read/GEN/3?verse=9 → 章；/explore/articles/<slug> → 文章。完整域名（askbible.me）也认。
enum ArticleLink {
    enum Target { case chapter(bookId: String, chapter: Int, verse: Int?); case article(slug: String) }

    static func resolve(_ url: URL) -> Target? {
        let parts = url.path.split(separator: "/").map(String.init)
        if parts.count >= 3, parts[0] == "read", let ch = Int(parts[2]) {
            let verse = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?
                .first { $0.name == "verse" }?.value.flatMap(Int.init)
            return .chapter(bookId: parts[1].uppercased(), chapter: ch, verse: verse)
        }
        if parts.count >= 3, parts[0] == "explore", parts[1] == "articles" { return .article(slug: parts[2]) }
        return nil
    }
}
