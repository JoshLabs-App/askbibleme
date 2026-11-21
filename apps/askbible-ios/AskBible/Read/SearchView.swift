import SwiftUI

/// 经文搜索页（顶置带清空钮的搜索栏 + 书卷章节智能秒直达卡 + 全文关键词圆角高亮）。
struct SearchView: View {
    @EnvironmentObject private var store: ScriptureStore
    @ObservedObject var prefs: SearchPrefs
    var size: ReadSize = .default
    var chapterRef: SearchChapterRef?
    var locale: AppLocale = .zhCN
    var onBack: () -> Void
    var onOpenHit: (ScriptureSearchHit, String) -> Void

    @Environment(\.parchment) private var theme
    @State private var query = ""
    @State private var results: [ScriptureSearchHit] = []
    @State private var total = 0
    @State private var searched = false
    @State private var loading = false
    @State private var debounce: Task<Void, Never>?
    @State private var fallbackNote: String?
    @FocusState private var focused: Bool

    private static let scopes: [(ScriptureSearchScope, String)] = [
        (.all, "pages.read.scriptureSearchScopeAll"),
        (.old, "pages.read.scriptureSearchScopeOld"),
        (.new, "pages.read.scriptureSearchScopeNew"),
        (.chapter, "pages.read.scriptureSearchScopeChapter")
    ]

    private var parsedJump: ParsedScriptureRef? {
        ScriptureReferenceParser.parse(query)
    }

