import SwiftUI

/// 读经计划播放页（底栏中央键那页，主页级页面，底栏照常）。对应 RN ReadPlanPlayScreen：
/// 计划名 + 齿轮 → 月历（黑底 = 系统今天，黄底 = 选中 / 听过）→ 「进度设置为今日」→ 今日读经逐章列表
/// （单击点播、双击进阅读页、行尾「阅读」「声音」）→ 深读的 52 阶（点选设为今日）。底部播放坞由 shell 挂。
/// 队列 / 正在播的下标由 shell 算好传进来：本页只管「看哪天」（viewAhead）和「选中哪章」（cursor）。
struct PlanPlayView: View {
    @ObservedObject var store: ReadingPlanStore
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
    /// 习惯统计里的已读日（云端同步下来的也在）；月历标黄 = 它 ∪ 播放页点听日（RN habitCompletedDates）
    var habitDates: Set<String> = []
    var onConfirmDay: () -> Void
    /// 深读某阶设为今日后：回到今天、游标归零
    var onStageSet: () -> Void

    private let theme = Parchment.light
    @State private var confirmBusy = false
    @State private var lastRowTap: (index: Int, at: Date)?
    @State private var stageToConfirm: Int?

    private var prefs: ReadingPlanPrefs { store.prefs }
    private var committedAhead: Int { prefs.ahead }
    private var contentAhead: Int { PlanPlay.contentAhead(view: viewAhead, committed: committedAhead) }
    private var browsingAway: Bool { contentAhead != committedAhead }
    /// 点选今天之后的日期时可确认：把进度调到该日对应内容
    private var needsConfirm: Bool { browsingAway && viewAhead >= 0 }
    private var dayCount: Int? { ReadingPlanCatalog.plan(id: prefs.planId)?.dayCount ?? prefs.dayCount }
    private var planName: String { locale.zh(ReadingPlanCatalog.plan(id: prefs.planId)?.title ?? PlanCopy.t("pages.read.planPlayTitle")) }
    private var dayMeta: String { locale.zh(PlanCopy.f("pages.read.todayPlanDayMeta", ["n": "\(PlanPlay.planDayNumber(prefs, dayCount: dayCount, contentAhead: contentAhead))"])) }

