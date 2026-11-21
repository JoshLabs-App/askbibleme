import SwiftUI

/// 圣经目录（零遮挡对称双栏版）：顶部内嵌温润搜索框 + 上次阅读书签条，新约右栏完全无悬浮球遮挡。
struct CatalogView: View {
    @Binding var size: ReadSize
    /// 读经展示语言：书名 / 分组 / 「圣经 · 旧约 · 新约」都按它（英文译本 → 英文面）
    var locale: AppLocale = .zhCN
    var translationLabel: String = ""
    var lastReadTitle: String? = nil
    /// 书卷名：在线译本用它自己那套（西语版本 → Génesis）；默认退回目录里的中英名
    var bookLabel: (BookRef) -> String = { $0.name(AppLocale.current) }
    var onOpenBook: (BookRef) -> Void = { _ in }
    var onOpenSettings: () -> Void = {}
    var onOpenSearch: () -> Void = {}
    var onOpenFavorites: () -> Void = {}
    var onLastRead: (() -> Void)? = nil

    @Environment(\.parchment) private var theme

    var body: some View {
        GeometryReader { geo in
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 0) {
                    // 顶栏：圣经标题 + 右侧轻量「译本」与「摘录」胶囊
                    HStack(alignment: .center, spacing: 10) {
                        Text(ReadChrome.catalogTitle(locale))
                            .askFont(size: 30, weight: .bold)
                            .foregroundStyle(theme.ink)
                        Spacer()
                        if !translationLabel.isEmpty {
                            Button(action: onOpenSettings) {
                                HStack(spacing: 4) {
                                    Text(translationLabel)
                                        .askFont(size: 12.5, weight: .semibold)
                                        .lineLimit(1)
                                    Image(systemName: "chevron.down")
                                        .font(.system(size: 9.5, weight: .bold))
                                }
                                .foregroundStyle(theme.muted)
                                .padding(.horizontal, 11)
                                .padding(.vertical, 6)
                                .background(Capsule().fill(theme.surface.opacity(0.82)))
                                .overlay(Capsule().strokeBorder(theme.border, lineWidth: 1))
                            }
                            .buttonStyle(.plain)
                        }
                        Button(action: onOpenFavorites) {
                            Image(systemName: "bookmark")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(theme.muted)
                                .frame(width: 34, height: 34)
                                .background(Circle().fill(theme.surface.opacity(0.82)))
                                .overlay(Circle().strokeBorder(theme.border, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(SiteCopy.t("pages.read.favoritesTitle", locale))
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 22)

                    // 温润搜索入口条（提示支持输入 约 3:16 直达）
                    Button(action: onOpenSearch) {
                        HStack(spacing: 9) {
                            Image(systemName: "magnifyingglass")
                                .font(.system(size: 14, weight: .medium))
                                .foregroundStyle(theme.muted)
                            Text(AppLocale.pick("搜索经文，或输入如 约 3:16 直达…", "Search scripture or jump e.g. John 3:16…", locale))
                                .askFont(size: 14)
                                .foregroundStyle(theme.faint)
                                .lineLimit(1)
                            Spacer()
                        }
                        .padding(.horizontal, 14)
                        .frame(height: 42)
                        .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(theme.surface.opacity(0.85)))
                        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(theme.border, lineWidth: 1))
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .padding(.horizontal, 20)
                    .padding(.top, 14)

                    // 上次阅读书签条（有记录时优雅呈现）
                    if let action = onLastRead, let title = lastReadTitle, !title.isEmpty {
                        Button(action: action) {
                            HStack(spacing: 8) {
                                Image(systemName: "bookmark.fill")
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(theme.accentOt)
                                Text(AppLocale.pick("继续上次阅读：\(title)", "Continue reading: \(title)", locale))
                                    .askFont(size: 13.5, weight: .semibold)
                                    .foregroundStyle(theme.ink)
                                    .lineLimit(1)
                                Spacer(minLength: 4)
                                Image(systemName: "chevron.right")
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundStyle(theme.accentOt)
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(theme.accentOt.opacity(0.12)))
                            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(theme.accentOt.opacity(0.35), lineWidth: 0.75))
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .padding(.horizontal, 20)
                        .padding(.top, 10)
                    }

                    // 旧约 / 新约双栏列头 + 对称零遮挡目录
                    HStack(alignment: .top, spacing: 18) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(ReadChrome.testamentOld(locale))
                                .askFont(size: 19, weight: .bold)
                                .foregroundStyle(Color(parchment: 0x2F6291))
                                .padding(.bottom, 2)
                            column(BibleCatalog.oldTestament, railBottom: 0)
                        }
                        VStack(alignment: .leading, spacing: 6) {
                            Text(ReadChrome.testamentNew(locale))
                                .askFont(size: 19, weight: .bold)
                                .foregroundStyle(Color(parchment: 0xC1660B))
                                .padding(.bottom, 2)
                            column(BibleCatalog.newTestament, railBottom: 0)
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 20)
                    .padding(.bottom, ShellMetrics.tabBarClearance + geo.safeAreaInsets.bottom + 110)
                }
            }
            .ignoresSafeArea(edges: .bottom)
            .parchmentFade(.tabbar)
            .background(ParchmentBackground(theme: theme).ignoresSafeArea())
        }
    }

    private func column(_ groups: [BookGroup], railBottom: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(groups) { group in
                Text(group.title(locale))
                    .askFont(size: 16, weight: .bold)
                    .foregroundStyle(group.color)
                    .padding(.top, 7)
                    .padding(.bottom, 3)

                VStack(alignment: .leading, spacing: 0) {
                    ForEach(group.books) { book in
                        CatalogBookRow(
                            book: book, color: group.color, theme: theme,
                            label: bookLabel(book),
                            fontSize: size.metrics.catalogBookSize * 0.85,
                            // RN 的 catalogBookLine：行高跟着字号档走，放大字号时行距也开，手指更好点
                            rowHeight: size.metrics.catalogBookLine,
                            railBottom: railBottom,
                            onOpen: { onOpenBook(book) })
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
}

/// 书卷与章节二合一快捷切换浮层（支持章格速选 + 66 卷双栏圣经目录秒切）
struct ChapterPickerSheet: View {
    let book: BookRef
    /// 章数以库为准 —— 目录里的静态数字只是回退
    var chapterCount: Int = 0
    var currentChapter: Int? = nil
    var initialShowBooks: Bool = false
    var chapterCountForBook: ((BookRef) -> Int)? = nil
    var onPick: (Int) -> Void
    var onPickBookChapter: ((BookRef, Int) -> Void)? = nil
    var onClose: () -> Void
    var locale: AppLocale = .zhCN
    /// 书卷名：在线译本用它自己那套
    var bookLabel: (BookRef) -> String = { $0.name(AppLocale.current) }

    @Environment(\.parchment) private var theme
    @State private var selectedBook: BookRef? = nil
    @State private var showingBooksOverride: Bool? = nil

    private var activeBook: BookRef { selectedBook ?? book }
    private var showingBooks: Bool { showingBooksOverride ?? initialShowBooks }
    private var resolvedChapterCount: Int {
        if let selectedBook {
            let dyn = chapterCountForBook?(selectedBook) ?? 0
            return max(1, dyn > 0 ? dyn : selectedBook.chapterCount)
        }
        return max(1, chapterCount > 0 ? chapterCount : book.chapterCount)
    }

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 9), count: 6)

    var body: some View {
        ZStack {
            theme.modalBackdrop
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .ignoresSafeArea()

            VStack(spacing: 0) {
                HStack(spacing: 8) {
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            showingBooksOverride = !showingBooks
                        }
                    } label: {
                        HStack(spacing: 5) {
                            Image(systemName: showingBooks ? "chevron.left" : "books.vertical")
                                .font(.system(size: 13, weight: .semibold))
                            Text(showingBooks
                                 ? AppLocale.pick("返回选章", "Chapters", locale)
                                 : AppLocale.pick("圣经目录", "Books", locale))
                                .askFont(size: 13, weight: .semibold)
                        }
                        .foregroundStyle(theme.accentOt)
                        .padding(.horizontal, 11)
                        .padding(.vertical, 7)
                        .background(Capsule().fill(theme.accentOt.opacity(theme.isDark ? 0.20 : 0.12)))
                        .overlay(Capsule().strokeBorder(theme.accentOt.opacity(0.4), lineWidth: 0.75))
                        .contentShape(Capsule())
                    }
                    .buttonStyle(.plain)

                    Spacer(minLength: 4)

                    Text(showingBooks
                         ? AppLocale.pick("选择书卷（66卷）", "Choose Book (66)", locale)
                         : bookLabel(activeBook))
                        .askFont(size: 17, weight: .bold)
                        .foregroundStyle(theme.ink)
                        .lineLimit(1)

                    Spacer(minLength: 4)

                    Button(action: onClose) {
                        Image(systemName: "xmark")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(theme.muted)
                            .frame(width: 34, height: 34)
                            .background(Circle().fill(theme.surface.opacity(0.75)))
                            .contentShape(Circle())
                    }
                    .buttonStyle(.plain)
                }
                .padding(.bottom, 14)

                if showingBooks {
                    ScrollView(showsIndicators: false) {
                        HStack(alignment: .top, spacing: 14) {
                            bookColumn(
                                title: ReadChrome.testamentOld(locale),
                                titleColor: Color(parchment: 0x2F6291),
                                groups: BibleCatalog.oldTestament
                            )
                            bookColumn(
                                title: ReadChrome.testamentNew(locale),
                                titleColor: Color(parchment: 0xC1660B),
                                groups: BibleCatalog.newTestament
                            )
                        }
                        .padding(.bottom, 6)
                    }
                } else {
                    ScrollView(showsIndicators: false) {
                        LazyVGrid(columns: columns, spacing: 9) {
                            ForEach(1...resolvedChapterCount, id: \.self) { n in
                                let isCurrent = activeBook.id == book.id && currentChapter == n
                                Button {
                                    if let onPickBookChapter {
                                        onPickBookChapter(activeBook, n)
                                    } else {
                                        onPick(n)
                                    }
                                } label: {
                                    Text("\(n)")
                                        .askFont(size: 18, weight: isCurrent ? .bold : .semibold)
                                        .foregroundStyle(isCurrent ? .white : theme.ink)
                                        .frame(maxWidth: .infinity)
                                        .frame(height: 46)
                                        .background(
                                            RoundedRectangle(cornerRadius: 11)
                                                .fill(isCurrent ? theme.accentOt : theme.chapterCellPressed)
                                                .overlay(
                                                    RoundedRectangle(cornerRadius: 11)
                                                        .strokeBorder(isCurrent ? theme.accentOt : theme.chapterCellBorder, lineWidth: 1)
                                                )
                                        )
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .parchmentCard(cornerRadius: 20)
            .frame(maxHeight: 540)
            .padding(.horizontal, 16)
            .contentShape(Rectangle())
            .onTapGesture {}
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .contentShape(Rectangle())
        .onTapGesture(perform: onClose)
    }

    private func bookColumn(title: String, titleColor: Color, groups: [BookGroup]) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .askFont(size: 15, weight: .bold)
                .foregroundStyle(titleColor)
                .padding(.bottom, 2)

            ForEach(groups) { group in
                Text(group.title(locale))
                    .askFont(size: 12.5, weight: .bold)
                    .foregroundStyle(group.color)
                    .padding(.top, 5)
                    .padding(.bottom, 1)

                VStack(alignment: .leading, spacing: 2) {
                    ForEach(group.books) { b in
                        let isSelected = b.id == activeBook.id
                        Button {
                            selectedBook = b
                            let count = max(1, (chapterCountForBook?(b) ?? 0) > 0 ? (chapterCountForBook?(b) ?? b.chapterCount) : b.chapterCount)
                            if count == 1 {
                                if let onPickBookChapter {
                                    onPickBookChapter(b, 1)
                                } else {
                                    onPick(1)
                                }
                            } else {
                                withAnimation(.easeInOut(duration: 0.18)) {
                                    showingBooksOverride = false
                                }
                            }
                        } label: {
                            HStack(spacing: 6) {
                                Text(b.displayNumber)
                                    .askFont(size: 10.5, weight: .semibold)
                                    .foregroundStyle(isSelected ? theme.accentOt : group.color)
                                    .frame(minWidth: 15, alignment: .leading)
                                Text(bookLabel(b))
                                    .askFont(size: 14, weight: isSelected ? .bold : .medium)
                                    .foregroundStyle(isSelected ? theme.accentOt : theme.ink)
                                    .lineLimit(1)
                                Spacer(minLength: 2)
                            }
                            .padding(.horizontal, 6)
                            .padding(.vertical, 6)
                            .background(
                                RoundedRectangle(cornerRadius: 8)
                                    .fill(isSelected ? theme.accentOt.opacity(theme.isDark ? 0.22 : 0.12) : Color.clear)
                            )
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
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
    @Environment(\.parchment) private var theme

    var body: some View {
        let allGroups = groups
        return ZStack(alignment: .top) {
            // 铺满整屏再收点击：不写 frame 的话 ZStack 只按卡片大小给这层布局尺寸，
            // 颜色照样画到全屏（ignoresSafeArea），但卡片以下的点击落不进来，面板就关不掉了
            theme.modalBackdrop
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .ignoresSafeArea()

            VStack(spacing: 12) {
                HStack(spacing: 14) {
                    Image(systemName: "book.fill")
                        .askFont(size: 22)
                        .foregroundStyle(theme.ink)
                    Button {
                        expanded.toggle()
                        if expanded { expandedSecondary = false }
                    } label: {
                        dropdown(
                            text: store.translation.label(locale),
                            color: theme.isDark ? Color(red: 0.95, green: 0.90, blue: 0.82) : theme.parchmentAccent,
                            open: expanded
                        )
                    }
                    .buttonStyle(.plain)
                }

                if expanded {
                    translationList(allGroups: allGroups, selectedId: store.translation.id, excludeId: nil, allowNone: false, lang: $langTab, query: $query) { t in
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
                        dropdown(
                            text: store.secondary?.label(locale) ?? SiteCopy.t("native.none", locale),
                            color: theme.isDark ? Color(red: 1.0, green: 0.78, blue: 0.27) : Color(red: 0.71, green: 0.33, blue: 0.04),
                            open: expandedSecondary
                        )
                    }
                    .buttonStyle(.plain)
                }

                if expandedSecondary {
                    translationList(allGroups: allGroups, selectedId: store.secondary?.id ?? store.translation.id, excludeId: store.translation.id, allowNone: true, lang: $langTabSecondary, query: $querySecondary) { t in
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
            // 卡片自己吃掉点击，别让下面那层「点空白关面板」跟着触发
            .contentShape(Rectangle())
            .onTapGesture {}
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        // 点空白关面板：手势挂在整层上。挂在遮罩色块上不行——色块加了 ignoresSafeArea 后
        // 只剩下绘制铺满，可点区域缩到卡片那一块，卡片以下点了没反应，面板就关不掉
        .contentShape(Rectangle())
        .onTapGesture(perform: onClose)
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
    private func family(of id: String?, in allGroups: [(language: String, items: [ScriptureTranslation])]) -> String? {
        guard let id, let t = ScriptureTranslation.find(id) else { return nil }
        return allGroups.first { g in g.items.contains { $0.id == t.id } }?.language
    }

    /// 最上面一行搜索 + 一排语言（横滑，界面语言那档打头），下面只列该语言的版本（RN 选择器顺序 = 常用在前）。
    /// 搜索非空时跨语言平铺结果（几百本在线译本，只靠滑语言找不动）。
    private func translationList(allGroups: [(language: String, items: [ScriptureTranslation])], selectedId: String?, excludeId: String?, allowNone: Bool, lang: Binding<String?>,
                                 query: Binding<String>, onPick: @escaping (ScriptureTranslation?) -> Void) -> some View {
        let all = allGroups
        let current = lang.wrappedValue ?? family(of: selectedId, in: allGroups) ?? all.first?.language ?? ""
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
                    .askFont(size: 14)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                if !q.isEmpty {
                    Button { query.wrappedValue = "" } label: {
                        Image(systemName: "xmark.circle.fill").askFont(size: 14).foregroundStyle(theme.faint)
                            .frame(width: 32, height: 32).contentShape(Rectangle())
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
                                    .askFont(size: 13, weight: .semibold)
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
                LazyVStack(spacing: 0) {
                    if allowNone, q.isEmpty {
                        row(label: SiteCopy.t("native.none", locale), selected: selectedId == nil || selectedId == excludeId, badges: EmptyView()) { onPick(nil) }
                    }
                    ForEach(items) { t in
                        row(label: t.label(locale), selected: t.id == selectedId, badges: badges(t)) { onPick(t) }
                    }
                    if items.isEmpty {
                        Text(SiteCopy.t("pages.read.scriptureSearchEmpty", locale))
                            .askFont(size: 13).foregroundStyle(theme.faint)
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
                .fill(theme.isDark ? Color(red: 31 / 255, green: 25 / 255, blue: 20 / 255) : Color(rgb: 0xFFFDF8))
                .overlay(RoundedRectangle(cornerRadius: 9).strokeBorder(theme.borderStrong, lineWidth: 1))
        )
        .padding(.leading, 40)
    }

    private func row<Badges: View>(label: String, selected: Bool, badges: Badges, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Text(label)
                    .askFont(size: 16, weight: selected ? .semibold : .regular)
                    .foregroundStyle(selected && theme.isDark ? Brand.logo : theme.ink)
                    .lineLimit(1)
                Spacer(minLength: 4)
                badges
                if selected {
                    Image(systemName: "checkmark")
                        .askFont(size: 14, weight: .semibold)
                        .foregroundStyle(theme.isDark ? Brand.logo : theme.parchmentAccent)
                }
            }
            .padding(.horizontal, 14)
            .frame(minHeight: 42)
            .background(selected ? Brand.logo.opacity(theme.isDark ? 0.16 : 0.10) : Color.clear)
            .contentShape(Rectangle())
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
        Text(text).askFont(size: 11, weight: .semibold).foregroundStyle(theme.muted)
            .padding(.horizontal, 6).padding(.vertical, 2)
            .overlay(Capsule().strokeBorder(theme.border, lineWidth: 1))
    }

    private func dropdown(text: String, color: Color, open: Bool) -> some View {
        HStack {
            Text(text)
                .askFont(size: 18, weight: .semibold)
                .foregroundStyle(color)
                .lineLimit(1)
            Spacer()
            Image(systemName: "chevron.down")
                .askFont(size: 14, weight: .semibold)
                .foregroundStyle(theme.muted.opacity(0.75))
                .rotationEffect(.degrees(open ? 180 : 0))
        }
        .padding(.horizontal, 14)
        .frame(height: 40)
        .background(
            RoundedRectangle(cornerRadius: 9)
                .fill(theme.isDark ? Color(red: 36 / 255, green: 30 / 255, blue: 23 / 255) : Color(rgb: 0xFFFDF8))
                .overlay(RoundedRectangle(cornerRadius: 9).strokeBorder(theme.borderStrong, lineWidth: 1))
        )
    }
}

/// 目录里的一行书卷。单独拆出来是为了每行自己量位置：压在右侧竖排下面的行要让出图标宽度。
private struct CatalogBookRow: View {
    let book: BookRef
    let color: Color
    let theme: Parchment
    let label: String
    let fontSize: CGFloat
    let rowHeight: CGFloat
    let railBottom: CGFloat
    let onOpen: () -> Void

    /// 让位宽度：图标栏从屏幕右边算起是 8 + 50 = 58，行本身右边已经有 14 的页边距，所以再退 44 就够
    private let railClearance: CGFloat = 44

    @State private var underRail = false

    var body: some View {
        Button(action: onOpen) {
            HStack(spacing: 8) {
                Text(book.displayNumber)
                    .askFont(size: 11, weight: .semibold)
                    .foregroundStyle(color)
                    .frame(minWidth: 15, alignment: .leading)
                Text(label)
                    .askFont(size: fontSize)
                    .foregroundStyle(theme.ink)
                    .lineLimit(1)
                Spacer(minLength: 2)
            }
            .padding(.horizontal, 5)
            .padding(.trailing, underRail ? railClearance : 0)
            .frame(height: rowHeight)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .background(GeometryReader { g in
            Color.clear
                .onAppear { underRail = railBottom > 0 && g.frame(in: .global).minY < railBottom }
                .onChange(of: g.frame(in: .global).minY) { y in
                    underRail = railBottom > 0 && y < railBottom
                }
        })
    }
}
