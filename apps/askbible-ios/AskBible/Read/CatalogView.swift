import SwiftUI

/// 圣经目录。双栏 + 六个彩色分组，右侧竖排在这一页是 6 个（比章页多搜索和历史）。
struct CatalogView: View {
    @Binding var size: ReadSize
    /// 读经展示语言：书名 / 分组 / 「圣经 · 旧约 · 新约」都按它（英文译本 → 英文面）
    var locale: AppLocale = .zhCN
    var onOpenBook: (BookRef) -> Void = { _ in }
    var onOpenSettings: () -> Void = {}
    var onOpenSearch: () -> Void = {}
    var onOpenFavorites: () -> Void = {}

    private let theme = Parchment.light

    var body: some View {
        GeometryReader { geo in
            let safeTop = geo.safeAreaInsets.top
            ZStack(alignment: .topTrailing) {
                ScrollView(showsIndicators: false) {
                    VStack(spacing: 0) {
                        Text(ReadChrome.catalogTitle(locale))
                            .font(.system(size: 30, weight: .bold))
                            .foregroundStyle(theme.ink)
                            .padding(.top, safeTop + 42)

                        HStack(spacing: 14) {
                            Text(ReadChrome.testamentOld(locale))
                                .font(.system(size: 20, weight: .bold))
                                .foregroundStyle(Color(rgb: 0x2F6291))
                            // RN BibleCatalogOutlineContent：MaterialIcons notes 22，未开时 faint
                            MaterialIcon(glyph: MI.notes, size: 22, color: theme.faint)
                            Text(ReadChrome.testamentNew(locale))
                                .font(.system(size: 20, weight: .bold))
                                .foregroundStyle(Color(rgb: 0xC1660B))
                        }
                        .padding(.top, 18)

                        HStack(alignment: .top, spacing: 14) {
                            column(BibleCatalog.oldTestament)
                            column(BibleCatalog.newTestament)
                        }
                        .padding(.horizontal, 14)
                        .padding(.top, 16)
                        // 目录页底下不再放读经计划区块（Josh 2026-09-09「圣经目录面下面不需要展示读经计划」），
                        // 读经计划走底栏中央键。RN：72（SHELL_TAB_BAR_CLEARANCE）+ 安全区 + 120（渐隐区）
                        .padding(.bottom, ShellMetrics.tabBarClearance + geo.safeAreaInsets.bottom + 120)
                    }
                }
                .ignoresSafeArea(edges: .bottom)
                .parchmentFade(.tabbar)

                rail(safeTop: safeTop)
            }
            .background(ParchmentBackground(theme: theme).ignoresSafeArea())
        }
    }