    var body: some View {
        GeometryReader { geo in
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 0) {
                    topBar.padding(.top, 8)
                    if queue.isEmpty && !browsingAway {
                        Text(locale.zh(PlanCopy.t("pages.read.todayPlanEmpty")))
                            .font(.system(size: 16)).foregroundStyle(theme.muted)
                            .frame(maxWidth: .infinity).padding(.top, 48)
                    } else {
                        PlanMonthCalendar(locale: locale, prefs: prefs, dayCount: dayCount, viewAhead: viewAhead,
                                          listened: store.listenedDates.union(habitDates), onSelectAhead: { a in viewAhead = a; cursor = 0 })
                            .padding(.top, 8)
                        if needsConfirm {
                            Button {
                                guard !confirmBusy else { return }
                                confirmBusy = true
                                onConfirmDay()
                                confirmBusy = false
                            } label: {
                                Text(locale.zh(PlanCopy.t(confirmBusy ? "pages.read.todayPlanLoading" : "pages.read.planPlayConfirmDay")))
                                    .font(.system(size: 16, weight: .semibold)).foregroundStyle(Color(rgb: 0xF5EFE4))
                                    .frame(maxWidth: .infinity).frame(height: 46)
                                    .background(RoundedRectangle(cornerRadius: 12).fill(theme.ink))
                            }
                            .buttonStyle(.plain).opacity(confirmBusy ? 0.35 : 1).padding(.top, 12)
                        }
                        queueHeader.padding(.top, 18)
                        if queue.isEmpty {
                            Text(locale.zh(PlanCopy.t("pages.read.todayPlanEmpty")))
                                .font(.system(size: 15)).foregroundStyle(theme.muted).frame(maxWidth: .infinity).padding(.vertical, 20)
                        } else {
                            VStack(spacing: 4) {
                                ForEach(Array(queue.enumerated()), id: \.offset) { i, p in
                                    queueRow(index: i, pointer: p)
                                }
                            }
                            .padding(.top, 8)
                        }
                    }
                    if prefs.isNtDeepRepeat {
                        ntStages.padding(.top, 30)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 20)
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

    // MARK: 顶栏：计划名居中 + 齿轮（→ 计划目录）

    private var topBar: some View {
        ZStack {
            Text(planName)
                .font(.system(size: 20, weight: .bold)).foregroundStyle(theme.ink)
                .multilineTextAlignment(.center).lineLimit(2)
                .frame(maxWidth: .infinity).padding(.horizontal, 44)
            HStack {
                Spacer()
                Button(action: onOpenPlans) {
                    MaterialIcon(glyph: MI.settings, size: 22, color: theme.muted)
                        .frame(width: 40, height: 40).contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(locale.zh(PlanCopy.t("pages.read.todayPlanChange")))
            }
        }
        .frame(minHeight: 40)
    }

    // MARK: 列表抬头：第 N 天 · 今日读经 · i / n

    private var queueHeader: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(dayMeta).font(.system(size: 14, weight: .medium)).foregroundStyle(theme.muted)
            Spacer()
            Text(locale.zh(PlanCopy.t("pages.read.todayPlanTitle"))).font(.system(size: 16, weight: .semibold)).foregroundStyle(theme.ink)
            Spacer()
            Text(queue.isEmpty ? " " : PlanCopy.f("pages.read.planPlayTrackMeta", ["current": "\(activeIndex + 1)", "total": "\(queue.count)"]))
                .font(.system(size: 14, weight: .medium)).monospacedDigit().foregroundStyle(theme.muted)
        }
    }

    private func chapterTitle(_ p: PlanPointer) -> String {
        guard let b = BibleCatalog.book(id: p.bookId) else { return "\(p.bookId) \(p.chapter)" }
        return "\(b.name(locale)) \(p.chapter)"
    }

    /// 单击点播；同一行 320ms 内再点 → 进阅读页（RN onRowPress）
    private func rowTapped(_ index: Int) {
        let now = Date()
        if let last = lastRowTap, last.index == index, now.timeIntervalSince(last.at) < 0.32 {
            lastRowTap = nil
            onReadChapter(index)
            return
        }
        lastRowTap = (index, now)
        onPlayChapter(index)
    }

    private func queueRow(index: Int, pointer p: PlanPointer) -> some View {
        let active = index == activeIndex
        let busy = audio.isLoading && audio.wantsPlayback
        return HStack(spacing: 12) {
            Text(String(format: "%02d", index + 1))
                .font(.system(size: 13, weight: active ? .bold : .medium)).monospacedDigit()
                .foregroundStyle(active ? theme.ink : theme.faint)
                .frame(width: 26, alignment: .trailing)
            Text(chapterTitle(p))
                .font(.system(size: 17, weight: active ? .bold : .medium))
                .foregroundStyle(active ? theme.ink : theme.inkSoft)
                .lineLimit(1)
            Spacer(minLength: 8)
            HStack(spacing: 2) {
                Button { onReadChapter(index) } label: {
                    MaterialIcon(glyph: MI.menuBook, size: 20, color: theme.muted).frame(width: 36, height: 36).contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(locale.zh(PlanCopy.t("pages.read.planPlayReadChapter")))
                Button { onPlayChapter(index) } label: {
                    MaterialIcon(glyph: active && activePlaying ? MI.graphicEq : MI.volumeUp, size: 20, color: theme.muted).frame(width: 36, height: 36).contentShape(Rectangle())
                }
                .buttonStyle(.plain).disabled(busy).opacity(busy ? 0.35 : 1)
                .accessibilityLabel(locale.zh(PlanCopy.t("pages.read.planPlayPlayChapterAudio")))
            }
        }
        .padding(.leading, active ? 18 : 12).padding(.trailing, active ? 8 : 2)
        .padding(.vertical, 6)
        .background(RoundedRectangle(cornerRadius: 10).fill(active ? theme.surface.opacity(0.85) : Color.clear))
        .padding(.horizontal, active ? -6 : 0)
        .contentShape(Rectangle())
        .onTapGesture { if !busy { rowTapped(index) } }
        .opacity(busy && !active ? 0.7 : 1)
    }

    // MARK: 深读 52 阶（RN ReadNtDeepRepeatStagesBelowToday）：点选某阶设为今日

    private var ntStages: some View {
        let s = store.nt
        let stages = NtDeepRepeat.curriculum
        return VStack(alignment: .leading, spacing: 0) {
            Text(locale.zh(PlanCopy.t("pages.read.ntDeepRepeatLadderTitle"))).font(.system(size: 18, weight: .bold)).foregroundStyle(theme.ink)
            Text(locale.zh(PlanCopy.f("pages.read.ntDeepRepeatLadderLead", ["stages": "\(stages.count)", "days": "\(s.pace)", "cycle": "\(NtDeepRepeat.oneCycleDays(s.pace))"])))
                .font(.system(size: 15)).lineSpacing(4).foregroundStyle(theme.muted).padding(.top, 6)
            Text(locale.zh(PlanCopy.t("pages.read.ntDeepRepeatStagesBelowHint"))).font(.system(size: 14)).foregroundStyle(theme.faint).padding(.top, 4)
            VStack(spacing: 6) {
                ForEach(Array(stages.enumerated()), id: \.offset) { i, seg in
                    let isCurrent = i == s.curriculumIndex
                    let done = i < s.curriculumIndex
                    Button {
                        if !isCurrent { stageToConfirm = i }
                    } label: {
                        HStack(alignment: .firstTextBaseline, spacing: 10) {
                            Text(locale.zh(PlanCopy.f("pages.read.ntDeepRepeatStageLabel", ["n": "\(i + 1)"])))
                                .font(.system(size: 13, weight: .semibold)).foregroundStyle(isCurrent ? Color(rgb: 0x8A5A00) : theme.faint)
                                .frame(width: 58, alignment: .leading)
                            Text(NtDeepRepeat.stageRange(seg))
                                .font(.system(size: 16, weight: isCurrent ? .semibold : .regular)).foregroundStyle(isCurrent ? theme.ink : theme.inkSoft)
                            Spacer(minLength: 6)
                            if isCurrent {
                                Text(locale.zh(PlanCopy.f("pages.read.ntDeepRepeatStageCurrent", ["day": "\(s.dayInSegment)", "total": "\(s.segmentDayTarget)"])))
                                    .font(.system(size: 12, weight: .semibold)).foregroundStyle(Color(rgb: 0x8A5A00))
                            } else if done {
                                Text(locale.zh(PlanCopy.t("pages.read.ntDeepRepeatStageDone"))).font(.system(size: 12)).foregroundStyle(theme.faint)
                            }
                        }
                        .padding(.horizontal, 12).padding(.vertical, 9)
                        .background(RoundedRectangle(cornerRadius: 10).fill(isCurrent ? Color(rgb: 0xFFECBF, opacity: 0.9) : theme.surface.opacity(0.45)))
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

    private let theme = Parchment.light
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
                Text(PlanPlay.monthLabel(locale: locale, year: y, month: m)).font(.system(size: 20, weight: .bold)).foregroundStyle(theme.ink)
                Spacer()
                navButton(MI.chevronRight, label: "pages.read.planPlayCalendarNextMonth") { move(y, m, 1) }
            }
            HStack(spacing: 0) {
                ForEach(weekdays, id: \.self) { w in
                    Text(w).font(.system(size: 15, weight: .medium)).foregroundStyle(theme.muted).frame(maxWidth: .infinity)
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
                Button { onSelectAhead(cell.ahead) } label: {
                    Text("\(day)")
                        .font(.system(size: 18, weight: todayFill || accentFill ? .bold : .medium)).monospacedDigit()
                        .foregroundStyle(todayFill ? theme.surfaceSolid : (fadeDisabled ? theme.faint : theme.ink))
                        .frame(maxWidth: .infinity).frame(height: 40)
                        .background(RoundedRectangle(cornerRadius: 7).fill(todayFill ? theme.ink : (accentFill ? Brand.logo : Color.clear)))
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