    var body: some View {
        GeometryReader { geo in
            ScrollView(showsIndicators: false) {
                LazyVStack(alignment: .leading, spacing: 0) {
                    // 顶置单手人体工学搜索栏（返回 + 搜索输入 + 一键清空 ×）
                    HStack(spacing: 10) {
                        Button(action: onBack) {
                            Image(systemName: "chevron.left")
                                .font(.system(size: 18, weight: .semibold))
                                .foregroundStyle(theme.ink)
                                .frame(width: 36, height: 42, alignment: .leading)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)

                        HStack(spacing: 8) {
                            Image(systemName: "magnifyingglass")
                                .font(.system(size: 15, weight: .medium))
                                .foregroundStyle(theme.muted)

                            TextField(AppLocale.pick("搜索经文，或输入如 约 3:16 直达…", "Search text or jump e.g. John 3:16…", locale), text: $query)
                                .askFont(size: 16)
                                .foregroundStyle(theme.ink)
                                .autocorrectionDisabled()
                                .textInputAutocapitalization(.never)
                                .submitLabel(.search)
                                .focused($focused)
                                .onChange(of: query) { _, _ in schedule() }
                                .onSubmit {
                                    if let jump = parsedJump {
                                        openParsedJump(jump)
                                    } else {
                                        rerun()
                                    }
                                }

                            if !query.isEmpty {
                                Button {
                                    query = ""
                                    results = []
                                    searched = false
                                    focused = true
                                } label: {
                                    Image(systemName: "xmark.circle.fill")
                                        .font(.system(size: 16))
                                        .foregroundStyle(theme.faint)
                                        .frame(width: 28, height: 28)
                                        .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, 12)
                        .frame(height: 44)
                        .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(theme.surface))
                        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(theme.borderStrong, lineWidth: 1))
                    }
                    .padding(.bottom, 12)

                    // 范围分段：全本 · 旧约 · 新约 · 本章
                    HStack(spacing: 2) {
                        ForEach(Self.scopes, id: \.0) { scope, label in
                            let on = prefs.scope == scope
                            Button { prefs.scope = scope; rerun() } label: {
                                Text(SiteCopy.t(label, locale))
                                    .askFont(size: 13.5, weight: on ? .semibold : .medium)
                                    .foregroundStyle(on ? theme.ink : theme.muted)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 8)
                                    .background(RoundedRectangle(cornerRadius: 8, style: .continuous).fill(on ? theme.surface : Color.clear))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(3)
                    .background(RoundedRectangle(cornerRadius: 11, style: .continuous).fill(theme.ink.opacity(0.06)))
                    .padding(.bottom, 14)

                    // 置顶：书卷章节智能直达卡（如输入「约 3:16」「诗 23」）
                    if let jump = parsedJump {
                        directJumpCard(jump)
                            .padding(.bottom, 14)
                    }

                    // 最近搜索横滑胶囊
                    if !prefs.recent.isEmpty && query.isEmpty {
                        Text(SiteCopy.t("pages.read.scriptureSearchRecentTitle", locale))
                            .askFont(size: 13, weight: .semibold)
                            .foregroundStyle(theme.muted)
                            .padding(.bottom, 8)

                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 7) {
                                ForEach(prefs.recent, id: \.self) { term in
                                    Button { query = term; debounce?.cancel(); rerun() } label: {
                                        Text(term)
                                            .askFont(size: 14, weight: .medium)
                                            .foregroundStyle(theme.ink)
                                            .lineLimit(1)
                                            .padding(.horizontal, 13)
                                            .padding(.vertical, 7)
                                            .background(Capsule().fill(theme.surface))
                                            .overlay(Capsule().strokeBorder(theme.border, lineWidth: 0.75))
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .padding(.horizontal, 20)
                        }
                        .padding(.horizontal, -20)
                        .padding(.bottom, 14)
                    }

                    if let fallbackNote {
                        Text(fallbackNote)
                            .askFont(size: 12.5)
                            .foregroundStyle(theme.faint)
                            .padding(.bottom, 8)
                    }
                    if prefs.scope == .chapter, chapterRef == nil {
                        Text(SiteCopy.t("pages.read.scriptureSearchNoChapterHint", locale))
                            .askFont(size: 14)
                            .foregroundStyle(theme.faint)
                            .padding(.vertical, 16)
                    }
                    if loading {
                        ProgressView().tint(theme.muted)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 24)
                    }
                    if !loading, searched, results.isEmpty, parsedJump == nil, !(prefs.scope == .chapter && chapterRef == nil) {
                        Text(SiteCopy.t("pages.read.scriptureSearchEmpty", locale))
                            .askFont(size: 15)
                            .foregroundStyle(theme.muted)
                            .frame(maxWidth: .infinity)
                            .padding(.top, 28)
                    }

                    if !loading, !results.isEmpty {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(SiteCopy.f("pages.read.scriptureSearchCount", ["count": "\(total)"], locale))
                            if total > results.count {
                                Text(SiteCopy.f("pages.read.scriptureSearchTruncated", ["limit": "\(results.count)"], locale))
                            }
                        }
                        .askFont(size: 12.5)
                        .foregroundStyle(theme.faint)
                        .padding(.bottom, 8)
                    }

                    ForEach(results) { hit in
                        Button {
                            let q = ScriptureSearchRules.normalize(query)
                            prefs.push(q)
                            onOpenHit(hit, q)
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("\(BibleCatalog.book(id: hit.bookId)?.name(locale) ?? hit.bookName) \(hit.chapter):\(hit.verse)")
                                    .askFont(size: 14, weight: .bold)
                                    .foregroundStyle(theme.ink)
                                let hitBuilt = hitText(hit.text)
                                RoundedHighlightText(text: hitBuilt.text, highlightRanges: hitBuilt.ranges,
                                                     fill: UIColor(theme.verseBookmarkMarker))
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.vertical, 12)
                            .overlay(alignment: .top) { Rectangle().fill(theme.border).frame(height: 1 / UIScreen.main.scale) }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 12)
                .padding(.bottom, ShellMetrics.tabBarClearance + 28 + geo.safeAreaInsets.bottom + 90)
            }
            .ignoresSafeArea(edges: .bottom)
            .parchmentFade(.tabbar)
            .scrollDismissesKeyboard(.interactively)
        }
        .background(ParchmentBackground(theme: theme).ignoresSafeArea())
        .onAppear {
            if let q = prefs.resumeQuery {
                prefs.resumeQuery = nil
                query = q
                rerun()
            } else {
                focused = true
            }
        }
    }

    private func directJumpCard(_ jump: ParsedScriptureRef) -> some View {
        let targetVerse = jump.verse ?? 1
        let fallbackId = store.searchFallbackId(for: store.translation.id) ?? store.translation.id
        let preview = store.verseText(translationId: fallbackId, bookId: jump.book.id, chapter: jump.chapter, verse: targetVerse) ?? ""
        let bName = jump.book.name(locale)
        let titleText: String = {
            if let v = jump.verse {
                return locale == .en ? "\(bName) \(jump.chapter):\(v)" : "\(bName) 第 \(jump.chapter) 章 \(v) 节"
            }
            return locale == .en ? "\(bName) Chapter \(jump.chapter)" : "\(bName) 第 \(jump.chapter) 章"
        }()

        return Button {
            openParsedJump(jump)
        } label: {
            VStack(alignment: .leading, spacing: 7) {
                HStack(spacing: 5) {
                    Image(systemName: "book.fill")
                        .font(.system(size: 10, weight: .bold))
                    Text(AppLocale.pick("书卷章节直达", "Direct Scripture Jump", locale))
                        .askFont(size: 11, weight: .bold)
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 9)
                .padding(.vertical, 3.5)
                .background(Capsule().fill(theme.accentOt))

                HStack {
                    Text(titleText)
                        .askFont(size: 17.5, weight: .bold)
                        .foregroundStyle(theme.ink)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(theme.accentOt)
                }

                if !preview.isEmpty {
                    Text(preview)
                        .askFont(size: 13.5)
                        .foregroundStyle(theme.muted)
                        .lineLimit(2)
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(theme.accentOt.opacity(0.14)))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(theme.accentOt, lineWidth: 1.2))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func openParsedJump(_ jump: ParsedScriptureRef) {
        let q = ScriptureSearchRules.normalize(query)
        prefs.push(q)
        let hit = ScriptureSearchHit(
            bookId: jump.book.id,
            bookName: jump.book.nameZh,
            chapter: jump.chapter,
            verse: jump.verse ?? 1,
            text: ""
        )
        onOpenHit(hit, "")
    }

    private func hitText(_ text: String) -> (text: NSAttributedString, ranges: [NSRange]) {
        let out = NSMutableAttributedString()
        var ranges: [NSRange] = []
        let para = NSMutableParagraphStyle()
        para.lineSpacing = 4
        para.lineBreakMode = .byWordWrapping
        for seg in ScriptureSearchRules.split(text, keyword: query) {
            let piece = NSAttributedString(string: seg.text, attributes: [
                .font: UIFont.systemFont(ofSize: 15.5, weight: seg.match ? .bold : .regular),
                .foregroundColor: UIColor(seg.match ? theme.ink : theme.muted),
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
            try? await Task.sleep(nanoseconds: 320_000_000)
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
        fallbackNote = fallbackId.flatMap { ScriptureTranslation.find($0) }.map { SiteCopy.f("native.searchFallbackNote", ["name": $0.label(locale)], locale) }
        let found = store.database(fallbackId ?? store.translation.id)?.search(query: q, scope: prefs.scope, chapterRef: chapterRef) ?? .empty
        results = found.hits
        total = found.total
        searched = true
        loading = false
    }
}
