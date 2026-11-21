import SwiftUI

/// 读经计划播放页（底栏中央键那页，主页级页面，底栏照常）。对应 RN ReadPlanPlayScreen：
/// 计划名 + 齿轮 → 月历（黑底 = 系统今天，黄底 = 选中 / 听过）→ 「进度设置为今日」→ 今日读经逐章列表
/// （单击点播、双击进阅读页、行尾「阅读」「声音」）→ 深读的 52 阶（点选设为今日）。底部播放坞由 shell 挂。
/// 队列 / 正在播的下标由 shell 算好传进来：本页只管「看哪天」（viewAhead）和「选中哪章」（cursor）。
struct PlanPlayView: View {
    @ObservedObject var store: ReadingPlanStore
    @ObservedObject var devotionals: SolidJoys
    @ObservedObject var devotionalPlayer: DevotionalPlayer
    var showDevotional: Bool
    @ObservedObject var audio: ChapterAudioPlayer
    let locale: AppLocale
    /// 正在看的那天的逐章队列（shell 按 viewAhead 算）
    let queue: [PlanPointer]
    /// 高亮行：池在播且与本页队列一致时跟池的下标，否则跟 cursor
    let activeIndex: Int
    /// 高亮行正在出声（行尾图标换成 graphic-eq）
    let activePlaying: Bool
    @Binding var viewAhead: Int
    @Binding var cursor: Int
    var onPlayChapter: (Int) -> Void
    var onReadChapter: (Int) -> Void
    var onOpenPlans: () -> Void
    /// 书卷名：跟当前版本（点这一行进去读的就是它）；默认退回目录里的中英名
    var bookLabel: (BookRef) -> String = { $0.name(AppLocale.current) }
    /// 习惯统计里的已读日（云端同步下来的也在）；月历标黄 = 它 ∪ 播放页点听日（RN habitCompletedDates）
    var habitDates: Set<String> = []
    var onConfirmDay: () -> Void
    /// 深读某阶设为今日后：回到今天、游标归零
    var onStageSet: () -> Void

    @Environment(\.parchment) private var theme
    @State private var confirmBusy = false
    @State private var stageToConfirm: Int?
    @State private var monthExpanded = false

    private var prefs: ReadingPlanPrefs { store.prefs }
    private var committedAhead: Int { prefs.ahead }
    private var contentAhead: Int { PlanPlay.contentAhead(view: viewAhead, committed: committedAhead) }
    private var browsingAway: Bool { contentAhead != committedAhead }
    /// 点选今天之后的日期时可确认：把进度调到该日对应内容
    private var needsConfirm: Bool { browsingAway && viewAhead >= 0 }
    private var dayCount: Int? { ReadingPlanCatalog.plan(id: prefs.planId)?.dayCount ?? prefs.dayCount }
    private var planName: String { locale.zh(ReadingPlanCatalog.plan(id: prefs.planId)?.title ?? PlanCopy.t("pages.read.planPlayTitle")) }
    private var dayMeta: String { locale.zh(PlanCopy.f("pages.read.todayPlanDayMeta", ["n": "\(PlanPlay.planDayNumber(prefs, dayCount: dayCount, contentAhead: contentAhead, tripleBaseDay: store.triplePlanDay()))"])) }
    private var allDoneDates: Set<String> { store.listenedDates.union(habitDates) }

