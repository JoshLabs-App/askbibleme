import SwiftUI

/// 阅读章页。版式逐项对齐 RN 的 ReadChapterScreen（verseParagraphFlow 连排模式）：
/// 「书名 第N章」标题 + 细线、按 chapter-segments 分段连排、小标题居中、段间 16 / 带小标题 22 + 96 细线、
/// 结尾「‹ 第N章 | 书名 | 第N章 ›」+ 渐变收尾。
struct ChapterView: View {
    let bookId: String
    /// 按读经展示语言取好的书名（中文译本中文名 / 英文译本英文名）
    let bookName: String
    /// 读经展示语言（RN readDisplayLocale）：标题格式、小标题、章末「第N章 / Chapter N」、读后两版都按它
    var locale: AppLocale = .zhCN
    /// 界面语言（读后两版这类「只有中文内容」的模块按它决定出不出，不跟译本语言）
    var uiLocale: AppLocale = .zhCN
    /// 译本语言既不是中文也不是英文：章标题用「Génesis 1」，段落小标题不出（没有这个语种的）
    var foreignText: Bool = false
    let bookNumber: Int
    let chapter: Int
    @Binding var size: ReadSize
    var onBack: () -> Void = {}
    var onOpenSettings: () -> Void = {}
    @ObservedObject var audio: ChapterAudioPlayer
    @ObservedObject var bookmarks: VerseBookmarkStore
    /// 从搜索 / 收藏跳进来要定位并标出的那节
    var focusVerse: Int?
    /// 点了哪一节的节号 → 弹 xref 详情
    var onTapVerse: (Int) -> Void = { _ in }
    var onOpenSearch: () -> Void = {}
    var onOpenFavorites: () -> Void = {}
    /// 双击正文 → 收藏 / 取消收藏；长按 → 操作单。弹层与轻提示由 RootView 出（章页里出会被坞 + 底栏宿主盖住）
    var onDoubleTapVerse: (LoadedVerse) -> Void = { _ in }
    var onLongPressVerse: (LoadedVerse) -> Void = { _ in }
    /// 结尾中间的书名 → 回目录
    var onOpenCatalog: () -> Void = {}
    /// 结尾左右的上一章 / 下一章（可跨卷）
    var onNavigate: (_ bookId: String, _ chapter: Int) -> Void = { _, _ in }

    private let theme = Parchment.light
    @EnvironmentObject private var store: ScriptureStore
    @State private var verses: [LoadedVerse] = []
    @State private var xrefVerses: Set<Int> = []
    @State private var contrast: [Int: String] = [:]
    @State private var meta: ChapterSegmentMeta = .empty
    /// 章末「读后两版」当前展开的是哪一版；换章清空
    @State private var activeEdition: InfoEditionVariant?
    /// 搜索定位标记：进来时亮着，用户一动某节就灭
    @State private var searchFocus: Int?
    /// 在线 / 下载型译本要等网络：loading 时给转圈，抓不到给「重试」
    enum LoadState { case idle, loading, failed }
    @State private var loadState: LoadState = .idle
    @State private var reloadToken = 0

    private var bookmarkedVerses: Set<Int> { bookmarks.bookmarkedVerses(translationId: store.translation.id, bookId: bookId, chapter: chapter) }

    private var groups: [[LoadedVerse]] { ChapterSegments.paragraphGroups(verses, meta: meta) }
    private var neighbors: (prev: ChapterNeighbor?, next: ChapterNeighbor?) { ChapterNeighbor.resolve(bookId: bookId, chapter: chapter) }

