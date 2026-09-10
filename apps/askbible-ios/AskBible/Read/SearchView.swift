import SwiftUI

/// 经文搜索页。对应 RN ReadScriptureSearchScreen：标题 / 引导语 / 范围分段（全本 · 旧约 · 新约 · 本章）/ 输入框 /
/// 最近搜索 chips / 命中列表（书名 章:节 + 经文，关键词高亮）。输入停顿 360ms 后查库；字号随阅读档位。
struct SearchView: View {
    @EnvironmentObject private var store: ScriptureStore
    @ObservedObject var prefs: SearchPrefs
    var size: ReadSize = .default
    /// 从章页进来时带上当前章，「本章」范围就搜这一章
    var chapterRef: SearchChapterRef?
    /// 命中条目的书名按读经展示语言
    var locale: AppLocale = .zhCN
    var onBack: () -> Void
    var onOpenHit: (ScriptureSearchHit) -> Void

    private let theme = Parchment.light
    @State private var query = ""
    @State private var results: [ScriptureSearchHit] = []
    @State private var searched = false
    @State private var loading = false
    @State private var debounce: Task<Void, Never>?
    /// 在线译本没有本机库：改用同语言内置译本搜，并说明
    @State private var fallbackNote: String?
    @FocusState private var focused: Bool

    private var scale: CGFloat { max(0.85, min(2.8, size.metrics.verseFontSize / 16)) }
    private func sx(_ n: CGFloat) -> CGFloat { max(1, (n * scale * 10).rounded() / 10) }

    private static let scopes: [(ScriptureSearchScope, String)] = [(.all, "全本"), (.old, "旧约"), (.new, "新约"), (.chapter, "本章")]