    private func column(_ groups: [BookGroup]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(groups) { group in
                Text(group.title(locale))
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(group.color)
                    .padding(.top, 7)
                    .padding(.bottom, 3)

                VStack(alignment: .leading, spacing: 0) {
                    ForEach(group.books) { book in
                        Button { onOpenBook(book) } label: {
                            HStack(spacing: 8) {
                                Text(book.displayNumber)
                                    .font(.system(size: 11, weight: .semibold))
                                    .foregroundStyle(group.color)
                                    .frame(minWidth: 15, alignment: .leading)
                                Text(book.name(locale))
                                    .font(.system(size: size.metrics.catalogBookSize * 0.85))
                                    .foregroundStyle(theme.ink)
                                    .lineLimit(1)
                                Spacer(minLength: 2)
                                // RN bookChevron：文字「›」24/400 faint，透明度 .58
                                Text("\u{203A}")
                                    .font(.system(size: 24))
                                    .foregroundStyle(theme.faint.opacity(0.58))
                                    .frame(height: 24)
                            }
                            .padding(.horizontal, 5)
                            .frame(height: 27)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.leading, 5)
                .overlay(alignment: .leading) {
                    Rectangle().fill(group.color).frame(width: 2.5)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func rail(safeTop: CGFloat) -> some View {
        VStack(spacing: ShellMetrics.topChromeGap) {
            railButton(MI.settings, action: onOpenSettings)
            railButton(MI.search, action: onOpenSearch)
            railButton(MI.bookmarkBorder, action: onOpenFavorites)
            railLabel("+") { if let n = size.next { size = n } }
            railLabel("\u{2212}") { if let p = size.previous { size = p } }
            railButton(MI.history)
        }
        .padding(.top, safeTop + ShellMetrics.topChromeOffset)
        .padding(.trailing, ShellMetrics.topChromeSideInset)
    }

    /// 右栏图标走 RN 同一套 Material 字形（READ_TOP_CHROME.iconSize = 32）
    private func railButton(_ glyph: String, action: @escaping () -> Void = {}) -> some View {
        Button(action: action) {
            MaterialIcon(glyph: glyph, size: ShellMetrics.topChromeIcon, color: .white)
                .frame(width: ShellMetrics.topChromeButton, height: ShellMetrics.topChromeButton)
                .shellIconShadow()
        }
        .buttonStyle(.plain)
    }

    private func railLabel(_ text: String, action: @escaping () -> Void) -> some View {
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

/// 章节选择浮层
struct ChapterPickerSheet: View {
    let book: BookRef
    /// 章数以库为准 —— 目录里的静态数字只是回退
    var chapterCount: Int = 0
    var onPick: (Int) -> Void
    var onClose: () -> Void
    var locale: AppLocale = .zhCN

    private let theme = Parchment.light
    private let columns = Array(repeating: GridItem(.flexible(), spacing: 9), count: 6)

    var body: some View {
        ZStack {
            theme.modalBackdrop.ignoresSafeArea()
                .onTapGesture(perform: onClose)

            VStack(spacing: 0) {
                // RN BibleChapterPickerPanel.header：系统返回（iOS 是 chevron）+ 标题 17/600 居中 + 「×」28 faint
                HStack(spacing: 8) {
                    Button(action: onClose) {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 20, weight: .semibold))
                            .foregroundStyle(theme.ink)
                    }
                    .buttonStyle(.plain)
                    Text(book.name(locale))
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(theme.ink)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity)
                    Button(action: onClose) {
                        Text("\u{00D7}")
                            .font(.system(size: 28))
                            .foregroundStyle(theme.faint)
                            .frame(height: 28)
                            .padding(.horizontal, 4)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.bottom, 18)

                ScrollView(showsIndicators: false) {
                    LazyVGrid(columns: columns, spacing: 9) {
                        ForEach(1...max(1, chapterCount > 0 ? chapterCount : book.chapterCount), id: \.self) { n in
                            Button { onPick(n) } label: {
                                Text("\(n)")
                                    .font(.system(size: 19, weight: .semibold))
                                    .foregroundStyle(theme.ink)
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 46)
                                    .background(
                                        RoundedRectangle(cornerRadius: 11)
                                            .fill(theme.chapterCellPressed)
                                            .overlay(
                                                RoundedRectangle(cornerRadius: 11)
                                                    .strokeBorder(theme.chapterCellBorder, lineWidth: 1)
                                            )
                                    )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .parchmentCard(cornerRadius: 20)
            .frame(maxHeight: 508)
            .padding(.horizontal, 18)
        }
    }
}

/// 译本选择浮层 —— 齿轮开出来的就是这个。主译本 / 对照两个下拉，展开后是完整目录（RN 生产目录里拿得到正文的 20 本），
/// 按语言分组（简中 / 繁中 / 英文）、按 RN 选择器顺序排；行尾标记：有朗读（record-voice-over）、在线（逐章抓取）、需下载（KJV，选中后按需拉）。
struct TranslationPanel: View {
    @EnvironmentObject var store: ScriptureStore
    /// 界面语言：标签与分组名按它
    var locale: AppLocale = .zhCN
    var onClose: () -> Void

    @State private var expanded = false
    @State private var expandedSecondary = false
    /// 列表顶部选中的语言；nil = 跟当前选中译本的语言。主 / 副各一份（Josh 2026-09-10：最上面是语言分类，下面是常选的版本）
    @State private var langTab: String? = nil
    @State private var langTabSecondary: String? = nil
    /// 版本搜索（几百本在线译本，横滑找语言太慢）
    @State private var query = ""
    @State private var querySecondary = ""
    private let theme = Parchment.light

    var body: some View {
        ZStack(alignment: .top) {
            theme.modalBackdrop.ignoresSafeArea()
                .onTapGesture(perform: onClose)

            VStack(spacing: 12) {
                HStack(spacing: 14) {
                    Image(systemName: "book.fill")
                        .font(.system(size: 22))
                        .foregroundStyle(theme.ink)
                    Button {
                        expanded.toggle()
                        if expanded { expandedSecondary = false }
                    } label: {
                        dropdown(text: store.translation.label(locale), color: theme.parchmentAccent, open: expanded)
                    }
                    .buttonStyle(.plain)
                }

                if expanded {
                    translationList(selectedId: store.translation.id, excludeId: nil, allowNone: false, lang: $langTab, query: $query) { t in
                        if let t {
                            store.translation = t
                            if store.secondary?.id == t.id { store.secondary = nil }
                        }
                        expanded = false
                    }
                }

                HStack(spacing: 14) {
                    Color.clear.frame(width: 26, height: 1)
                    Button {
                        expandedSecondary.toggle()
                        if expandedSecondary { expanded = false }
                    } label: {
                        dropdown(text: store.secondary?.label(locale) ?? SiteCopy.t("native.none", locale),
                                 color: Color(rgb: 0xE0A100), open: expandedSecondary)
                    }
                    .buttonStyle(.plain)
                }

                if expandedSecondary {
                    translationList(selectedId: store.secondary?.id ?? store.translation.id, excludeId: store.translation.id, allowNone: true, lang: $langTabSecondary, query: $querySecondary) { t in
                        store.secondary = t
                        expandedSecondary = false
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .parchmentCard(cornerRadius: 17)
            .shadow(color: theme.ink.opacity(0.24), radius: 13, y: 6)
            .padding(.leading, 30)
            .padding(.trailing, 9)
            .padding(.top, 97)
        }
    }

    /// 按语言分组：内置的简中 / 繁中 / 英文在前（界面语言那档打头），其余语种按版本数排；组内按 RN 选择器顺序
    private var groups: [(language: String, items: [ScriptureTranslation])] {
        var bucket: [String: [ScriptureTranslation]] = [:]
        var order: [String] = []
        for t in ScriptureTranslation.pickerOrder(locale) {
            let key = t.language.lowercased()
            if bucket[key] == nil { order.append(key) }
            bucket[key, default: []].append(t)
        }
        let head: [String]
        switch locale {
        case .en: head = ["en", "zh-hans", "zh-hant"]
        case .zhTW: head = ["zh-hant", "zh-hans", "en"]
        case .zhCN: head = ["zh-hans", "zh-hant", "en"]
        }
        // 按语言使用人数排（LanguageOrder）；表里没有的排在后面，再按版本数（之前只按版本数，梵语 22 本会顶到最前）
        let rest = order.filter { !head.contains($0) }.sorted {
            let ra = LanguageOrder.rank($0), rb = LanguageOrder.rank($1)
            if ra != rb { return ra < rb }
            let a = bucket[$0]?.count ?? 0, b = bucket[$1]?.count ?? 0
            return a == b ? $0 < $1 : a > b
        }
        return (head + rest).compactMap { key in bucket[key].map { (language: key, items: $0) } }
    }

    /// 某译本所属的语言分组键
    private func family(of id: String?) -> String? {
        guard let id, let t = ScriptureTranslation.find(id) else { return nil }
        return groups.first { g in g.items.contains { $0.id == t.id } }?.language
    }

    /// 最上面一行搜索 + 一排语言（横滑，界面语言那档打头），下面只列该语言的版本（RN 选择器顺序 = 常用在前）。
    /// 搜索非空时跨语言平铺结果（几百本在线译本，只靠滑语言找不动）。
    private func translationList(selectedId: String?, excludeId: String?, allowNone: Bool, lang: Binding<String?>,
                                 query: Binding<String>, onPick: @escaping (ScriptureTranslation?) -> Void) -> some View {
        let all = groups
        let current = lang.wrappedValue ?? family(of: selectedId) ?? all.first?.language ?? ""
        let q = query.wrappedValue.trimmingCharacters(in: .whitespaces).lowercased()
        let items: [ScriptureTranslation] = {
            if q.isEmpty { return (all.first { $0.language == current }?.items ?? []).filter { $0.id != excludeId } }
            return Array(all.flatMap(\.items).filter { t in
                t.id != excludeId && (t.label(locale).lowercased().contains(q) || t.labelEn.lowercased().contains(q)
                    || t.abbreviation.lowercased().contains(q)
                    || ScriptureTranslation.languageName(t.language, locale: locale).lowercased().contains(q))
            }.prefix(80))
        }()
        return VStack(spacing: 0) {
            HStack(spacing: 7) {
                MaterialIcon(glyph: MI.search, size: 15, color: theme.muted)
                TextField(SiteCopy.t("native.searchTranslation", locale), text: query)
                    .font(.system(size: 14))
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                if !q.isEmpty {
                    Button { query.wrappedValue = "" } label: {
                        Image(systemName: "xmark.circle.fill").font(.system(size: 14)).foregroundStyle(theme.faint)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 12).padding(.top, 10).padding(.bottom, 4)

            if q.isEmpty {
                ScrollViewReader { proxy in
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(all, id: \.language) { g in
                            let on = g.language == current
                            Button { lang.wrappedValue = g.language } label: {
                                Text(ScriptureTranslation.languageName(g.language, locale: locale))
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundStyle(theme.ink)
                                    .lineLimit(1)
                                    .padding(.horizontal, 12).padding(.vertical, 8)
                                    .background(RoundedRectangle(cornerRadius: 10).fill(on ? Brand.logo.opacity(0.28) : theme.surface.opacity(0.6)))
                                    .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(on ? Brand.logo : theme.border, lineWidth: on ? 1.5 : 0.5))
                                    .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .id(g.language)
                        }
                    }
                    .padding(.horizontal, 10)
                }
                .padding(.top, 4).padding(.bottom, 6)
                .onAppear { proxy.scrollTo(current, anchor: .center) }
                }
            }

            ScrollView(showsIndicators: false) {
                VStack(spacing: 0) {
                    if allowNone, q.isEmpty {
                        row(label: SiteCopy.t("native.none", locale), selected: selectedId == nil || selectedId == excludeId, badges: EmptyView()) { onPick(nil) }
                    }
                    ForEach(items) { t in
                        row(label: t.label(locale), selected: t.id == selectedId, badges: badges(t)) { onPick(t) }
                    }
                    if items.isEmpty {
                        Text(SiteCopy.t("pages.read.scriptureSearchEmpty", locale))
                            .font(.system(size: 13)).foregroundStyle(theme.faint)
                            .frame(maxWidth: .infinity).frame(height: 42)
                    }
                }
                .padding(.bottom, 6)
            }
            // 按行数定高（每行 42），最多 340，不留空白
            .frame(height: min(340, CGFloat(max(1, items.count + (allowNone && q.isEmpty ? 1 : 0))) * 42 + 6))
        }
        .background(
            RoundedRectangle(cornerRadius: 9)
                .fill(Color(rgb: 0xfffdf8))
                .overlay(RoundedRectangle(cornerRadius: 9).strokeBorder(theme.border.opacity(0.6), lineWidth: 1))
        )
        .padding(.leading, 40)
    }

    private func row<Badges: View>(label: String, selected: Bool, badges: Badges, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Text(label).font(.system(size: 16)).foregroundStyle(theme.ink).lineLimit(1)
                Spacer(minLength: 4)
                badges
                if selected {
                    Image(systemName: "checkmark").font(.system(size: 14, weight: .semibold)).foregroundStyle(theme.parchmentAccent)
                }
            }
            .padding(.horizontal, 14)
            .frame(minHeight: 42)
        }
        .buttonStyle(.plain)
    }

    /// 行尾：有朗读 / 在线 / 需下载（RN translationAccessoryIconName + downloadState）
    @ViewBuilder private func badges(_ t: ScriptureTranslation) -> some View {
        HStack(spacing: 6) {
            if t.hasChapterAudio { MaterialIcon(glyph: MI.recordVoiceOver, size: 16, color: theme.muted) }
            switch t.delivery {
            case .bundled: EmptyView()
            case .online: tag(SiteCopy.t("native.online", locale))
            case .download:
                switch store.downloader.state(t.id) {
                case .idle: tag(SiteCopy.t("native.needDownload", locale))
                case .downloading: tag(SiteCopy.t("native.downloading", locale))
                case .done: EmptyView()
                case .failed: tag(SiteCopy.t("pages.read.retry", locale))
                }
            }
        }
    }

    private func tag(_ text: String) -> some View {
        Text(text).font(.system(size: 11, weight: .semibold)).foregroundStyle(theme.muted)
            .padding(.horizontal, 6).padding(.vertical, 2)
            .overlay(Capsule().strokeBorder(theme.border, lineWidth: 1))
    }

    private func dropdown(text: String, color: Color, open: Bool) -> some View {
        HStack {
            Text(text)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(color)
                .lineLimit(1)
            Spacer()
            Image(systemName: "chevron.down")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(theme.muted.opacity(0.55))
                .rotationEffect(.degrees(open ? 180 : 0))
        }
        .padding(.horizontal, 14)
        .frame(height: 40)
        .background(
            RoundedRectangle(cornerRadius: 9)
                .fill(Color(rgb: 0xfffdf8))
                .overlay(RoundedRectangle(cornerRadius: 9).strokeBorder(theme.border.opacity(0.6), lineWidth: 1))
        )
    }
}