    var body: some View {
        let m = size.metrics
        let groups = self.groups
        ZStack(alignment: .topLeading) {
            ScrollViewReader { proxy in
                ScrollView(showsIndicators: false) {
                    VStack(spacing: 0) {
                        // 换章滚回顶部的锚点：放在最顶上的零高视图上，锚在标题上会把标题顶到视口边缘（把 59 的顶距滚没了）
                        Color.clear.frame(height: 0).id("chapter-top")
                        // header：paddingTop 4 / paddingBottom 24 / 细线 / marginBottom 12（readChapterScreenLayoutStyles.header）
                        VStack(spacing: 0) {
                            Text(ReadChrome.chapterTitle(bookName: bookName, chapter: chapter, locale: foreignText ? .en : locale))
                                .font(.system(size: m.chapterTitleSize, weight: .semibold))
                                .foregroundStyle(theme.ink)
                                .multilineTextAlignment(.center)
                                .frame(maxWidth: .infinity)
                                .padding(.horizontal, 42)
                                .padding(.top, 4)
                                .padding(.bottom, 24)
                            Rectangle().fill(theme.border).frame(height: 1 / UIScreen.main.scale)
                        }
                        .padding(.top, 59)
                        .padding(.bottom, 12)

                        if let message = store.lastError {
                            Text(message)
                                .font(.system(size: 14))
                                .foregroundStyle(Color(rgb: 0x994812))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                        }

                        chapterStatus
                        ForEach(groups.indices, id: \.self) { gi in
                            paragraphBlock(groups[gi], index: gi, metrics: m)
                                .id(gi)
                        }

                        // 在线译本的版权声明（YouVersion 条款要求展示；内置译本没有这一行）
                        if let copyright = RemoteTranslations.attribution(store.translation.id, locale) {
                            Text(copyright)
                                .font(.system(size: 12)).lineSpacing(4)
                                .foregroundStyle(theme.faint)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.horizontal, 20).padding(.top, 18)
                        }

                        endingSection()

                        // 读后两版入口：陪你探索 / 查找资料（RN ReadChapterPostReadingEditions）。
                        // 库里中英两套都有：读英文译本（RN prefersEnglishInfoEdition）或界面是英文 → 英文那套；
                        // 其余（含西班牙语等没有对应语种内容的版本）跟界面语言走中文那套（Josh 2026-09-10）
                        do {
                            let n = neighbors
                            PostReadingEditions(
                                bookId: bookId, chapter: chapter, size: size, theme: theme,
                                prev: n.prev, next: n.next,
                                onNavigate: onNavigate,
                                onBackToTop: { withAnimation(.easeInOut(duration: 0.35)) { proxy.scrollTo("chapter-top", anchor: .top) } },
                                active: $activeEdition,
                                english: locale == .en || uiLocale == .en
                            )
                            .environment(\.openURL, OpenURLAction { url in
                                if case .chapter(let b, let c, _) = ArticleLink.resolve(url) { onNavigate(b, c); return .handled }
                                return .systemAction
                            })
                        }
                    }
                    .padding(.horizontal, 20)
                }
                .shellBottomInset(hasDock: true)
                .parchmentFade(.chapter)
                // 换章回到顶部：ScrollView 身份没变，不主动滚回去会停在上一章的滚动位置（计划流顺章时标题在屏外）
                .onChange(of: "\(bookId).\(chapter)") { _, _ in proxy.scrollTo("chapter-top", anchor: .top) }
                .onChange(of: verses) { _, _ in
                    // 搜索 / 收藏跳进来：经文装好后滚到那节所在的段
                    guard let f = focusVerse, let gi = groups.firstIndex(where: { $0.contains { $0.number == f } }) else { return }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { proxy.scrollTo(gi, anchor: .center) }
                }
                .onChange(of: audio.activeVerse) { _, verse in
                    // 跟读时把当前节所在的段滚到视野中部；用户手动滚动不打断（只在播放中跟随）
                    guard let verse, audio.isPlaying,
                          let gi = groups.firstIndex(where: { $0.contains { $0.number == verse } }) else { return }
                    withAnimation(.easeInOut(duration: 0.35)) { proxy.scrollTo(gi, anchor: .center) }
                }
            }

            topChrome()
        }
        .background(ParchmentBackground(theme: theme).ignoresSafeArea())
        .task(id: "\(store.translation.id).\(store.secondary?.id ?? "-").\(bookId).\(chapter).\(reloadToken)") {
            activeEdition = nil
            searchFocus = focusVerse
            xrefVerses = store.versesWithXrefs(bookId: bookId, chapter: chapter)
            let m = ChapterSegments.meta(bookId: bookId, chapter: chapter, english: locale == .en)
            // 西语等版本：段落照分，小标题不出（我们只有中英两套）
            meta = foreignText ? ChapterSegmentMeta(headings: [:], paragraphStarts: m.paragraphStarts) : m
            loadState = .loading
            let loaded = await store.loadChapterAsync(translationId: store.translation.id, bookId: bookId, chapter: chapter)
            if Task.isCancelled { return }
            verses = loaded ?? []
            loadState = loaded == nil ? .failed : .idle
            if let sec = store.secondary, sec.id != store.translation.id {
                let rows = await store.loadChapterAsync(translationId: sec.id, bookId: bookId, chapter: chapter) ?? []
                if Task.isCancelled { return }
                contrast = Dictionary(rows.map { ($0.number, $0.text) }, uniquingKeysWith: { a, _ in a })
            } else {
                contrast = [:]
            }
        }
    }

    /// 在线 / 下载型译本取数中或失败时的提示（内置译本瞬时读库，不会看到）
    @ViewBuilder private var chapterStatus: some View {
        if verses.isEmpty, loadState == .loading {
            HStack(spacing: 10) {
                ProgressView().tint(theme.muted)
                Text(ScriptureTranslation.find(store.translation.id)?.delivery == .download ? SiteCopy.t("native.translationDownloading", locale) : SiteCopy.t("native.chapterFetching", locale))
                    .font(.system(size: 15)).foregroundStyle(theme.muted)
            }
            .frame(maxWidth: .infinity).padding(.vertical, 40)
        } else if verses.isEmpty, loadState == .failed {
            VStack(spacing: 12) {
                Text(SiteCopy.t("native.translationOfflineHint", locale))
                    .font(.system(size: 15)).foregroundStyle(theme.muted).multilineTextAlignment(.center)
                Button { reloadToken += 1 } label: {
                    Text(SiteCopy.t("pages.read.retry", locale)).font(.system(size: 15, weight: .semibold)).foregroundStyle(theme.ink)
                        .padding(.horizontal, 18).padding(.vertical, 9)
                        .background(Capsule().fill(theme.surface))
                        .overlay(Capsule().strokeBorder(theme.border, lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
            .frame(maxWidth: .infinity).padding(.vertical, 40).padding(.horizontal, 24)
        }
    }

    /// 一个段落：段前分隔（首段没有；带小标题时 22 高 + 96 宽细线，否则 16 空）→ 小标题 → 连排正文 → 副译本对照
    @ViewBuilder
    private func paragraphBlock(_ group: [LoadedVerse], index: Int, metrics m: ReadTypographyMetrics) -> some View {
        let headings = group.first.flatMap { meta.headings[$0.number] } ?? []
        VStack(spacing: 0) {
            if index > 0 {
                if headings.isEmpty {
                    Color.clear.frame(height: 16)
                } else {
                    Capsule().fill(theme.border)
                        .frame(width: 96, height: 1 / UIScreen.main.scale)
                        .frame(height: 22)
                }
            }
            ForEach(headings.indices, id: \.self) { i in
                // segmentHeading：字号 +1、行高 +2、#70451F、600、字距 0.3、居中、上 18 下 16
                Text(locale.zh(headings[i]))
                    .font(.system(size: m.verseFontSize + 1, weight: .semibold))
                    .tracking(0.3)
                    .foregroundStyle(Color(rgb: 0x70451F))
                    .opacity(0.92)
                    .multilineTextAlignment(.center)
                    .lineSpacing(max(0, m.verseLineHeight + 2 - (m.verseFontSize + 1)))
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, 12)
                    .padding(.top, 18)
                    .padding(.bottom, 16)
            }
            ChapterFlowParagraph(
                verses: group, metrics: m, theme: theme, xrefVerses: xrefVerses,
                activeVerse: audio.activeVerse,
                bookmarked: bookmarkedVerses,
                searchFocus: searchFocus,
                onTapVerseNumber: { v in searchFocus = nil; if xrefVerses.contains(v) { onTapVerse(v) } },
                onDoubleTapVerse: { v in searchFocus = nil; if let lv = group.first(where: { $0.number == v }) { onDoubleTapVerse(lv) } },
                onLongPressVerse: { v in searchFocus = nil; if let lv = group.first(where: { $0.number == v }) { onLongPressVerse(lv) } }
            )
            .frame(maxWidth: .infinity, alignment: .leading)
            // 副译本对照行：0.82× 字号，muted（verseContrast）
            ForEach(group.filter { contrast[$0.number] != nil }) { v in
                contrastLine(v, metrics: m)
            }
        }
        .padding(.bottom, 14)  // verseParagraphBlock.marginBottom
    }

    private func contrastLine(_ v: LoadedVerse, metrics m: ReadTypographyMetrics) -> some View {
        let fontSize: CGFloat = m.verseFontSize * 0.82
        let lineHeight: CGFloat = max(m.verseLineHeight * 0.78, fontSize * 1.2)
        let body: String = contrast[v.number] ?? ""
        return Text("\(v.number)\u{2002}\(body)")
            .font(.system(size: fontSize))
            .foregroundStyle(theme.muted)
            .lineSpacing(max(0, lineHeight - fontSize))
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 7)
    }

    /// 结尾：endNav（上 80 下 50）+ 收尾渐变（28 高，贴满屏宽）+ 段尾 30
    private func endingSection() -> some View {
        let n = neighbors
        return VStack(spacing: 0) {
            HStack(spacing: 8) {
                HStack(spacing: 0) {
                    if let p = n.prev {
                        Button { onNavigate(p.bookId, p.chapter) } label: {
                            // RN：MaterialIcons chevron-left 16 + 13/500，颜色 breadcrumbColor = faint
                            HStack(spacing: 2) {
                                MaterialIcon(glyph: MI.chevronLeft, size: 16, color: theme.faint)
                                Text(ReadChrome.chapterLabel(p.chapter, locale: locale)).font(.system(size: 13, weight: .medium))
                            }
                            .foregroundStyle(theme.faint)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Button(action: onOpenCatalog) {
                    Text(bookName)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(theme.ink)
                        .lineLimit(1)
                        .padding(.horizontal, 4)
                        .frame(maxWidth: 120)
                }
                .buttonStyle(.plain)
                HStack(spacing: 0) {
                    if let nx = n.next {
                        Button { onNavigate(nx.bookId, nx.chapter) } label: {
                            HStack(spacing: 2) {
                                Text(ReadChrome.chapterLabel(nx.chapter, locale: locale)).font(.system(size: 13, weight: .medium))
                                MaterialIcon(glyph: MI.chevronRight, size: 16, color: theme.faint)
                            }
                            .foregroundStyle(theme.faint)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .trailing)
            }
            .padding(.top, 80)
            .padding(.bottom, 50)

            // scriptureClosingDivider：rgba(78,52,30) .22 → .14 → .07 → .03 → 0，宽 = 屏宽
            LinearGradient(
                stops: [
                    .init(color: Color(red: 78 / 255, green: 52 / 255, blue: 30 / 255, opacity: 0.22), location: 0),
                    .init(color: Color(red: 78 / 255, green: 52 / 255, blue: 30 / 255, opacity: 0.14), location: 0.28),
                    .init(color: Color(red: 78 / 255, green: 52 / 255, blue: 30 / 255, opacity: 0.07), location: 0.58),
                    .init(color: Color(red: 78 / 255, green: 52 / 255, blue: 30 / 255, opacity: 0.03), location: 0.82),
                    .init(color: Color(red: 78 / 255, green: 52 / 255, blue: 30 / 255, opacity: 0), location: 1),
                ],
                startPoint: .top, endPoint: .bottom
            )
            .frame(height: 28)
            .frame(minHeight: 34)
            .padding(.horizontal, -20)
            .padding(.bottom, 14)
        }
        .padding(.bottom, 30)
    }

    /// 左上返回 + 右上竖排。位置来自 `readTopChrome.ts`：
    /// 第 index 个按钮顶边 = safeTop + 6 + index × (50 + 5)，右边距 8，图标 32，白色带阴影。
    private func topChrome() -> some View {
        HStack(alignment: .top) {
            // RN 的返回是 React Navigation HeaderBackButton：iOS 上是系统 chevron，Android 才是 arrow-back
            chromeButton(systemName: "chevron.left", action: onBack)
            Spacer()
            VStack(spacing: ShellMetrics.topChromeGap) {
                chromeGlyph(MI.settings, action: onOpenSettings)
                chromeGlyph(MI.search, action: onOpenSearch)
                chromeGlyph(MI.bookmarkBorder, action: onOpenFavorites)
                chromeLabel("+") { if let n = size.next { size = n } }
                chromeLabel("\u{2212}") { if let p = size.previous { size = p } }
            }
        }
        .padding(.horizontal, ShellMetrics.topChromeSideInset)
        .padding(.top, ShellMetrics.topChromeOffset)
    }

    private func chromeButton(systemName: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: ShellMetrics.topChromeIcon * 0.78, weight: .semibold))
                .foregroundStyle(Color.white)
                .frame(width: ShellMetrics.topChromeButton, height: ShellMetrics.topChromeButton)
                .shellIconShadow()
        }
        .buttonStyle(.plain)
    }

    /// 右栏图标走 RN 同一套 Material 字形（READ_TOP_CHROME.iconSize = 32）
    private func chromeGlyph(_ glyph: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            MaterialIcon(glyph: glyph, size: ShellMetrics.topChromeIcon, color: .white)
                .frame(width: ShellMetrics.topChromeButton, height: ShellMetrics.topChromeButton)
                .shellIconShadow()
        }
        .buttonStyle(.plain)
    }

    /// 字号 +/− 是 32pt 文字，不是图标 —— 与 `topActionSizeLabel` 一致
    private func chromeLabel(_ text: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(text)
                .font(.system(size: ShellMetrics.topChromeSizeLabel, weight: .medium))
                .foregroundStyle(Color.white)
                .frame(width: ShellMetrics.topChromeButton, height: ShellMetrics.topChromeButton)
                .shellIconShadow()
        }
        .buttonStyle(.plain)
    }
}

/// 上一章 / 下一章（可跨卷）。对应 RN `read-chapter-neighbors.ts`：按目录顺序，卷首的上一章是前一卷末章，卷末的下一章是后一卷首章。
struct ChapterNeighbor {
    let bookId: String
    let chapter: Int

    static func resolve(bookId: String, chapter: Int) -> (prev: ChapterNeighbor?, next: ChapterNeighbor?) {
        let all = BibleCatalog.all
        guard let i = all.firstIndex(where: { $0.id == bookId.uppercased() }) else { return (nil, nil) }
        let book = all[i]
        guard chapter >= 1, chapter <= book.chapterCount else { return (nil, nil) }
        var prev: ChapterNeighbor?
        if chapter > 1 { prev = ChapterNeighbor(bookId: book.id, chapter: chapter - 1) }
        else if i > 0 { prev = ChapterNeighbor(bookId: all[i - 1].id, chapter: all[i - 1].chapterCount) }
        var next: ChapterNeighbor?
        if chapter < book.chapterCount { next = ChapterNeighbor(bookId: book.id, chapter: chapter + 1) }
        else if i + 1 < all.count { next = ChapterNeighbor(bookId: all[i + 1].id, chapter: 1) }
        return (prev, next)
    }
}