    var body: some View {
        GeometryReader { geo in
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 0) {
                    Button(action: onBack) {
                        Image(systemName: "chevron.left").font(.system(size: 22, weight: .semibold))
                            .foregroundStyle(theme.ink).frame(width: 44, height: 44, alignment: .leading)
                    }
                    .buttonStyle(.plain)

                    Text("经文搜索").font(.system(size: sx(24), weight: .semibold)).foregroundStyle(theme.ink)
                        .frame(maxWidth: .infinity).padding(.bottom, 8)
                    Text("在当前译本中按关键词查找经文。").font(.system(size: sx(16))).lineSpacing(max(0, sx(24) - sx(16)))
                        .foregroundStyle(theme.muted).multilineTextAlignment(.center).frame(maxWidth: .infinity).padding(.bottom, 12)

                    // 范围分段：surface 底、hairline 边、圆角 10、内边 3、间隔 2；选中 ink 底 surface 字
                    HStack(spacing: 2) {
                        ForEach(Self.scopes, id: \.0) { scope, label in
                            let on = prefs.scope == scope
                            Button { prefs.scope = scope; rerun() } label: {
                                Text(label).font(.system(size: sx(15), weight: .medium))
                                    .foregroundStyle(on ? theme.surface : theme.muted)
                                    .padding(.horizontal, sx(12)).padding(.vertical, sx(8))
                                    .background(RoundedRectangle(cornerRadius: 8).fill(on ? theme.ink : Color.clear))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(3)
                    .background(RoundedRectangle(cornerRadius: 10).fill(theme.surface))
                    .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(theme.border, lineWidth: 1 / UIScreen.main.scale))
                    .frame(maxWidth: .infinity)
                    .padding(.bottom, 14)

                    TextField("输入关键词", text: $query)
                        .font(.system(size: size.metrics.verseFontSize))
                        .foregroundStyle(theme.ink)
                        .autocorrectionDisabled().textInputAutocapitalization(.never)
                        .submitLabel(.search)
                        .focused($focused)
                        .padding(.horizontal, 14).padding(.vertical, 12)
                        .background(RoundedRectangle(cornerRadius: 10).fill(theme.surface))
                        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(theme.border, lineWidth: 1 / UIScreen.main.scale))
                        .padding(.bottom, 8)
                        .onChange(of: query) { _, _ in schedule() }
                        .onSubmit { rerun() }

                    if !prefs.recent.isEmpty {
                        Text("最近搜索").font(.system(size: sx(14), weight: .medium)).foregroundStyle(theme.muted)
                            .padding(.top, 2).padding(.bottom, 6)
                        FlowChips(items: prefs.recent, spacing: 6) { term in
                            Button { query = term; rerun() } label: {
                                Text(term).font(.system(size: sx(15), weight: .medium)).foregroundStyle(theme.ink)
                                    .padding(.horizontal, sx(12)).padding(.vertical, sx(7))
                                    .background(Capsule().fill(theme.surface))
                                    .overlay(Capsule().strokeBorder(theme.border, lineWidth: 1 / UIScreen.main.scale))
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.bottom, 2)
                    }

                    if let fallbackNote {
                        Text(fallbackNote).font(.system(size: sx(13))).foregroundStyle(theme.faint)
                            .multilineTextAlignment(.center).frame(maxWidth: .infinity).padding(.bottom, 8)
                    }
                    if prefs.scope == .chapter, chapterRef == nil {
                        Text("暂无当前章节，请先打开一章后再搜索本章。").font(.system(size: sx(14))).foregroundStyle(theme.faint)
                            .frame(maxWidth: .infinity).padding(.bottom, 8)
                    }
                    if loading { ProgressView().tint(theme.muted).frame(maxWidth: .infinity).padding(.vertical, 20) }
                    if !loading, searched, results.isEmpty, !(prefs.scope == .chapter && chapterRef == nil) {
                        Text("没有找到匹配的经文").font(.system(size: sx(16))).lineSpacing(max(0, sx(24) - sx(16)))
                            .foregroundStyle(theme.muted).frame(maxWidth: .infinity).padding(.top, 24)
                    }

                    ForEach(results) { hit in
                        Button { onOpenHit(hit) } label: {
                            VStack(alignment: .leading, spacing: 3) {
                                Text("\(BibleCatalog.book(id: hit.bookId)?.name(locale) ?? hit.bookName) \(hit.chapter):\(hit.verse)")
                                    .font(.system(size: size.metrics.verseNumFontSize, weight: .semibold)).foregroundStyle(theme.faint)
                                let hitBuilt = hitText(hit.text)
                                RoundedHighlightText(text: hitBuilt.text, highlightRanges: hitBuilt.ranges,
                                                     fill: UIColor(theme.verseBookmarkMarker))
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.vertical, sx(12))
                            .overlay(alignment: .top) { Rectangle().fill(theme.border).frame(height: 1 / UIScreen.main.scale) }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 20 + geo.safeAreaInsets.top)
                .padding(.bottom, ShellMetrics.tabBarClearance + 28 + geo.safeAreaInsets.bottom + 120)
            }
            .ignoresSafeArea(edges: [.top, .bottom])
            .parchmentFade(.tabbar)
            .scrollDismissesKeyboard(.interactively)
        }
        .background(ParchmentBackground(theme: theme).ignoresSafeArea())
        .onAppear { focused = true }
    }

    /// 命中经文：关键词段 ink 字 700；其余 verse 字号 500 正文色。关键词底色由 RoundedHighlightText 画成圆角 4 的框
    /// （Josh：搜索关键词高亮也要弧形），这里只给出各段字形与命中区间。
    private func hitText(_ text: String) -> (text: NSAttributedString, ranges: [NSRange]) {
        let out = NSMutableAttributedString()
        var ranges: [NSRange] = []
        let para = NSMutableParagraphStyle()
        para.lineSpacing = size.metrics.verseLineSpacing
        // 截行交给 RoundedHighlightText 的 container（maximumNumberOfLines）；段落样式一写 byTruncatingTail 整段就只排一行
        para.lineBreakMode = .byWordWrapping
        for seg in ScriptureSearchRules.split(text, keyword: query) {
            let piece = NSAttributedString(string: seg.text, attributes: [
                .font: UIFont.systemFont(ofSize: size.metrics.verseFontSize, weight: seg.match ? .bold : .medium),
                .foregroundColor: UIColor(seg.match ? theme.ink : theme.inkSoft),
                .paragraphStyle: para,
            ])
            if seg.match, piece.length > 0 { ranges.append(NSRange(location: out.length, length: piece.length)) }
            out.append(piece)
        }
        return (out, ranges)
    }

    private func schedule() {
        debounce?.cancel()
        let q = query.trimmingCharacters(in: .whitespaces)
        if q.isEmpty { results = []; searched = false; return }
        debounce = Task {
            try? await Task.sleep(nanoseconds: 360_000_000)
            if Task.isCancelled { return }
            await MainActor.run { rerun() }
        }
    }

    private func rerun() {
        let q = ScriptureSearchRules.normalize(query)
        if q.isEmpty { results = []; searched = false; return }
        if prefs.scope == .chapter, chapterRef == nil { results = []; searched = true; return }
        loading = true
        let fallbackId = store.searchFallbackId(for: store.translation.id)
        fallbackNote = fallbackId.flatMap { ScriptureTranslation.find($0) }.map { "当前译本是在线译本，暂不支持搜索；已改用「\($0.label(locale))」搜索" }
        let hits = store.database(fallbackId ?? store.translation.id)?.search(query: q, scope: prefs.scope, chapterRef: chapterRef) ?? []
        results = hits
        searched = true
        loading = false
        prefs.push(q)
    }
}

/// 自动换行的 chips（RN flexWrap）
struct FlowChips<Content: View>: View {
    let items: [String]
    var spacing: CGFloat = 6
    @ViewBuilder let content: (String) -> Content

    var body: some View {
        var width: CGFloat = 0, height: CGFloat = 0
        return GeometryReader { geo in
            ZStack(alignment: .topLeading) {
                ForEach(items, id: \.self) { item in
                    content(item)
                        .alignmentGuide(.leading) { d in
                            if abs(width - d.width) > geo.size.width { width = 0; height -= d.height + spacing }
                            let result = width
                            if item == items.last { width = 0 } else { width -= d.width + spacing }
                            return result
                        }
                        .alignmentGuide(.top) { _ in
                            let result = height
                            if item == items.last { height = 0 }
                            return result
                        }
                }
            }
        }
        .frame(height: chipsHeight)
    }

    /// 粗估高度：每行 36，按平均 5 个 chip 一行算 —— 只影响布局占位，chips 少时够用
    private var chipsHeight: CGFloat { CGFloat((items.count + 4) / 5) * 40 }
}
