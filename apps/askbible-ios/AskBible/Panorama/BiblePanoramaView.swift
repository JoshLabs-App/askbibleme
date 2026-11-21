import SwiftUI

/// 救赎全景（灵修长卷 + 66 卷导览合璧版）：
/// 置顶「你正在这一幕」手绘线条画灵修坐标卡 + 书卷速查 + 纵向六幕呼吸时间轴 + 每一卷书在写什么（66 卷逐卷简介与章段直达）。
struct BiblePanoramaView: View {
    let locale: AppLocale
    let currentBook: String?
    let currentChapter: Int
    let locateRequest: Int
    var onResume: () -> Void
    var onRead: (String, Int) -> Void

    @Environment(\.parchment) private var theme
    @State private var activeAct: Int = 0
    @State private var expandedBookKey: String? = nil
    @State private var showQuickBookFinder = false
    @State private var quickFinderQuery = ""
    @State private var initialized = false

    private let data = BiblePanorama.shared
    private static let numeralsZh = ["壹", "贰", "叁", "肆", "伍", "陆"]

    private func t(_ zh: String, _ en: String) -> String { AppLocale.pick(zh, en, locale) }

    private var resolvedBookId: String { currentBook ?? "GEN" }
    private var resolvedChapter: Int { currentBook != nil ? max(1, currentChapter) : 1 }

    private var heroContext: (actIndex: Int, section: PanoramaSection, book: BookRef, chapter: Int) {
        let bId = resolvedBookId
        let ch = resolvedChapter
        let book = BibleCatalog.book(id: bId) ?? BibleCatalog.all[0]
        if let (idx, sec) = data.location(bId, ch) {
            return (idx, sec, book, ch)
        }
        let fallbackSec = data.acts[0].sections[0]
        return (0, fallbackSec, book, ch)
    }

    var body: some View {
        ZStack {
            ScrollViewReader { proxy in
                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 20) {
                        headerBlock(proxy: proxy)
                        heroLocationCard
                        timelineSection
                        footerNote
                    }
                    .padding(.horizontal, 22)
                    .padding(.top, 26)
                    .padding(.bottom, ShellMetrics.tabBarClearance + 110)
                }
                .parchmentFade(.tabbar)
                .onAppear {
                    if !initialized {
                        initialized = true
                        activeAct = heroContext.actIndex
                    }
                }
                .onChange(of: locateRequest) { _, _ in
                    let idx = heroContext.actIndex
                    withAnimation(.easeInOut(duration: 0.28)) { activeAct = idx }
                    withAnimation(.easeInOut(duration: 0.35)) { proxy.scrollTo("act-\(idx)", anchor: .center) }
                }
                .onChange(of: "\(currentBook ?? ""):\(currentChapter)") { _, _ in
                    activeAct = heroContext.actIndex
                }
            }

            if showQuickBookFinder {
                quickBookFinderOverlay
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(ParchmentBackground(theme: theme).ignoresSafeArea())
        .foregroundStyle(theme.ink)
    }

