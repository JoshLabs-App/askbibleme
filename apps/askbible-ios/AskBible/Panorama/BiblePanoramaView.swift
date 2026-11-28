import SwiftUI

/// 圣经全景（iOS）—— 严格复用与「今日同行」(PlanPlayView) 完全一致的羊皮卷实底、字体、页头与纸面卡片体系，
/// 彻底移除独立 WebView 第二套版面，确保全站除首页场景图外锁定唯一羊皮卷风格。
struct BiblePanoramaView: View {
    let locale: AppLocale
    let currentBook: String?
    let currentChapter: Int
    let locateRequest: Int
    var onResume: () -> Void
    var onRead: (String, Int) -> Void
    var onSelectTab: ((String) -> Void)? = nil
    var onBack: (() -> Void)? = nil

    @Environment(\.parchment) private var theme
    @State private var expandedActIndex: Int = 0
    @State private var query: String = ""

    private var currentLocation: (Int, PanoramaSection)? {
        guard let book = currentBook else { return nil }
        return BiblePanorama.shared.location(book, max(1, currentChapter))
    }

    private var subtitleText: String {
        if let bookId = currentBook,
           let book = BibleCatalog.book(bookId),
           let loc = currentLocation,
           BiblePanorama.shared.acts.indices.contains(loc.0) {
            let act = BiblePanorama.shared.acts[loc.0]
            let actName = locale.isZh ? locale.zh(act.zh) : act.en
            let bookName = book.name(locale)
            return locale.isZh
                ? "当前位置：\(actName) · \(bookName) 第 \(currentChapter) 章"
                : "You are here: \(actName) · \(bookName) \(currentChapter)"
        }
        return AppLocale.pick("六幕救赎历史 · 全本 66 卷脉络", "Six acts of Scripture · All 66 books", locale)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                // 顶栏：与 PlanPlayView 完全同一套 28pt Bold 标题 + 副标题 + 右侧圆角白底胶囊
                HStack(alignment: .center, spacing: 12) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(AppLocale.pick("圣经全景", "Bible Panorama", locale))
                            .askFont(size: 28, weight: .bold)
                            .foregroundStyle(theme.ink)
                        Text(subtitleText)
                            .askFont(size: 13.5, weight: .regular)
                            .foregroundStyle(theme.muted)
                            .lineLimit(1)
                    }
                    Spacer()
                    Button(action: onResume) {
                        Text(AppLocale.pick("回经文", "Read", locale))
                            .askFont(size: 12.5, weight: .semibold)
                            .foregroundStyle(theme.ink)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(Capsule().fill(theme.surface))
                            .overlay(Capsule().stroke(theme.border, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }

                // 统一羊皮纸检索框
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(theme.muted)
                    TextField(
                        AppLocale.pick("检索 66 卷书名或主题…", "Search all 66 books…", locale),
                        text: $query
                    )
                    .askFont(size: 14, weight: .regular)
                    .foregroundStyle(theme.ink)
                    if !query.isEmpty {
                        Button(AppLocale.pick("清除", "Clear", locale)) {
                            query = ""
                        }
                        .askFont(size: 12.5, weight: .medium)
                        .foregroundStyle(theme.muted)
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 11)
                .background(RoundedRectangle(cornerRadius: 16).fill(theme.surface.opacity(0.78)))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(theme.border, lineWidth: 0.75))

                HStack {
                    Text(AppLocale.pick("六幕故事", "Six Acts", locale))
                        .askFont(size: 18, weight: .bold)
                        .foregroundStyle(theme.ink)
                    Spacer()
                    Text(AppLocale.pick("点选书卷进入阅读", "Tap a book to read", locale))
                        .askFont(size: 12.5, weight: .regular)
                        .foregroundStyle(theme.muted)
                }
                .padding(.top, 2)

                ForEach(Array(BiblePanorama.shared.acts.enumerated()), id: \.offset) { index, act in
                    let isExpanded = expandedActIndex == index || !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                    let isCurrentAct = currentLocation?.0 == index
                    let actTitle = locale.isZh ? locale.zh(act.zh) : act.en
                    let actSub = locale.isZh ? locale.zh(act.subtitleZh) : act.subtitleEn

                    VStack(alignment: .leading, spacing: 10) {
                        Button {
                            withAnimation(.easeInOut(duration: 0.18)) {
                                expandedActIndex = expandedActIndex == index ? -1 : index
                            }
                        } label: {
                            HStack(spacing: 12) {
                                Text(String(format: "%02d", index + 1))
                                    .askFont(size: 14, weight: .bold)
                                    .foregroundStyle(isExpanded || isCurrentAct ? theme.accentOt : theme.faint)
                                    .frame(width: 26, alignment: .leading)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(actTitle)
                                        .askFont(size: 17, weight: .bold)
                                        .foregroundStyle(theme.ink)
                                    Text(actSub)
                                        .askFont(size: 13, weight: .regular)
                                        .foregroundStyle(theme.muted)
                                        .lineLimit(1)
                                }
                                Spacer()
                                Text(AppLocale.pick(isExpanded ? "收起" : "展开", isExpanded ? "Hide" : "Open", locale))
                                    .askFont(size: 12, weight: .semibold)
                                    .foregroundStyle(isExpanded ? theme.accentOt : theme.muted)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 4)
                                    .background(Capsule().fill(isExpanded ? theme.accentOt.opacity(0.12) : theme.border.opacity(0.35)))
                            }
                        }
                        .buttonStyle(.plain)

                        if isExpanded {
                            VStack(alignment: .leading, spacing: 10) {
                                ForEach(act.sections) { section in
                                    let secTitle = locale.isZh ? locale.zh(section.zh) : section.en
                                    let secSummary = locale.isZh ? locale.zh(section.summaryZh) : section.summaryEn
                                    let filteredSpans = section.spans.filter { span in
                                        let q = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                                        guard !q.isEmpty else { return true }
                                        guard let b = BibleCatalog.book(span.bookId) else { return false }
                                        return b.name(locale).lowercased().contains(q)
                                            || b.id.lowercased().contains(q)
                                            || secTitle.lowercased().contains(q)
                                    }
                                    if !filteredSpans.isEmpty {
                                        VStack(alignment: .leading, spacing: 6) {
                                            Text(secTitle)
                                                .askFont(size: 14.5, weight: .semibold)
                                                .foregroundStyle(theme.ink)
                                            Text(secSummary)
                                                .askFont(size: 12.5, weight: .regular)
                                                .foregroundStyle(theme.muted)
                                            LazyVGrid(columns: [GridItem(.adaptive(minimum: 92), spacing: 6)], alignment: .leading, spacing: 6) {
                                                ForEach(Array(filteredSpans.enumerated()), id: \.offset) { _, span in
                                                    if let b = BibleCatalog.book(span.bookId) {
                                                        let isHere = b.id == currentBook && (span.first...span.last).contains(currentChapter)
                                                        Button {
                                                            onRead(b.id, span.first)
                                                        } label: {
                                                            Text(b.name(locale))
                                                                .askFont(size: 12.5, weight: isHere ? .semibold : .medium)
                                                                .foregroundStyle(isHere ? Color(hex: 0xFFFBF4) : theme.ink)
                                                                .padding(.horizontal, 10)
                                                                .padding(.vertical, 5)
                                                                .background(Capsule().fill(isHere ? theme.accentOt : theme.surface))
                                                                .overlay(Capsule().stroke(isHere ? theme.accentOt : theme.border, lineWidth: 0.75))
                                                        }
                                                        .buttonStyle(.plain)
                                                    }
                                                }
                                            }
                                        }
                                        .padding(12)
                                        .background(RoundedRectangle(cornerRadius: 12).fill(theme.canvas.opacity(theme.isDark ? 0.38 : 0.48)))
                                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(theme.border.opacity(0.7), lineWidth: 0.75))
                                    }
                                }
                            }
                        }
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 12)
                    .background(RoundedRectangle(cornerRadius: 16).fill(isExpanded || isCurrentAct ? theme.surface : theme.surface.opacity(0.62)))
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(isCurrentAct ? theme.accentOt.opacity(0.55) : theme.border, lineWidth: isExpanded || isCurrentAct ? 1 : 0.75))
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 16)
            .padding(.bottom, ShellMetrics.tabRowHeight + ShellMetrics.tabBarDockGap + 64)
        }
        .background(ParchmentBackground(theme: theme).ignoresSafeArea())
        .onAppear {
            if let loc = currentLocation {
                expandedActIndex = loc.0
            }
        }
        .onChange(of: locateRequest) { _, _ in
            if let loc = currentLocation {
                expandedActIndex = loc.0
            }
        }
    }
}
