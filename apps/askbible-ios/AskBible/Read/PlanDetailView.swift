import SwiftUI

/// 计划详情页（手机版精简排版，与 Android PlanDetailScreen 同构）：
/// 徽标 / 标题 / 一句话 / 要点 chips → 今日读经卡 → 开始使用（深读节奏 · 起算方式 · 第几天 · 主按钮）
/// → 怎么读（三条要点）→ 新约 52 阶（进度条 + 可展开）→ 另一条路线 → 了解更多（长版说明、起算日、恢复默认）。
/// 规则（起算 / 推进 / 阶梯）仍在 ReadingPlanStore + ReadingPlans，这里只换排版与文案层级。
struct PlanDetailView: View {
    @ObservedObject var store: ReadingPlanStore
    let planId: String
    var onBack: () -> Void
    var onOpenPlan: (String) -> Void
    var onOpenChapter: (PlanPointer) -> Void
    var onGoHome: () -> Void
    private let theme = Parchment.light

    @State private var anchor: PlanAnchor = .fromToday
    @State private var pace: Int = NtDeepRepeat.defaultPace
    @State private var startDay = 1

    private var plan: ReadingPlanEntry? { ReadingPlanCatalog.plan(id: planId) }
    private var isTriple: Bool { planId == ReadingPlanCatalog.tripleLoopId }
    private var isNt: Bool { planId == ReadingPlanCatalog.ntDeepRepeatId }
    private var isActive: Bool { store.isActive(planId) }
    /// 隐式默认（三循环没落盘）不给「取消」
    private var isImplicitDefault: Bool { isTriple && store.storedPrefs == nil }

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .topLeading) {
                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 0) {
                        if let plan {
                            header(plan)
                            todaySection(plan)
                            setupSection(plan)
                            howSection(plan)
                            if isNt { ladderSection }
                            crossLink
                            moreSection(plan)
                            Button(action: onGoHome) {
                                Text(PlanText.t("seeHome") + " →").font(.system(size: 15)).underline().foregroundStyle(theme.muted)
                            }
                            .buttonStyle(.plain).frame(maxWidth: .infinity).padding(.top, 28)
                        } else {
                            Text(PlanCopy.t("pages.read.plansEmpty")).font(.system(size: 15)).foregroundStyle(theme.muted)
                                .frame(maxWidth: .infinity).padding(.top, 100)
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 24)
                }
                PlanBackButton(action: onBack)
            }
            .background(ParchmentBackground(theme: theme).ignoresSafeArea())
        }
        .onAppear(perform: loadSetup)
    }

    // MARK: 头部

    private func header(_ plan: ReadingPlanEntry) -> some View {
        VStack(spacing: 0) {
            Text(plan.badge).font(.system(size: 14, weight: .semibold)).kerning(0.8).foregroundStyle(Color(rgb: 0x4D3522, opacity: 0.8))
            Text(plan.title).font(.system(size: 28, weight: .bold)).foregroundStyle(theme.ink)
                .multilineTextAlignment(.center).padding(.top, 8)
            Text(plan.tagline).font(.system(size: 18)).lineSpacing(7).foregroundStyle(theme.muted)
                .multilineTextAlignment(.center).padding(.top, 10)
            PlanFactRow(facts: plan.facts, centered: true).padding(.top, 16)
            if isActive {
                let day = store.currentPlanDay(planId, dayCount: plan.dayCount)
                PlanStatusPill(text: PlanText.t("activePill") + (day.map { " · " + PlanText.f("currentDay", ["n": "\($0)"]) } ?? ""))
                    .padding(.top, 14)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 64)
    }

    // MARK: 今日读经

    @ViewBuilder private func todaySection(_ plan: ReadingPlanEntry) -> some View {
        if isTriple {
            PlanSectionHeader(title: PlanText.t("todayHeading"), hint: PlanText.t("todayHint")).padding(.top, 28)
            VStack(spacing: 10) {
                ForEach(TripleTrack.allCases, id: \.self) { track in
                    let p = store.triple[track]
                    PlanTodayCard(track: Self.trackId(track), label: TripleLoop.trackTitle(track),
                                  title: PlanReading(bookId: p.bookId, startChapter: p.chapter, endChapter: p.chapter).display,
                                  subtitle: TripleLoop.formatVerbose(p.bookId, p.chapter)) { onOpenChapter(p) }
                }
            }
            .padding(.top, 12)
        } else if isNt {
            let progress = store.nt
            let total = NtDeepRepeat.segmentDayTarget(progress)
            PlanSectionHeader(title: PlanText.t("todayHeading"), hint: PlanText.t("todayHint")).padding(.top, 28)
            VStack(spacing: 10) {
                if let segment = NtDeepRepeat.currentSegment(progress), let first = segment.ranges.first {
                    PlanTodayCard(track: "nt", label: NtDeepRepeat.trackTitle(.nt),
                                  title: segment.ranges.map(\.display).joined(separator: " · "),
                                  subtitle: PlanText.f("ladderProgress", ["n": "\(progress.curriculumIndex + 1)", "day": "\(progress.dayInSegment)", "total": "\(total)"]),
                                  progress: total > 0 ? Double(progress.dayInSegment) / Double(total) : 0) {
                        onOpenChapter(PlanPointer(bookId: first.bookId, chapter: first.startChapter))
                    }
                }
                PlanTodayCard(track: "ot", label: NtDeepRepeat.trackTitle(.ot),
                              title: PlanReading(bookId: progress.ot.bookId, startChapter: progress.ot.chapter, endChapter: progress.ot.chapter).display,
                              subtitle: NtDeepRepeat.otLine(progress.ot.bookId, progress.ot.chapter)) { onOpenChapter(progress.ot) }
            }
            .padding(.top, 12)
        } else if isActive {
            // 经典日课表：只有设为当前计划后才有「今日」可言
            let today = store.today
            PlanSectionHeader(title: PlanText.t("todayHeading"), hint: today.metaLine).padding(.top, 28)
            VStack(spacing: 10) {
                ForEach(Array(today.readings.enumerated()), id: \.offset) { _, r in
                    if let first = r.chapters.first {
                        PlanTodayCard(track: nil, label: plan.title, title: r.display, subtitle: nil) { onOpenChapter(first) }
                    }
                }
            }
            .padding(.top, 12)
        }
    }

    private static func trackId(_ t: TripleTrack) -> String {
        switch t { case .ot: return "ot"; case .nt: return "nt"; case .wisdom: return "wisdom" }
    }

    // MARK: 开始使用

    @ViewBuilder private func setupSection(_ plan: ReadingPlanEntry) -> some View {
        if isTriple {
            if !isActive {
                PlanPrimaryButton(title: PlanText.t("use")) { activate(plan) }.padding(.top, 28)
            } else if !isImplicitDefault {
                clearLink.padding(.top, 20)
            }
        } else {
            PlanSectionHeader(title: PlanText.t("setupHeading")).padding(.top, 32)
            if isNt {
                subheading(PlanText.t("paceHeading"), PlanText.t("paceHint")).padding(.top, 14)
                HStack(spacing: 10) {
                    ForEach(NtDeepRepeat.paces, id: \.self) { p in
                        PlanChoiceTile(title: SiteCopy.f("native.days", ["n": "\(p)"]), subtitle: PlanText.t("pace\(p)"), on: pace == p) { pace = p }
                    }
                }
                .padding(.top, 10)
                Text(PlanText.f("paceEnd", ["endDate": endDateLabel])).font(.system(size: 15)).foregroundStyle(theme.muted).padding(.top, 10)
            } else {
                HStack(spacing: 10) {
                    PlanChoiceTile(title: PlanText.t("anchorToday"), subtitle: PlanText.t("anchorTodayHint"), on: anchor == .fromToday) { anchor = .fromToday }
                    PlanChoiceTile(title: PlanText.t("anchorJan1"), subtitle: PlanText.t("anchorJan1Hint"), on: anchor == .calendarJan1) { anchor = .calendarJan1 }
                }
                .padding(.top, 14)
            }
            if supportsStartDay {
                subheading(PlanText.t("startDayHeading"), PlanText.t("startDayHint")).padding(.top, 22)
                PlanStepper(value: $startDay, range: 1...maxStartDay(plan)).padding(.top, 10)
            }
            PlanPrimaryButton(title: PlanText.t(isActive ? "update" : "use")) { activate(plan) }.padding(.top, 22)
            if isActive { clearLink.padding(.top, 14) }
        }
    }

    private func subheading(_ title: String, _ hint: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.system(size: 16, weight: .semibold)).foregroundStyle(theme.ink)
            Text(hint).font(.system(size: 15)).lineSpacing(4).foregroundStyle(theme.muted)
        }
    }

    private var clearLink: some View {
        Button { store.clearPlan() } label: {
            Text(PlanText.t("clear")).font(.system(size: 15)).underline().foregroundStyle(theme.muted)
        }
        .buttonStyle(.plain).frame(maxWidth: .infinity)
    }

    private var supportsStartDay: Bool { isNt || (!isTriple && anchor == .fromToday) }
    private func maxStartDay(_ plan: ReadingPlanEntry) -> Int { isNt ? 365 : max(1, plan.dayCount) }

    private func activate(_ plan: ReadingPlanEntry) {
        store.activate(planId: plan.planId, dayCount: plan.dayCount, anchor: isTriple ? .calendarEaster : anchor, pace: pace, startDay: startDay)
    }

    private func loadSetup() {
        if let stored = store.storedPrefs, stored.planId == planId {
            anchor = stored.anchor
        } else {
            anchor = isTriple ? .calendarEaster : .fromToday
        }
        pace = store.storedPrefs?.ntDeepRepeatPace ?? store.prefs.ntDeepRepeatPace ?? NtDeepRepeat.defaultPace
        if let plan, supportsStartDay, let day = store.currentPlanDay(planId, dayCount: plan.dayCount) {
            startDay = min(maxStartDay(plan), max(1, day))
        }
    }

    private var endDateLabel: String {
        let end = PlanDates.addDays(Date(), pace - 1)
        // RN NtDeepRepeatPaceSection：toLocaleDateString(en-US / zh-CN)
        let f = DateFormatter()
        if AppLocale.current == .en { f.locale = Locale(identifier: "en_US"); f.dateFormat = "EEE, MMM d" }
        else { f.locale = Locale(identifier: "zh_CN"); f.dateFormat = "M月d日 EEE" }
        return f.string(from: end)
    }

    // MARK: 怎么读 / 52 阶 / 另一条路线 / 了解更多

    private func howSection(_ plan: ReadingPlanEntry) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            PlanSectionHeader(title: PlanText.t("howHeading"))
            ForEach(Array(plan.how.enumerated()), id: \.offset) { _, f in PlanHowRow(fact: f) }
        }
        .padding(.top, 32)
    }

    private var ladderSection: some View {
        let progress = store.nt
        let total = NtDeepRepeat.segmentDayTarget(progress)
        let current = NtDeepRepeat.currentSegment(progress)
        return VStack(alignment: .leading, spacing: 10) {
            PlanSectionHeader(title: PlanText.t("ladderHeading"))
            PlanProgressBar(value: Double(progress.curriculumIndex) / Double(NtDeepRepeat.stageCount)).padding(.top, 4)
            Text(PlanText.f("ladderProgress", ["n": "\(progress.curriculumIndex + 1)", "day": "\(progress.dayInSegment)", "total": "\(total)"]))
                .font(.system(size: 16, weight: .medium)).foregroundStyle(theme.ink)
            if let current { Text(NtDeepRepeat.stageRange(current)).font(.system(size: 16)).foregroundStyle(theme.muted) }
            PlanDisclosure(openTitle: PlanText.t("ladderOpen"), closeTitle: PlanText.t("ladderClose")) {
                VStack(spacing: 0) {
                    ForEach(Array(NtDeepRepeat.curriculum.enumerated()), id: \.offset) { index, seg in
                        let isCurrent = index == progress.curriculumIndex
                        let isDone = index < progress.curriculumIndex
                        HStack(spacing: 10) {
                            Text(PlanCopy.f("pages.read.ntDeepRepeatStageLabel", ["n": "\(index + 1)"]))
                                .font(.system(size: 15, weight: isCurrent ? .semibold : .regular))
                                .foregroundStyle(isCurrent ? theme.ink : theme.faint).frame(width: 66, alignment: .leading)
                            Text(NtDeepRepeat.stageRange(seg)).font(.system(size: 16, weight: isCurrent ? .semibold : .regular))
                                .foregroundStyle(isCurrent ? theme.ink : (isDone ? theme.muted : theme.faint))
                            Spacer(minLength: 0)
                            if isCurrent {
                                Text(PlanText.t("stageCurrent")).font(.system(size: 14, weight: .semibold)).foregroundStyle(Color(rgb: 0x8A5A00))
                            } else if isDone {
                                MaterialIcon(glyph: MI.check, size: 18, color: theme.faint)
                            }
                        }
                        .padding(.vertical, 8).padding(.horizontal, 10)
                        .background(RoundedRectangle(cornerRadius: 8).fill(isCurrent ? Color(rgb: 0xFFECBF, opacity: 0.6) : Color.clear))
                    }
                }
            }
        }
        .padding(.top, 32)
    }

    @ViewBuilder private var crossLink: some View {
        if isTriple {
            PlanLinkCard(title: PlanText.t("toDeepTitle"), lead: PlanText.t("toDeepLead")) { onOpenPlan(ReadingPlanCatalog.ntDeepRepeatId) }
                .padding(.top, 28)
        } else if isNt {
            PlanLinkCard(title: PlanText.t("toLightTitle"), lead: PlanText.t("toLightLead")) { onOpenPlan(ReadingPlanCatalog.tripleLoopId) }
                .padding(.top, 28)
        }
    }

    private func moreSection(_ plan: ReadingPlanEntry) -> some View {
        PlanDisclosure(openTitle: PlanText.t("moreOpen"), closeTitle: PlanText.t("moreClose")) {
            VStack(alignment: .leading, spacing: 12) {
                Text(plan.detail).font(.system(size: 16)).lineSpacing(7).foregroundStyle(theme.muted)
                if isTriple {
                    Text(PlanText.f("epochTriple", ["date": Self.easterLabel, "n": "\(PlanDates.daySinceEpoch())"]))
                        .font(.system(size: 15)).lineSpacing(5).foregroundStyle(theme.faint)
                } else if isNt {
                    Text(PlanText.f("epochNt", ["n": "\(ReadingPlanRules.effectiveEpochDay(store.prefs))"]))
                        .font(.system(size: 15)).lineSpacing(5).foregroundStyle(theme.faint)
                }
                if (isTriple && store.hasUserTriple) || (isNt && store.hasUserNt) {
                    Button { if isTriple { store.resetTripleToDefault() } else { store.resetNt() } } label: {
                        Text(PlanText.t("resetDefault")).font(.system(size: 15)).underline().foregroundStyle(theme.muted)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.top, 24)
    }

    /// PlanDates.easterEpoch（2026-04-05）→「2026 年 4 月 5 日」
    private static var easterLabel: String {
        let parts = PlanDates.easterEpoch.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return PlanDates.easterEpoch }
        if AppLocale.current == .en {
            let f = DateFormatter(); f.locale = Locale(identifier: "en_US"); f.dateFormat = "MMMM d, yyyy"
            var c = DateComponents(); c.year = parts[0]; c.month = parts[1]; c.day = parts[2]
            if let d = Calendar.current.date(from: c) { return f.string(from: d) }
        }
        return "\(parts[0]) 年 \(parts[1]) 月 \(parts[2]) 日"
    }
}