    private func headerBlock(proxy: ScrollViewProxy) -> some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 5) {
                Text(t("救赎全景", "Redemption Story"))
                    .askFont(size: 28, weight: .bold)
                    .foregroundStyle(theme.ink)
                Text(t("在完整的救赎故事中，读懂每一卷书在写什么", "Understand what every book of Scripture is about within one redemptive story"))
                    .askFont(size: 13.5)
                    .foregroundStyle(theme.muted)
            }
            Spacer(minLength: 4)
            Button {
                quickFinderQuery = ""
                showQuickBookFinder = true
            } label: {
                HStack(spacing: 5) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 12, weight: .semibold))
                    Text(t("书卷速查", "66 Books"))
                        .askFont(size: 12.5, weight: .semibold)
                }
                .foregroundStyle(theme.accentOt)
                .padding(.horizontal, 11)
                .padding(.vertical, 8)
                .background(Capsule().fill(theme.surface))
                .overlay(Capsule().strokeBorder(theme.borderStrong, lineWidth: 0.85))
                .contentShape(Capsule())
            }
            .buttonStyle(.plain)
            .padding(.top, 4)
        }
    }

    /// 首屏置顶：「你正在这一幕」灵修坐标卡
    private var heroLocationCard: some View {
        let ctx = heroContext
        let act = data.acts[ctx.actIndex]
        let actOrd = locale == .en ? "Act \(ctx.actIndex + 1)" : "第\(ctx.actIndex + 1)幕"
        let hasHistory = currentBook != nil

        return VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 14) {
                VStack(alignment: .leading, spacing: 7) {
                    Text("✦ " + t("你正在这一幕 · \(actOrd)", "You are here · \(actOrd)"))
                        .askFont(size: 11.5, weight: .semibold)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(Capsule().fill(theme.accentOt))

                    Text(t(act.zh, act.en) + " · " + t(ctx.section.zh, ctx.section.en))
                        .askFont(size: 19, weight: .bold)
                        .foregroundStyle(theme.ink)

                    Text(t(ctx.section.summaryZh, ctx.section.summaryEn))
                        .askFont(size: 13)
                        .lineSpacing(3.5)
                        .foregroundStyle(theme.muted)
                        .lineLimit(3)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                PanoramaLineArt(stage: ctx.actIndex)
                    .stroke(theme.accentOt, lineWidth: 1.35)
                    .frame(width: 62, height: 68)
                    .padding(.top, 4)
                    .accessibilityHidden(true)
            }

            Button {
                if hasHistory {
                    onResume()
                } else {
                    onRead(ctx.book.id, ctx.chapter)
                }
            } label: {
                HStack {
                    Text(
                        hasHistory
                        ? t("接着阅读 · \(ctx.book.name(locale)) 第\(ctx.chapter)章", "Continue · \(ctx.book.name(locale)) \(ctx.chapter)")
                        : t("从起初进入 · 创世记 第1章", "Begin · Genesis 1")
                    )
                    .askFont(size: 14, weight: .semibold)
                    Spacer(minLength: 8)
                    Image(systemName: "chevron.right")
                        .font(.system(size: 12, weight: .bold))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(theme.accentOt))
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(theme.borderStrong, lineWidth: 1))
        .shadow(color: Color.black.opacity(theme.isDark ? 0.26 : 0.06), radius: 12, y: 4)
    }

    /// 纵向贯穿救赎时间轴
    private var timelineSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(data.acts.indices, id: \.self) { index in
                timelineActRow(index: index)
                    .id("act-\(index)")
            }
        }
        .padding(.leading, 10)
        .overlay(alignment: .leading) {
            Rectangle()
                .fill(theme.accentOt.opacity(0.35))
                .frame(width: 1.5)
                .padding(.vertical, 22)
                .offset(x: 4)
        }
    }

    private func timelineActRow(index: Int) -> some View {
        let act = data.acts[index]
        let isOpen = activeAct == index
        let isCurrent = heroContext.actIndex == index
        let badge = locale == .en ? "\(index + 1)" : (index < Self.numeralsZh.count ? Self.numeralsZh[index] : "\(index + 1)")

        return HStack(alignment: .top, spacing: 12) {
            Circle()
                .fill(isOpen ? theme.accentOt : theme.canvas)
                .frame(width: 10, height: 10)
                .overlay(Circle().strokeBorder(theme.accentOt, lineWidth: 2))
                .padding(.top, 18)
                .offset(x: -10.5)

            VStack(alignment: .leading, spacing: 12) {
                Button {
                    withAnimation(.easeInOut(duration: 0.25)) {
                        activeAct = (activeAct == index) ? -1 : index
                    }
                } label: {
                    HStack(spacing: 10) {
                        Text(badge)
                            .askFont(size: 12, weight: .bold)
                            .foregroundStyle(isOpen ? .white : theme.accentOt)
                            .frame(width: 24, height: 24)
                            .background(
                                RoundedRectangle(cornerRadius: 6, style: .continuous)
                                    .fill(isOpen ? theme.accentOt : theme.accentOt.opacity(0.14))
                            )

                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: 6) {
                                Text(t(act.zh, act.en))
                                    .askFont(size: 17, weight: .bold)
                                    .foregroundStyle(theme.ink)
                                Text("· " + t(act.subtitleZh, act.subtitleEn))
                                    .askFont(size: 13.5, weight: .medium)
                                    .foregroundStyle(theme.muted)
                                    .lineLimit(1)
                            }
                            if isCurrent && !isOpen {
                                Text(t("你正在这里", "You are here"))
                                    .askFont(size: 11, weight: .semibold)
                                    .foregroundStyle(theme.accentOt)
                            }
                        }
                        Spacer(minLength: 4)
                        Image(systemName: isOpen ? "chevron.up" : "chevron.down")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(theme.faint)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                if isOpen {
                    VStack(alignment: .leading, spacing: 18) {
                        ForEach(act.sections) { section in
                            sectionDevotionalBlock(section)
                        }
                    }
                    .padding(.top, 2)
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(isOpen ? theme.surface : theme.surface.opacity(0.45))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(isOpen ? theme.accentOt.opacity(0.55) : theme.border, lineWidth: isOpen ? 1 : 0.75)
            )
        }
    }

    private func sectionDevotionalBlock(_ section: PanoramaSection) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(t(section.zh, section.en))
                .askFont(size: 15, weight: .bold)
                .foregroundStyle(theme.accentOt)

            Text(t(section.summaryZh, section.summaryEn))
                .askFont(size: 13.5)
                .lineSpacing(3.5)
                .foregroundStyle(theme.muted)

            // 灵修核心脉络书签直达卡
            if let note = data.notes[section.id], !note.links.isEmpty {
                VStack(spacing: 7) {
                    ForEach(note.links.indices, id: \.self) { i in
                        let link = note.links[i]
                        let bName = BibleCatalog.book(id: link.bookId)?.name(locale) ?? link.bookId
                        let refStr = "\(bName) \(link.chapter)" + (link.verses.isEmpty ? "" : ":\(link.verses)")
                        Button {
                            onRead(link.bookId, link.chapter)
                        } label: {
                            HStack(spacing: 10) {
                                Image(systemName: "book")
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundStyle(theme.accentOt)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(t(link.kindZh, link.kindEn) + " · " + refStr)
                                        .askFont(size: 13.5, weight: .semibold)
                                        .foregroundStyle(theme.ink)
                                    Text(t(link.reasonZh, link.reasonEn))
                                        .askFont(size: 12)
                                        .foregroundStyle(theme.muted)
                                        .lineLimit(2)
                                }
                                Spacer(minLength: 4)
                                Image(systemName: "chevron.right")
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundStyle(theme.accentOt)
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 9)
                            .background(RoundedRectangle(cornerRadius: 11, style: .continuous).fill(theme.canvas.opacity(0.65)))
                            .overlay(RoundedRectangle(cornerRadius: 11, style: .continuous).strokeBorder(theme.border, lineWidth: 0.75))
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            // 每一卷书在写什么：逐卷导览卡片（书名 + 章数范围 + 全卷核心主旨简介 + 可展开经文线索与选章）
            VStack(spacing: 9) {
                ForEach(section.spans.indices, id: \.self) { i in
                    let span = section.spans[i]
                    if let book = BibleCatalog.book(id: span.bookId) {
                        bookSummaryCard(sectionId: section.id, book: book, span: span)
                    }
                }
            }
            .padding(.top, 2)
        }
        .padding(.top, 4)
    }

    private func bookSummaryCard(sectionId: String, book: BookRef, span: PanoramaSpan) -> some View {
        let cardKey = "\(sectionId):\(book.id):\(span.first)-\(span.last)"
        let expanded = expandedBookKey == cardKey
        let intro = data.introductions[book.id]
        let spanBadge: String = {
            if span.first == 1 && span.last == book.chapterCount {
                return locale == .en ? "\(book.chapterCount) chs" : "共 \(book.chapterCount) 章"
            }
            return locale == .en ? "Ch. \(span.first)–\(span.last)" : "第 \(span.first)–\(span.last) 章"
        }()
        let isReadingThisSpan = currentBook == book.id && (span.first...span.last).contains(currentChapter)
        let cols = Array(repeating: GridItem(.flexible(), spacing: 7), count: 6)

        return VStack(alignment: .leading, spacing: 9) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    expandedBookKey = expanded ? nil : cardKey
                }
            } label: {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 8) {
                        Text(book.name(locale))
                            .askFont(size: 15.5, weight: .bold)
                            .foregroundStyle(theme.ink)
                        Text(spanBadge)
                            .askFont(size: 11.5, weight: .semibold)
                            .foregroundStyle(theme.accentOt)
                            .padding(.horizontal, 7)
                            .padding(.vertical, 2)
                            .background(Capsule().fill(theme.accentOt.opacity(0.13)))
                        if isReadingThisSpan {
                            Text(t("在读", "Reading"))
                                .askFont(size: 10.5, weight: .bold)
                                .foregroundStyle(.white)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Capsule().fill(theme.accentOt))
                        }
                        Spacer(minLength: 4)
                        Text(expanded ? t("收起", "Hide") : t("选章 ›", "Chapters ›"))
                            .askFont(size: 12, weight: .semibold)
                            .foregroundStyle(theme.accentOt)
                    }

                    if let intro {
                        Text(t(intro.zh, intro.en))
                            .askFont(size: 13.5)
                            .lineSpacing(3.5)
                            .foregroundStyle(theme.inkSoft)
                            .multilineTextAlignment(.leading)
                    }
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if expanded {
                Divider().overlay(theme.border)

                if let refs = intro?.references, !refs.isEmpty {
                    Text(t("核心经文线索：", "Key passages: ") + refs)
                        .askFont(size: 12)
                        .foregroundStyle(theme.muted)
                        .lineSpacing(3)
                }

                LazyVGrid(columns: cols, spacing: 7) {
                    ForEach(span.first...span.last, id: \.self) { ch in
                        let isCurCh = currentBook == book.id && currentChapter == ch
                        Button {
                            onRead(book.id, ch)
                        } label: {
                            Text("\(ch)")
                                .askFont(size: 14.5, weight: isCurCh ? .bold : .semibold)
                                .foregroundStyle(isCurCh ? .white : theme.ink)
                                .frame(maxWidth: .infinity)
                                .frame(height: 36)
                                .background(
                                    RoundedRectangle(cornerRadius: 8)
                                        .fill(isCurCh ? theme.accentOt : theme.chapterCellPressed)
                                )
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .strokeBorder(isCurCh ? theme.accentOt : theme.chapterCellBorder, lineWidth: 0.85)
                                )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.top, 2)
            } else {
                HStack {
                    Button {
                        onRead(book.id, span.first)
                    } label: {
                        HStack(spacing: 4) {
                            Text(span.first == 1
                                 ? t("读第 1 章", "Read Ch. 1")
                                 : t("读第 \(span.first) 章", "Read Ch. \(span.first)"))
                                .askFont(size: 12, weight: .semibold)
                            Image(systemName: "arrow.right")
                                .font(.system(size: 10, weight: .bold))
                        }
                        .foregroundStyle(theme.accentOt)
                    }
                    .buttonStyle(.plain)
                    Spacer()
                }
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 13, style: .continuous)
                .fill(theme.canvas.opacity(theme.isDark ? 0.55 : 0.72))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 13, style: .continuous)
                .strokeBorder(isReadingThisSpan ? theme.accentOt.opacity(0.65) : theme.border, lineWidth: isReadingThisSpan ? 1.1 : 0.75)
        )
    }

    private var footerNote: some View {
        Text(t("六幕是救赎历史灵修导览，帮助你在整本圣经的大故事里读懂每一卷书。", "The six acts trace one redemptive arc and introduce every book of Scripture."))
            .askFont(size: 12)
            .foregroundStyle(theme.faint)
            .padding(.top, 4)
    }

    private var quickBookFinderOverlay: some View {
        let q = quickFinderQuery.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let filtered = BibleCatalog.all.filter { b in
            guard !q.isEmpty else { return true }
            let intro = data.introductions[b.id]
            return b.name(locale).lowercased().contains(q)
                || b.name(.en).lowercased().contains(q)
                || b.id.lowercased().contains(q)
                || (intro?.zh.lowercased().contains(q) ?? false)
                || (intro?.en.lowercased().contains(q) ?? false)
        }
        return ZStack {
            theme.modalBackdrop
                .ignoresSafeArea()
                .onTapGesture { showQuickBookFinder = false }

            VStack(spacing: 12) {
                HStack {
                    Text(t("66 卷书都在写什么", "66 Books Overview"))
                        .askFont(size: 18, weight: .bold)
                        .foregroundStyle(theme.ink)
                    Spacer()
                    Button { showQuickBookFinder = false } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(theme.muted)
                            .frame(width: 34, height: 34)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }

                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 14))
                        .foregroundStyle(theme.muted)
                    TextField(t("搜书名或主题关键词…", "Search book or theme…"), text: $quickFinderQuery)
                        .askFont(size: 14)
                }
                .padding(.horizontal, 12)
                .frame(height: 38)
                .background(RoundedRectangle(cornerRadius: 10).fill(theme.canvas.opacity(0.75)))
                .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(theme.border, lineWidth: 0.85))

                ScrollView(showsIndicators: false) {
                    LazyVStack(alignment: .leading, spacing: 8) {
                        ForEach(filtered) { b in
                            let intro = data.introductions[b.id]
                            Button {
                                showQuickBookFinder = false
                                onRead(b.id, 1)
                            } label: {
                                VStack(alignment: .leading, spacing: 4) {
                                    HStack {
                                        Text("\(b.displayNumber) · \(b.name(locale))")
                                            .askFont(size: 15, weight: .bold)
                                            .foregroundStyle(theme.ink)
                                        Spacer()
                                        Text(t("进入阅读 ›", "Read ›"))
                                            .askFont(size: 12, weight: .semibold)
                                            .foregroundStyle(theme.accentOt)
                                    }
                                    if let intro {
                                        Text(t(intro.zh, intro.en))
                                            .askFont(size: 13)
                                            .lineSpacing(3)
                                            .foregroundStyle(theme.muted)
                                            .multilineTextAlignment(.leading)
                                    }
                                }
                                .padding(11)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(RoundedRectangle(cornerRadius: 11).fill(theme.surface))
                                .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(theme.border, lineWidth: 0.75))
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .frame(maxHeight: 440)
            }
            .padding(16)
            .parchmentCard(cornerRadius: 22)
            .padding(.horizontal, 16)
            .onTapGesture {}
        }
    }
}