    var body: some View {
        GeometryReader { geo in
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 0) {
                    topBar.padding(.top, 14)
                    if queue.isEmpty && !browsingAway {
                        Text(locale.zh(PlanCopy.t("pages.read.todayPlanEmpty")))
                            .askFont(size: 16).foregroundStyle(theme.muted)
                            .frame(maxWidth: .infinity).padding(.top, 48)
                    } else {
                        weekStripCard.padding(.top, 14)
                        if needsConfirm {
                            Button {
                                guard !confirmBusy else { return }
                                confirmBusy = true
                                onConfirmDay()
                                confirmBusy = false
                            } label: {
                                Text(locale.zh(PlanCopy.t(confirmBusy ? "pages.read.todayPlanLoading" : "pages.read.planPlayConfirmDay")))
                                    .askFont(size: 15, weight: .semibold).foregroundStyle(.white)
                                    .frame(maxWidth: .infinity).frame(height: 44)
                                    .background(RoundedRectangle(cornerRadius: 12).fill(theme.accentOt))
                            }
                            .buttonStyle(.plain).opacity(confirmBusy ? 0.35 : 1).padding(.top, 10)
                        }
                        queueHeader.padding(.top, 20)
                        if queue.isEmpty {
                            Text(locale.zh(PlanCopy.t("pages.read.todayPlanEmpty")))
                                .askFont(size: 15).foregroundStyle(theme.muted).frame(maxWidth: .infinity).padding(.vertical, 20)
                        } else {
                            VStack(spacing: 10) {
                                ForEach(Array(queue.enumerated()), id: \.offset) { i, p in
                                    queueRow(index: i, pointer: p)
                                }
                            }
                            .padding(.top, 12)
                        }
                    }
                    if showDevotional {
                        DevotionalCard(content: devotionals, player: devotionalPlayer,
                                       date: PlanDates.addDays(Date(), viewAhead), locale: locale).padding(.top, 24)
                    }
                    if prefs.isNtDeepRepeat {
                        ntStages.padding(.top, 30)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 24)
            }
            .shellBottomInset(hasDock: !queue.isEmpty)
            .background(ParchmentBackground(theme: theme).ignoresSafeArea())
        }
        .alert(locale.zh(PlanCopy.t("pages.read.ntDeepRepeatSetStageAsTodayTitle")), isPresented: Binding(get: { stageToConfirm != nil }, set: { if !$0 { stageToConfirm = nil } })) {
            Button(locale.zh(PlanCopy.t("pages.read.ntDeepRepeatSetStageAsTodayCancel")), role: .cancel) { stageToConfirm = nil }
            Button(locale.zh(PlanCopy.t("pages.read.ntDeepRepeatSetStageAsTodayConfirm"))) {
                if let i = stageToConfirm { store.setNtStageAsToday(i); onStageSet() }
                stageToConfirm = nil
            }
        } message: {
            if let i = stageToConfirm, let seg = NtDeepRepeat.segment(i) {
                Text(locale.zh(PlanCopy.f("pages.read.ntDeepRepeatSetStageAsTodayBody", ["n": "\(i + 1)", "range": NtDeepRepeat.stageRange(seg)])))
            }
        }
    }

    // MARK: 顶栏：「今日同行」左对齐 + 副标题（计划名 · 第N天） + 右侧「换计划」胶囊

    private var topBar: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(AppLocale.pick("今日同行", "Today's Walk", locale))
                    .askFont(size: 26, weight: .bold)
                    .foregroundStyle(theme.ink)
                Text("\(planName) · \(dayMeta)")
                    .askFont(size: 13.5, weight: .medium)
                    .foregroundStyle(theme.muted)
                    .lineLimit(1)
            }
            Spacer(minLength: 8)
            Button(action: onOpenPlans) {
                Text(AppLocale.pick("换计划", "Plans", locale))
                    .askFont(size: 13, weight: .semibold)
                    .foregroundStyle(theme.muted)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(Capsule().fill(theme.surface.opacity(0.75)))
                    .overlay(Capsule().strokeBorder(theme.border, lineWidth: 1))
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(locale.zh(PlanCopy.t("pages.read.todayPlanChange")))
        }
    }

    // MARK: 7 日温和周历条（点月份可下拉展开整月日历）

    private var weekStripCard: some View {
        let today = Date()
        let selectedDate = PlanDates.addDays(today, viewAhead)
        let cal = Calendar.current
        let ym = cal.dateComponents([.year, .month], from: selectedDate)
        let monthTitle = PlanPlay.monthLabel(locale: locale, year: ym.year ?? 2026, month: ym.month ?? 1)
        let weekday = cal.component(.weekday, from: selectedDate) // 1 = Sun ... 7 = Sat
        let mondayOffset = (weekday + 5) % 7 // 0 = Mon ... 6 = Sun
        let weekStartAhead = viewAhead - mondayOffset
        let weekLabels = locale == .en ? ["M", "T", "W", "T", "F", "S", "S"] : ["一", "二", "三", "四", "五", "六", "日"]
        let doneOlive = theme.isDark ? Color(rgb: 0xA8BC72) : Color(rgb: 0x65775C)

        var weekDoneCount = 0
        for step in 0..<7 {
            let d = PlanDates.addDays(today, weekStartAhead + step)
            if allDoneDates.contains(PlanPlay.isoDate(d)) { weekDoneCount += 1 }
        }

        return VStack(spacing: 12) {
            HStack {
                Button {
                    withAnimation(.easeInOut(duration: 0.25)) { monthExpanded.toggle() }
                } label: {
                    HStack(spacing: 4) {
                        Text(monthTitle)
                            .askFont(size: 14, weight: .bold)
                            .foregroundStyle(theme.ink)
                        Image(systemName: monthExpanded ? "chevron.up" : "chevron.down")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(theme.accentOt)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                Spacer()

                Text(locale == .en ? "\(weekDoneCount) days this week" : "本周相伴 \(weekDoneCount) 天")
                    .askFont(size: 12.5, weight: .medium)
                    .foregroundStyle(doneOlive)
            }

            HStack(spacing: 4) {
                ForEach(0..<7, id: \.self) { step in
                    let cellAhead = weekStartAhead + step
                    let cellDate = PlanDates.addDays(today, cellAhead)
                    let dayNum = cal.component(.day, from: cellDate)
                    let isToday = cellAhead == 0
                    let isSelected = cellAhead == viewAhead
                    let isDone = allDoneDates.contains(PlanPlay.isoDate(cellDate))
                    let selectable = PlanPlay.isAheadSelectable(prefs, dayCount: dayCount, ahead: cellAhead)

                    Button {
                        if selectable { viewAhead = cellAhead; cursor = 0 }
                    } label: {
                        VStack(spacing: 5) {
                            Text(weekLabels[step])
                                .askFont(size: 11, weight: .medium)
                                .foregroundStyle(isSelected ? Color.white.opacity(0.88) : theme.muted)
                            Text("\(dayNum)")
                                .askFont(size: 15, weight: .bold).monospacedDigit()
                                .foregroundStyle(isSelected ? Color.white : theme.ink)
                            Circle()
                                .fill(isDone ? (isSelected ? Color.white : doneOlive) : Color.clear)
                                .frame(width: 5, height: 5)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background(
                            Capsule()
                                .fill(isSelected ? theme.accentOt : (isToday ? theme.accentOt.opacity(0.16) : Color.clear))
                        )
                        .opacity(!selectable && !isDone ? 0.38 : 1)
                    }
                    .buttonStyle(.plain)
                    .disabled(!selectable)
                }
            }

            if monthExpanded {
                Divider().overlay(theme.border)
                PlanMonthCalendar(
                    locale: locale, prefs: prefs, dayCount: dayCount, viewAhead: viewAhead,
                    listened: allDoneDates,
                    onSelectAhead: { a in viewAhead = a; cursor = 0 }
                )
                .padding(.top, 2)
            }
        }
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(theme.border, lineWidth: 1))
    }

    // MARK: 列表抬头：今日经文 + 右侧「▶ 连播今日」主胶囊

    private var queueHeader: some View {
        HStack(alignment: .center) {
            Text(locale.zh(PlanCopy.t("pages.read.todayPlanTitle")))
                .askFont(size: 18, weight: .bold)
                .foregroundStyle(theme.ink)
            Spacer()
            if !queue.isEmpty {
                Button {
                    onPlayChapter(0)
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "play.fill")
                            .font(.system(size: 10, weight: .bold))
                        Text(AppLocale.pick("连播今日", "Play today", locale))
                            .askFont(size: 13, weight: .semibold)
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 7)
                    .background(Capsule().fill(theme.accentOt))
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func chapterTitle(_ p: PlanPointer) -> String {
        guard let b = BibleCatalog.book(id: p.bookId) else { return "\(p.bookId) \(p.chapter)" }
        return ReadChrome.chapterTitle(bookName: bookLabel(b), chapter: p.chapter, locale: locale)
    }

    /// 职责分明的章节卡片：点左侧主体 = 直接进入该章安静阅读；点右侧 44pt 独立圆钮 = 播放该章朗读（废除 320ms 双击陷阱）
    private func queueRow(index: Int, pointer p: PlanPointer) -> some View {
        let active = index == activeIndex
        let busy = audio.isLoading && audio.wantsPlayback
        let bookIntro = BiblePanorama.shared.introductions[p.bookId]
        let subtitle = bookIntro.map { AppLocale.pick($0.zh, $0.en, locale) } ?? ""

        return HStack(spacing: 12) {
            Button {
                onReadChapter(index)
            } label: {
                HStack(spacing: 12) {
                    Text(String(format: "%02d", index + 1))
                        .askFont(size: 15, weight: .bold).monospacedDigit()
                        .foregroundStyle(active ? theme.ink : theme.faint)
                        .frame(width: 26, alignment: .leading)

                    VStack(alignment: .leading, spacing: 2) {
                        Text(chapterTitle(p))
                            .askFont(size: 16.5, weight: .bold)
                            .foregroundStyle(theme.ink)
                            .lineLimit(1)
                        if !subtitle.isEmpty {
                            Text(subtitle)
                                .askFont(size: 12)
                                .foregroundStyle(theme.muted)
                                .lineLimit(1)
                        }
                    }
                    Spacer(minLength: 4)
                }
                .padding(.vertical, 6)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(locale.zh(PlanCopy.t("pages.read.planPlayReadChapter")))

            Button {
                onPlayChapter(index)
            } label: {
                ZStack {
                    Circle()
                        .fill(active && activePlaying ? theme.ink : theme.accentOt.opacity(0.15))
                    Image(systemName: active && activePlaying ? "waveform" : "play.fill")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(active && activePlaying ? Brand.logo : theme.accentOt)
                }
                .frame(width: 44, height: 44)
                .contentShape(Circle())
            }
            .buttonStyle(.plain)
            .disabled(busy)
            .opacity(busy ? 0.35 : 1)
            .accessibilityLabel(locale.zh(PlanCopy.t("pages.read.planPlayPlayChapterAudio")))
        }
        .padding(.leading, 14)
        .padding(.trailing, 10)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(active ? theme.surface : theme.surface.opacity(0.52))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(active ? theme.accentOt : theme.border, lineWidth: active ? 1.2 : 0.75)
        )
        .opacity(busy && !active ? 0.75 : 1)
    }

    // MARK: 深读 52 阶（RN ReadNtDeepRepeatStagesBelowToday）：点选某阶设为今日

    private var ntStages: some View {
        let s = store.nt
        let stages = NtDeepRepeat.curriculum
        return VStack(alignment: .leading, spacing: 0) {
            Text(locale.zh(PlanCopy.t("pages.read.ntDeepRepeatLadderTitle"))).askFont(size: 18, weight: .bold).foregroundStyle(theme.ink)
            Text(locale.zh(PlanCopy.f("pages.read.ntDeepRepeatLadderLead", ["stages": "\(stages.count)", "days": "\(s.pace)", "cycle": "\(NtDeepRepeat.oneCycleDays(s.pace))"])))
                .askFont(size: 15).lineSpacing(4).foregroundStyle(theme.muted).padding(.top, 6)
            Text(locale.zh(PlanCopy.t("pages.read.ntDeepRepeatStagesBelowHint"))).askFont(size: 14).foregroundStyle(theme.faint).padding(.top, 4)
            VStack(spacing: 6) {
                ForEach(Array(stages.enumerated()), id: \.offset) { i, seg in
                    let isCurrent = i == s.curriculumIndex
                    let done = i < s.curriculumIndex
                    Button {
                        // 当前阶也能点：本阶从第 1 天重来
                        if !isCurrent || s.dayInSegment > 1 { stageToConfirm = i }
                    } label: {
                        HStack(alignment: .firstTextBaseline, spacing: 10) {
                            let currentAccent = theme.isDark ? Brand.logo : Color(parchment: 0x8A5A00)
                            Text(locale.zh(PlanCopy.f("pages.read.ntDeepRepeatStageLabel", ["n": "\(i + 1)"])))
                                .askFont(size: 13, weight: .semibold).foregroundStyle(isCurrent ? currentAccent : theme.faint)
                                .frame(width: 58, alignment: .leading)
                            Text(NtDeepRepeat.stageRange(seg))
                                .askFont(size: 16, weight: isCurrent ? .semibold : .regular).foregroundStyle(isCurrent ? theme.ink : theme.inkSoft)
                            Spacer(minLength: 6)
                            if isCurrent {
                                Text(locale.zh(PlanCopy.f("pages.read.ntDeepRepeatStageCurrent", ["day": "\(s.dayInSegment)", "total": "\(s.segmentDayTarget)"])))
                                    .askFont(size: 12, weight: .semibold).foregroundStyle(currentAccent)
                            } else if done {
                                Text(locale.zh(PlanCopy.t("pages.read.ntDeepRepeatStageDone"))).askFont(size: 12).foregroundStyle(theme.faint)
                            }
                        }
                        .padding(.horizontal, 12).padding(.vertical, 9)
                        .background(RoundedRectangle(cornerRadius: 10).fill(isCurrent ? (theme.isDark ? Brand.logo.opacity(0.18) : Color(parchment: 0xFFECBF, opacity: 0.9)) : theme.surface.opacity(0.45)))
                        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(isCurrent ? Color(rgb: 0xFFB101, opacity: 0.7) : theme.border, lineWidth: isCurrent ? 1 : 0.5))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.top, 12)
        }
    }
}

/// 月历（RN ReadPlanPlayMonthCalendar）：黑底 = 系统今天（不随「进度设置为今日」移动）；黄底 = 选中浏览日或听过的日子；
/// 计划外的日子淡显不可点，但听过的日子仍保留黄标。
struct PlanMonthCalendar: View {
    let locale: AppLocale
    let prefs: ReadingPlanPrefs
    let dayCount: Int?
    let viewAhead: Int
    let listened: Set<String>
    var onSelectAhead: (Int) -> Void

    @Environment(\.parchment) private var theme
    @State private var cursorYear = 0
    @State private var cursorMonth = 0

    private var today: Date { Date() }
    private var selectedYM: (Int, Int) {
        let d = PlanDates.addDays(today, viewAhead)
        let c = Calendar.current.dateComponents([.year, .month], from: d)
        return (c.year!, c.month!)
    }

    var body: some View {
        let (selY, selM) = selectedYM
        let y = cursorYear == 0 ? selY : cursorYear
        let m = cursorMonth == 0 ? selM : cursorMonth
        let rows = PlanPlay.monthGrid(year: y, month: m, today: today, viewAhead: viewAhead, listened: listened) { ahead in
            PlanPlay.isAheadSelectable(prefs, dayCount: dayCount, ahead: ahead)
        }
        let weekdays = locale == .en ? PlanPlay.weekdaysEn : PlanPlay.weekdaysZh
        VStack(spacing: 0) {
            HStack {
                navButton(MI.chevronLeft, label: "pages.read.planPlayCalendarPrevMonth") { move(y, m, -1) }
                Spacer()
                Text(PlanPlay.monthLabel(locale: locale, year: y, month: m)).askFont(size: 20, weight: .bold).foregroundStyle(theme.ink)
                Spacer()
                navButton(MI.chevronRight, label: "pages.read.planPlayCalendarNextMonth") { move(y, m, 1) }
            }
            HStack(spacing: 0) {
                ForEach(weekdays, id: \.self) { w in
                    Text(w).askFont(size: 15, weight: .medium).foregroundStyle(theme.muted).frame(maxWidth: .infinity)
                }
            }
            .padding(.top, 8)
            ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                HStack(spacing: 0) {
                    ForEach(Array(row.enumerated()), id: \.offset) { _, cell in
                        cellView(cell)
                    }
                }
            }
        }
        .onChange(of: viewAhead) { _, _ in cursorYear = 0; cursorMonth = 0 }
    }

    private func move(_ y: Int, _ m: Int, _ delta: Int) {
        var nm = m + delta, ny = y
        if nm < 1 { nm = 12; ny -= 1 }
        if nm > 12 { nm = 1; ny += 1 }
        cursorYear = ny; cursorMonth = nm
    }

    private func navButton(_ glyph: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            MaterialIcon(glyph: glyph, size: 28, color: theme.ink).frame(width: 40, height: 40).contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(locale.zh(PlanCopy.t(label)))
    }

    private func cellView(_ cell: PlanPlay.CalendarCell) -> some View {
        Group {
            if let day = cell.day {
                let disabled = !cell.selectable
                let todayFill = cell.isToday
                let accentFill = !todayFill && (cell.isSelected || cell.isListened)
                let fadeDisabled = disabled && !cell.isListened
                let dayTextColor: Color = todayFill
                    ? .white
                    : (accentFill ? Color(rgb: 0x1C1410) : (fadeDisabled ? theme.faint : theme.ink))
                Button { onSelectAhead(cell.ahead) } label: {
                    Text("\(day)")
                        .askFont(size: 18, weight: todayFill || accentFill ? .bold : .medium).monospacedDigit()
                        .foregroundStyle(dayTextColor)
                        .frame(maxWidth: .infinity).frame(height: 40)
                        .background(RoundedRectangle(cornerRadius: 7).fill(todayFill ? theme.accentOt : (accentFill ? Brand.logo : Color.clear)))
                        .padding(.vertical, 2).padding(.horizontal, 2)
                }
                .buttonStyle(.plain)
                .disabled(disabled)
                .opacity(fadeDisabled ? 0.35 : 1)
            } else {
                Color.clear.frame(maxWidth: .infinity).frame(height: 44)
            }
        }
    }
}
