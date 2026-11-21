import SwiftUI

/// 今日同行页底部的「每日灵修」紧凑卡片：
/// 写明作者（约翰·派博）、简单标题与 2 行简要，默认开启「读经后接着听」，一屏内完整可见。
struct DevotionalCard: View {
    @ObservedObject var content: SolidJoys
    @ObservedObject var player: DevotionalPlayer
    let date: Date
    let locale: AppLocale
    var onOpen: () -> Void = {}

    @AppStorage("devotional.after-reading") private var autoRead = true
    @Environment(\.parchment) private var theme

    var body: some View {
        let day = content.day(date)
        VStack(alignment: .leading, spacing: 8) {
            Button(action: onOpen) {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(alignment: .center, spacing: 5) {
                        Text(locale.zh("每日灵修"))
                            .askFont(size: 12.5, weight: .semibold)
                            .foregroundStyle(theme.accentOt)
                        Text(locale.zh("· 约翰·派博") + (day.map { " · \(locale.zh($0.dateLabel))" } ?? ""))
                            .askFont(size: 12.5, weight: .medium)
                            .foregroundStyle(theme.muted)
                            .lineLimit(1)
                        Spacer(minLength: 6)
                        HStack(spacing: 2) {
                            Text(locale.zh("目录"))
                                .askFont(size: 12, weight: .semibold)
                            Image(systemName: "chevron.right")
                                .font(.system(size: 10, weight: .bold))
                        }
                        .foregroundStyle(theme.accentOt)
                    }

                    if let day {
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            Text(day.title)
                                .askFont(size: 16.5, weight: .bold)
                                .foregroundStyle(theme.ink)
                                .lineLimit(1)
                            Spacer(minLength: 4)
                            if !day.ref.isEmpty {
                                Text(day.ref)
                                    .askFont(size: 11.5, weight: .medium)
                                    .foregroundStyle(theme.muted)
                                    .lineLimit(1)
                            }
                        }

                        if !day.brief.isEmpty {
                            Text(day.brief)
                                .askFont(size: 13)
                                .lineSpacing(2)
                                .foregroundStyle(theme.inkSoft)
                                .lineLimit(2)
                                .multilineTextAlignment(.leading)
                        }
                    } else if content.failed {
                        Text(locale.zh("灵修没有载入，点这里重试"))
                            .askFont(size: 13.5)
                            .foregroundStyle(theme.muted)
                            .padding(.vertical, 2)
                    } else {
                        Text(locale.zh("正在准备每日灵修…"))
                            .askFont(size: 13.5)
                            .foregroundStyle(theme.muted)
                            .padding(.vertical, 2)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if content.failed && day == nil {
                Button(locale.zh("重新载入")) {
                    Task { await content.load(locale: locale) }
                }
                .askFont(size: 13, weight: .semibold)
                .foregroundStyle(theme.accentOt)
            }

            Divider().overlay(theme.border.opacity(0.8))

            HStack(spacing: 10) {
                Button {
                    autoRead.toggle()
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: autoRead ? "checkmark.circle.fill" : "circle")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(autoRead ? theme.accentOt : theme.faint)
                        Text(locale.zh("读经后接着听"))
                            .askFont(size: 12.5, weight: .medium)
                            .foregroundStyle(theme.muted)
                    }
                    .frame(minHeight: 30)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("devotional.afterReading")

                Spacer(minLength: 6)

                if let day, day.audioURL != nil {
                    let mine = player.currentKey == day.md
                    let playing = mine && player.wantsPlayback
                    Button {
                        if playing { player.remotePause() } else { player.play(day) }
                    } label: {
                        HStack(spacing: 4) {
                            if mine && player.isLoading {
                                ProgressView().scaleEffect(0.7)
                            } else {
                                Image(systemName: playing ? "pause.fill" : "play.fill")
                                    .font(.system(size: 10.5, weight: .bold))
                            }
                            Text(
                                locale.zh(
                                    playing
                                        ? "正在播放"
                                        : (day.minutesText.map { "收听 · \($0)" } ?? "收听")
                                )
                            )
                            .askFont(size: 12, weight: .semibold)
                        }
                        .foregroundStyle(playing ? Color(rgb: 0xFFFBF4) : theme.accentOt)
                        .padding(.horizontal, 11)
                        .padding(.vertical, 5)
                        .background(
                            Capsule()
                                .fill(playing ? theme.accentOt : theme.accentOt.opacity(0.14))
                        )
                        .overlay(
                            Capsule()
                                .strokeBorder(playing ? Color.clear : theme.accentOt.opacity(0.32), lineWidth: 1)
                        )
                        .contentShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("devotional.play")
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 11)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(theme.border, lineWidth: 1))
    }
}

/// 每日灵修全页：置顶当前选定篇（收听进度条 + 可展开全文阅读）+ 搜索框 + 1–12 月分类筛选 + 每日标题与简要列表（点选任意一天即听/即读）。
struct DevotionalCatalogView: View {
    @ObservedObject var content: SolidJoys
    @ObservedObject var player: DevotionalPlayer
    let initialDate: Date
    var size: ReadSize = .default
    let locale: AppLocale
    var onBack: () -> Void
    var onOpenChapter: (String, Int) -> Void = { _, _ in }

    @Environment(\.parchment) private var theme
    @State private var selectedDate: Date
    @State private var selectedMonth: Int // 0 = 全部月份, 1...12 = 指定月份
    @State private var query = ""
    @State private var articleExpanded = false
    @FocusState private var searchFocused: Bool

    init(
        content: SolidJoys,
        player: DevotionalPlayer,
        initialDate: Date,
        size: ReadSize = .default,
        locale: AppLocale,
        onBack: @escaping () -> Void,
        onOpenChapter: @escaping (String, Int) -> Void = { _, _ in }
    ) {
        self.content = content
        self.player = player
        self.initialDate = initialDate
        self.size = size
        self.locale = locale
        self.onBack = onBack
        self.onOpenChapter = onOpenChapter
        _selectedDate = State(initialValue: initialDate)
        let m = Calendar.current.component(.month, from: initialDate)
        _selectedMonth = State(initialValue: (1...12).contains(m) ? m : 1)
    }

    private var scale: CGFloat {
        min(2.0, max(0.85, size.metrics.verseFontSize / 16.0))
    }

    private var selectedDay: DevotionalDay? {
        content.day(selectedDate)
    }

    private var trimmedQuery: String {
        query.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var filteredGroups: [(month: Int, items: [DevotionalDay])] {
        let base = content.orderedDays.filter { day in
            let monthMatch = !trimmedQuery.isEmpty ? (selectedMonth == 0 || day.month == selectedMonth) : (selectedMonth == 0 || day.month == selectedMonth)
            guard monthMatch else { return false }
            return day.matches(trimmedQuery)
        }
        let byMonth = Dictionary(grouping: base, by: \.month)
        return (1...12).compactMap { m in
            guard let list = byMonth[m], !list.isEmpty else { return nil }
            return (m, list)
        }
    }

    private var totalHitCount: Int {
        filteredGroups.reduce(0) { $0 + $1.items.count }
    }

    private var isTodaySelected: Bool {
        Calendar.current.isDateInToday(selectedDate)
    }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView(showsIndicators: false) {
                LazyVStack(alignment: .leading, spacing: 0) {
                    topBar(proxy: proxy)
                        .id("devotional-top")
                        .padding(.top, 10)

                    if content.orderedDays.isEmpty {
                        loadingOrFailedBlock
                            .padding(.top, 48)
                    } else {
                        if let day = selectedDay {
                            activeDayCard(day)
                                .padding(.top, 12)
                        }

                        searchBar
                            .padding(.top, 18)

                        monthTabsBar
                            .padding(.top, 12)

                        if !trimmedQuery.isEmpty {
                            Text(locale.zh("共找到 \(totalHitCount) 篇灵修"))
                                .askFont(size: 12.5, weight: .medium)
                                .foregroundStyle(theme.muted)
                                .padding(.top, 10)
                        }

                        if filteredGroups.isEmpty {
                            VStack(spacing: 8) {
                                Text(locale.zh("没有找到匹配的灵修篇目"))
                                    .askFont(size: 15, weight: .semibold)
                                    .foregroundStyle(theme.ink)
                                Text(locale.zh("试试搜索「恩典」「平安」「信心」或切换上方月份"))
                                    .askFont(size: 13)
                                    .foregroundStyle(theme.muted)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 36)
                        } else {
                            ForEach(filteredGroups, id: \.month) { group in
                                monthSectionHeader(month: group.month, count: group.items.count)
                                    .padding(.top, 16)
                                    .padding(.bottom, 8)

                                ForEach(group.items) { item in
                                    dayCatalogRow(item, proxy: proxy)
                                        .padding(.bottom, 8)
                                }
                            }
                        }

                        creditBlock
                            .padding(.top, 24)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 40)
            }
            .background(ParchmentBackground(theme: theme).ignoresSafeArea())
        }
        .task {
            if content.orderedDays.isEmpty {
                await content.load(locale: locale)
            }
        }
    }

    private func topBar(proxy: ScrollViewProxy) -> some View {
        HStack(spacing: 10) {
            Button(action: onBack) {
                Image(systemName: "chevron.left")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(theme.ink)
                    .frame(width: 40, height: 42, alignment: .leading)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(locale.zh("返回"))

            VStack(alignment: .leading, spacing: 2) {
                Text(locale.zh("每日灵修"))
                    .askFont(size: 21, weight: .bold)
                    .foregroundStyle(theme.ink)
                Text(locale.zh("\(SolidJoys.title) · 全年 365 篇"))
                    .askFont(size: 12)
                    .foregroundStyle(theme.muted)
                    .lineLimit(1)
            }

            Spacer(minLength: 8)

            if !isTodaySelected {
                Button {
                    let now = Date()
                    selectedDate = now
                    selectedMonth = Calendar.current.component(.month, from: now)
                    withAnimation(.easeInOut(duration: 0.2)) {
                        proxy.scrollTo("devotional-top", anchor: .top)
                    }
                } label: {
                    Text(locale.zh("回到今日"))
                        .askFont(size: 12.5, weight: .semibold)
                        .foregroundStyle(theme.accentOt)
                        .padding(.horizontal, 11)
                        .padding(.vertical, 6)
                        .background(Capsule().fill(theme.accentOt.opacity(0.14)))
                        .contentShape(Capsule())
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var loadingOrFailedBlock: some View {
        VStack(spacing: 12) {
            if content.failed {
                Text(locale.zh("灵修内容未能载入，请检查网络后重试"))
                    .askFont(size: 15)
                    .foregroundStyle(theme.muted)
                Button {
                    Task { await content.load(locale: locale) }
                } label: {
                    Text(locale.zh("点这里重试"))
                        .askFont(size: 14, weight: .semibold)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 18)
                        .padding(.vertical, 9)
                        .background(Capsule().fill(theme.accentOt))
                }
                .buttonStyle(.plain)
            } else {
                ProgressView()
                Text(locale.zh("正在准备全年灵修目录…"))
                    .askFont(size: 14)
                    .foregroundStyle(theme.muted)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private func activeDayCard(_ day: DevotionalDay) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Button {
                    let prev = PlanDates.addDays(selectedDate, -1)
                    selectedDate = prev
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(theme.muted)
                        .frame(width: 32, height: 32)
                        .background(Circle().fill(theme.ink.opacity(0.06)))
                        .contentShape(Circle())
                }
                .buttonStyle(.plain)

                Text(locale.zh(day.dateLabel))
                    .askFont(size: 14, weight: .bold)
                    .foregroundStyle(theme.accentOt)

                Button {
                    let next = PlanDates.addDays(selectedDate, 1)
                    selectedDate = next
                } label: {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(theme.muted)
                        .frame(width: 32, height: 32)
                        .background(Circle().fill(theme.ink.opacity(0.06)))
                        .contentShape(Circle())
                }
                .buttonStyle(.plain)

                Spacer(minLength: 6)

                if !day.ref.isEmpty {
                    if let bid = day.refBook, let ch = day.refChapter {
                        Button {
                            onOpenChapter(bid, ch)
                        } label: {
                            Text("（\(day.ref)）")
                                .askFont(size: 13, weight: .semibold)
                                .foregroundStyle(theme.accentOt)
                                .lineLimit(1)
                        }
                        .buttonStyle(.plain)
                    } else {
                        Text("（\(day.ref)）")
                            .askFont(size: 13, weight: .medium)
                            .foregroundStyle(theme.muted)
                            .lineLimit(1)
                    }
                }
            }

            Text(day.title)
                .askFont(size: 21 * scale, weight: .bold)
                .foregroundStyle(theme.ink)

            DevotionalAudioBar(day: day, player: player, locale: locale)

            if articleExpanded {
                VStack(alignment: .leading, spacing: 16) {
                    if !day.verse.isEmpty {
                        HStack(alignment: .top, spacing: 12) {
                            Rectangle()
                                .fill(theme.accentOt.opacity(0.55))
                                .frame(width: 3)
                            VStack(alignment: .leading, spacing: 6) {
                                Text(day.verse)
                                    .askFont(size: 16.5 * scale)
                                    .lineSpacing(6)
                                    .foregroundStyle(theme.ink)
                                if !day.ref.isEmpty {
                                    if let bid = day.refBook, let ch = day.refChapter {
                                        Button {
                                            onOpenChapter(bid, ch)
                                        } label: {
                                            Text("— \(day.ref)")
                                                .askFont(size: 13.5 * scale, weight: .semibold)
                                                .foregroundStyle(theme.accentOt)
                                        }
                                        .buttonStyle(.plain)
                                    } else {
                                        Text("— \(day.ref)")
                                            .askFont(size: 13.5 * scale)
                                            .foregroundStyle(theme.muted)
                                    }
                                }
                            }
                        }
                        .padding(.top, 4)
                    }

                    ForEach(Array(day.paragraphs.enumerated()), id: \.offset) { _, p in
                        Text(p)
                            .askFont(size: 16.5 * scale)
                            .lineSpacing(7)
                            .foregroundStyle(theme.inkSoft)
                    }
                }
                .padding(.top, 4)
            } else if !day.brief.isEmpty {
                Text(day.brief)
                    .askFont(size: 14.5)
                    .lineSpacing(4)
                    .foregroundStyle(theme.inkSoft)
                    .lineLimit(2)
            }

            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    articleExpanded.toggle()
                }
            } label: {
                HStack(spacing: 4) {
                    Text(locale.zh(articleExpanded ? "收起全文" : "展开阅读全文"))
                        .askFont(size: 13.5, weight: .semibold)
                    Image(systemName: articleExpanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 11, weight: .bold))
                }
                .foregroundStyle(theme.accentOt)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(theme.accentOt.opacity(0.45), lineWidth: 1))
    }

    private var searchBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(theme.muted)

            TextField(locale.zh("搜索标题、内容简要或经文（如：恩典、诗篇）…"), text: $query)
                .askFont(size: 15)
                .foregroundStyle(theme.ink)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
                .submitLabel(.search)
                .focused($searchFocused)
                .onChange(of: query) { _, newValue in
                    if !newValue.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && selectedMonth != 0 {
                        selectedMonth = 0
                    }
                }

            if !query.isEmpty {
                Button {
                    query = ""
                    selectedMonth = Calendar.current.component(.month, from: selectedDate)
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 16))
                        .foregroundStyle(theme.faint)
                        .frame(width: 30, height: 30)
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

    private var monthTabsBar: some View {
        ScrollViewReader { tabProxy in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 7) {
                    monthPill(month: 0, label: locale.zh("全部"))
                        .id("month-0")
                    ForEach(1...12, id: \.self) { m in
                        monthPill(month: m, label: locale.zh("\(m)月"))
                            .id("month-\(m)")
                    }
                }
                .padding(.vertical, 2)
            }
            .onAppear {
                tabProxy.scrollTo("month-\(selectedMonth)", anchor: .center)
            }
            .onChange(of: selectedMonth) { _, m in
                withAnimation(.easeInOut(duration: 0.2)) {
                    tabProxy.scrollTo("month-\(m)", anchor: .center)
                }
            }
        }
    }

    private func monthPill(month: Int, label: String) -> some View {
        let active = selectedMonth == month
        return Button {
            selectedMonth = month
        } label: {
            Text(label)
                .askFont(size: 13.5, weight: active ? .bold : .medium)
                .foregroundStyle(active ? Color(rgb: 0xFFFBF4) : theme.ink)
                .padding(.horizontal, 13)
                .padding(.vertical, 7)
                .background(
                    Capsule()
                        .fill(active ? theme.accentOt : theme.surface)
                )
                .overlay(
                    Capsule()
                        .strokeBorder(active ? Color.clear : theme.border, lineWidth: 1)
                )
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    private func monthSectionHeader(month: Int, count: Int) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(locale.zh("\(month)月"))
                .askFont(size: 16.5, weight: .bold)
                .foregroundStyle(theme.ink)
            Text(locale.zh("· \(count) 篇"))
                .askFont(size: 12.5, weight: .medium)
                .foregroundStyle(theme.muted)
            Spacer()
        }
    }

    private func dayCatalogRow(_ item: DevotionalDay, proxy: ScrollViewProxy) -> some View {
        let isSelected = selectedDay?.md == item.md
        let isPlayingThis = player.currentKey == item.md && player.wantsPlayback
        let isLoadingThis = player.currentKey == item.md && player.isLoading
        let snippet = item.briefMatching(trimmedQuery)

        return HStack(alignment: .center, spacing: 12) {
            Button {
                selectedDate = SolidJoys.dateForKey(item.md)
                articleExpanded = true
                withAnimation(.easeInOut(duration: 0.22)) {
                    proxy.scrollTo("devotional-top", anchor: .top)
                }
            } label: {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        Text(locale.zh(item.dateLabel))
                            .askFont(size: 12, weight: .bold)
                            .foregroundStyle(isSelected ? theme.accentOt : theme.muted)
                        if !item.ref.isEmpty {
                            Text("· \(item.ref)")
                                .askFont(size: 12, weight: .medium)
                                .foregroundStyle(theme.muted)
                                .lineLimit(1)
                        }
                        if let mins = item.minutesText {
                            Text("· \(locale.zh(mins))")
                                .askFont(size: 11.5)
                                .foregroundStyle(theme.faint)
                        }
                    }

                    Text(item.title)
                        .askFont(size: 16.5, weight: .bold)
                        .foregroundStyle(theme.ink)
                        .lineLimit(1)

                    if !snippet.isEmpty {
                        Text(snippet)
                            .askFont(size: 13.5)
                            .lineSpacing(3)
                            .foregroundStyle(theme.muted)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if item.audioURL != nil {
                Button {
                    selectedDate = SolidJoys.dateForKey(item.md)
                    if isPlayingThis {
                        player.remotePause()
                    } else {
                        player.play(item)
                    }
                } label: {
                    ZStack {
                        Circle()
                            .fill(isPlayingThis ? theme.accentOt : theme.accentOt.opacity(0.14))
                        if isLoadingThis {
                            ProgressView().scaleEffect(0.8)
                        } else {
                            Image(systemName: isPlayingThis ? "waveform" : "play.fill")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundStyle(isPlayingThis ? Color(rgb: 0xFFFBF4) : theme.accentOt)
                        }
                    }
                    .frame(width: 42, height: 42)
                    .contentShape(Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(locale.zh(isPlayingThis ? "暂停 \(item.dateLabel)" : "收听 \(item.dateLabel)"))
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 15, style: .continuous)
                .fill(isSelected ? theme.surface : theme.surface.opacity(0.62))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 15, style: .continuous)
                .strokeBorder(isSelected ? theme.accentOt.opacity(0.55) : theme.border, lineWidth: isSelected ? 1.1 : 0.75)
        )
    }

    private var creditBlock: some View {
        VStack(alignment: .leading, spacing: 5) {
            Divider().overlay(theme.border).padding(.bottom, 6)
            Text(locale.zh("原作：") + SolidJoys.creditAuthor)
                .askFont(size: 14)
                .foregroundStyle(theme.muted)
            Text(locale.zh("译文与音频：\(SolidJoys.creditTranslation)"))
                .askFont(size: 14)
                .foregroundStyle(theme.muted)
            if let url = URL(string: SolidJoys.creditLink) {
                Link("befaithful.net", destination: url)
                    .askFont(size: 14, weight: .medium)
                    .foregroundStyle(theme.accentOt)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// 灵修朗读条（播放 / 暂停 + 进度滑杆 + 时间）
struct DevotionalAudioBar: View {
    let day: DevotionalDay
    @ObservedObject var player: DevotionalPlayer
    let locale: AppLocale
    @Environment(\.parchment) private var theme

    private var mine: Bool { player.currentKey == day.md }
    private var playing: Bool { mine && player.wantsPlayback }
    private var totalSec: Double {
        if mine && player.duration > 0 { return player.duration }
        return Double(day.audioSec ?? 0)
    }
    private var posSec: Double { mine ? min(player.position, max(totalSec, player.position)) : 0 }

    var body: some View {
        if day.audioURL != nil {
            HStack(spacing: 12) {
                Button {
                    if playing { player.remotePause() } else { player.play(day) }
                } label: {
                    ZStack {
                        Circle()
                            .fill(Color(rgb: 0x241F1B))
                        if mine && player.isLoading {
                            ProgressView().tint(Color(rgb: 0xF5EFE4))
                        } else {
                            Image(systemName: playing ? "pause.fill" : "play.fill")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundStyle(Color(rgb: 0xF5EFE4))
                        }
                    }
                    .frame(width: 44, height: 44)
                    .contentShape(Circle())
                }
                .buttonStyle(.plain)

                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(locale.zh(mine && player.failed ? "音频暂时无法播放，文字照常可读" : "灵修朗读"))
                            .askFont(size: 13.5, weight: .semibold)
                            .foregroundStyle(theme.ink)
                        Spacer()
                        Text("\(formatClock(posSec)) / \(totalSec > 0 ? formatClock(totalSec) : "--:--")")
                            .askFont(size: 12, weight: .medium).monospacedDigit()
                            .foregroundStyle(theme.muted)
                    }

                    if mine && player.duration > 0 {
                        Slider(
                            value: Binding(
                                get: { min(player.position, player.duration) },
                                set: { player.remoteSeek(to: $0) }
                            ),
                            in: 0...max(1, player.duration)
                        )
                        .tint(theme.accentOt)
                        .accessibilityLabel(locale.zh("播放进度"))
                    } else {
                        Capsule()
                            .fill(theme.ink.opacity(0.12))
                            .frame(height: 4)
                            .padding(.vertical, 6)
                    }
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(theme.canvas.opacity(0.65)))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(theme.border, lineWidth: 0.75))
        }
    }

    private func formatClock(_ seconds: Double) -> String {
        let s = max(0, Int(seconds.rounded(.down)))
        return String(format: "%d:%02d", s / 60, s % 60)
    }
}

/// 底部灵修播放坞（对齐 Android `DevotionalDock`：点标题进入该天灵修页，点 × 关闭恢复读经坞）
struct DevotionalDock: View {
    let day: DevotionalDay
    @ObservedObject var player: DevotionalPlayer
    let locale: AppLocale
    var onOpen: () -> Void = {}
    @Environment(\.parchment) private var theme

    var body: some View {
        VStack(spacing: 6) {
            Divider().overlay(theme.border)
            VStack(spacing: 6) {
                HStack(spacing: 8) {
                    Button(action: onOpen) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(locale.zh(SolidJoys.title))
                                .askFont(size: 12)
                                .foregroundStyle(theme.muted)
                            Text("\(locale.zh(day.dateLabel)) · \(day.title)")
                                .askFont(size: 15, weight: .semibold)
                                .foregroundStyle(theme.ink)
                                .lineLimit(1)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)

                    Button {
                        player.stop()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(theme.muted)
                            .frame(width: 36, height: 36)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(locale.zh("关闭灵修播放"))
                }

                HStack(spacing: 10) {
                    if player.duration > 0 {
                        Slider(
                            value: Binding(
                                get: { min(player.position, player.duration) },
                                set: { player.remoteSeek(to: $0) }
                            ),
                            in: 0...max(1, player.duration)
                        )
                        .tint(theme.accentOt)
                    } else {
                        Capsule()
                            .fill(theme.ink.opacity(0.12))
                            .frame(height: 4)
                    }

                    Button {
                        if player.wantsPlayback { player.remotePause() } else { player.play(day) }
                    } label: {
                        ZStack {
                            Circle().fill(Color(rgb: 0x241F1B))
                            if player.isLoading {
                                ProgressView().tint(Color(rgb: 0xF5EFE4))
                            } else {
                                Image(systemName: player.wantsPlayback ? "pause.fill" : "play.fill")
                                    .font(.system(size: 17, weight: .bold))
                                    .foregroundStyle(Color(rgb: 0xF5EFE4))
                            }
                        }
                        .frame(width: 44, height: 44)
                        .contentShape(Circle())
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 8)
        }
    }
}