struct PanoramaLineArt: Shape {
    let stage: Int
    func path(in rect: CGRect) -> Path {
        var p = Path()
        func line(_ x: CGFloat, _ y: CGFloat, _ a: CGFloat, _ b: CGFloat) {
            p.move(to: CGPoint(x: x, y: y))
            p.addLine(to: CGPoint(x: a, y: b))
        }
        line(5, 70, 95, 70)
        switch stage {
        case 0, 1, 5:
            line(48, 69, 50, 24); line(50, 47, 28, 28); line(50, 43, 73, 22); line(50, 35, 43, 15)
            if stage != 1 {
                for (x, y) in [(25, 24), (40, 18), (57, 16), (73, 23), (34, 36), (65, 36)] {
                    p.addEllipse(in: CGRect(x: x - 12, y: y - 12, width: 24, height: 24))
                }
            }
            if stage == 5 {
                p.move(to: CGPoint(x: 58, y: 70))
                p.addCurve(to: CGPoint(x: 40, y: 80), control1: CGPoint(x: 95, y: 72), control2: CGPoint(x: 15, y: 73))
            }
        case 2:
            line(17, 64, 48, 24); line(48, 24, 80, 64); line(80, 64, 17, 64); line(48, 24, 48, 64); line(48, 24, 63, 64)
            for (x, y) in [(15, 14), (72, 10), (87, 28), (35, 7)] {
                line(CGFloat(x - 3), CGFloat(y), CGFloat(x + 3), CGFloat(y))
                line(CGFloat(x), CGFloat(y - 3), CGFloat(x), CGFloat(y + 3))
            }
        case 3:
            line(48, 65, 48, 8); line(30, 25, 67, 25)
        default:
            for (x, y) in [(25, 14), (70, 8), (96, 28)] {
                p.move(to: CGPoint(x: 48, y: 70))
                p.addQuadCurve(to: CGPoint(x: x, y: y), control: CGPoint(x: 60, y: 45))
                line(CGFloat(x - 6), CGFloat(y + 9), CGFloat(x), CGFloat(y))
                line(CGFloat(x), CGFloat(y), CGFloat(x + 5), CGFloat(y + 9))
            }
        }
        return p.applying(CGAffineTransform(scaleX: rect.width / 100, y: rect.height / 80))
    }
}
