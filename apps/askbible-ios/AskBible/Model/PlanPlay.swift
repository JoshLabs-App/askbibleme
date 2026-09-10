import Foundation

/// 读经计划播放页（中央键那页）的纯逻辑，对应 RN ReadPlanPlayScreen / ReadPlanPlayMonthCalendar /
/// lib/read/plan-play-content-ahead。页面状态：viewAhead = 日历上点选的日子相对系统今天的偏移；
/// committedAhead = prefs.aheadDays（用户确认过的「进度超前」天数）；两者相加才是列表要显示的那一天。
enum PlanPlay {
    /// resolvePlanPlayContentAhead：黑底永远是系统今天，aheadDays 平移整本日历
    static func contentAhead(view: Int, committed: Int) -> Int { view + max(0, committed) }

    /// 日历某天能不能点：指针型计划（三循环 / 深读）任意天都行；日课表要落在 0..<dayCount 内
    static func isAheadSelectable(_ prefs: ReadingPlanPrefs, dayCount: Int?, ahead: Int, now: Date = Date()) -> Bool {
        if prefs.isPointerPlan { return true }
        let count = dayCount ?? prefs.dayCount ?? 365
        if count < 1 { return false }
        let dayIndex = ReadingPlanRules.dayIndex(prefs, dayCount: count, now: now) + ahead
        return dayIndex >= 0 && dayIndex < count
    }

    /// 列表抬头「第 N 天」：指针型 = 日历第几天 + 偏移；日课表 = 下标 + 1 + 偏移
    /// tripleBaseDay：三循环「今天是第几天」的基准。用户自选了起点就传他那条线（ReadingPlanStore.triplePlanDay），
    /// 不传照旧按复活节历元
    static func planDayNumber(_ prefs: ReadingPlanPrefs, dayCount: Int?, contentAhead: Int, now: Date = Date(),
                              tripleBaseDay: Int? = nil) -> Int {
        if prefs.isTripleLoop { return max(1, (tripleBaseDay ?? PlanDates.daySinceEpoch(now)) + contentAhead) }
        if prefs.isNtDeepRepeat { return max(1, ReadingPlanRules.ntPlanDay(prefs, now: now) + contentAhead) }
        let count = dayCount ?? prefs.dayCount ?? 365
        return ReadingPlanRules.dayIndex(prefs, dayCount: count, now: now) + 1 + contentAhead
    }

    /// 日课表某一天的下标（浏览别的日子时按日历下标 + 偏移，夹在表内）
    static func registryDayIndex(_ prefs: ReadingPlanPrefs, dayCount: Int, contentAhead: Int, now: Date = Date()) -> Int {
        if dayCount < 1 { return 0 }
        let idx = ReadingPlanRules.dayIndex(prefs, dayCount: dayCount, now: now) + contentAhead
        return min(max(0, idx), dayCount - 1)
    }

    // MARK: 月历

    struct CalendarCell: Equatable {
        /// nil = 月首月尾的空格
        let day: Int?
        let ahead: Int
        let selectable: Bool
        let isToday: Bool
        let isSelected: Bool
        let isListened: Bool
        let iso: String
    }

    static let weekdaysZh = ["日", "一", "二", "三", "四", "五", "六"]
    static let weekdaysEn = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

    /// 某年某月的格子，按周分行（周日起）。`today` 是系统今天（本地日历），`selectable(ahead)` 由计划决定。
    static func monthGrid(year: Int, month: Int, today: Date, viewAhead: Int, listened: Set<String>,
                          selectable: (Int) -> Bool) -> [[CalendarCell]] {
        let cal = Calendar.current
        let todayParts = cal.dateComponents([.year, .month, .day], from: today)
        let todayCivil = PlanDates.daysFromCivil(todayParts.year!, todayParts.month!, todayParts.day!)
        let first = cal.date(from: DateComponents(year: year, month: month, day: 1))!
        // Calendar.weekday：1 = 周日
        let startPad = cal.component(.weekday, from: first) - 1
        let daysInMonth = cal.range(of: .day, in: .month, for: first)!.count
        let total = Int(ceil(Double(startPad + daysInMonth) / 7.0)) * 7
        var cells: [CalendarCell] = []
        for i in 0..<total {
            let dayNum = i - startPad + 1
            if dayNum < 1 || dayNum > daysInMonth {
                cells.append(CalendarCell(day: nil, ahead: 0, selectable: false, isToday: false, isSelected: false, isListened: false, iso: ""))
                continue
            }
            let ahead = PlanDates.daysFromCivil(year, month, dayNum) - todayCivil
            let iso = String(format: "%04d-%02d-%02d", year, month, dayNum)
            cells.append(CalendarCell(day: dayNum, ahead: ahead, selectable: selectable(ahead),
                                      isToday: ahead == 0, isSelected: ahead == viewAhead, isListened: listened.contains(iso), iso: iso))
        }
        return stride(from: 0, to: cells.count, by: 7).map { Array(cells[$0..<min($0 + 7, cells.count)]) }
    }

    static func monthLabel(locale: AppLocale, year: Int, month: Int) -> String {
        if locale == .en {
            let f = DateFormatter(); f.locale = Locale(identifier: "en_US"); f.dateFormat = "MMMM yyyy"
            return f.string(from: Calendar.current.date(from: DateComponents(year: year, month: month, day: 1))!)
        }
        return locale.zh(PlanCopy.f("pages.read.planPlayCalendarMonth", ["y": "\(year)", "m": "\(month)"]))
    }

    /// 对拍用：一行一个周，格子写成 d:ahead:flags（T 今天 / S 选中 / L 听过 / x 不可选），空格写 _
    static func describe(_ rows: [[CalendarCell]]) -> String {
        rows.map { row in
            row.map { c -> String in
                guard let d = c.day else { return "_" }
                var flags = ""
                if c.isToday { flags += "T" }
                if c.isSelected { flags += "S" }
                if c.isListened { flags += "L" }
                if !c.selectable { flags += "x" }
                return "\(d):\(c.ahead):\(flags)"
            }.joined(separator: ",")
        }.joined(separator: "|")
    }

    /// 日历日 → YYYY-MM-DD（本地）
    static func isoDate(_ date: Date) -> String { PlanDates.localDateString(date) }
}
