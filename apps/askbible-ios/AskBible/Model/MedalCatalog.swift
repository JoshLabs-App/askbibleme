// 由 tools/gen-medals.mjs 从 data/medals.json 生成，勿手改。
import Foundation

/// 勋章判定用到的统计口径
enum MedalMetric: String, Codable {
    case booksCompleted
    case bothTestaments
    case chaptersOpened
    case chaptersRead
    case favorites
    case fullWeeks
    case listenHours
    case listenHoursThisMonth
    case morningDays
    case nightDays
    case ntBooksCompleted
    case otBooksCompleted
    case planDays
    case readingDays
    case sameBookStreak
    case streakDays
}

/// 一枚勋章：一张图 + 若干递增档位，App 里靠档位叠色区分铜 / 银 / 金
struct MedalDef: Identifiable {
    let key: String
    let category: String
    let metric: MedalMetric
    let tiers: [Int]
    let name: (zh: String, en: String)
    let condition: (zh: String, en: String)
    let unit: (zh: String, en: String)
    var id: String { key }

    init(_ key: String, _ category: String, _ metric: MedalMetric, _ tiers: [Int],
         _ name: (String, String), _ condition: (String, String), _ unit: (String, String)) {
        self.key = key; self.category = category; self.metric = metric; self.tiers = tiers
        self.name = name; self.condition = condition; self.unit = unit
    }

    func localizedName(_ l: AppLocale = AppLocale.current) -> String { l == .en ? name.en : l.zh(name.zh) }
    func localizedUnit(_ l: AppLocale = AppLocale.current) -> String { l == .en ? unit.en : l.zh(unit.zh) }
    /// {n} 换成该档门槛
    func localizedCondition(tier: Int, _ l: AppLocale = AppLocale.current) -> String {
        let raw = l == .en ? condition.en : l.zh(condition.zh)
        let n = tiers[min(max(tier, 1), tiers.count) - 1]
        return raw.replacingOccurrences(of: "{n}", with: "\(n)")
    }
}

enum MedalCatalog {
    static let version = 1
    static let imageBase = "https://pub-f30fb48025d841f09c37bb9b52df5354.r2.dev/" + "medals/"
    static func imageURL(_ key: String) -> URL? { URL(string: imageBase + key + ".webp") }

    static let all: [MedalDef] = [
        MedalDef("m01_first_play", "onboarding", .chaptersOpened, [1], ("初次翻开", "First Page"), ("打开任意一章经文", "Open any chapter"), ("", "")),
        MedalDef("m02_first_lesson", "onboarding", .chaptersRead, [1], ("读完一章", "First Chapter"), ("完整读完第一章", "Finish reading your first chapter"), ("", "")),
        MedalDef("m03_daily_goal", "onboarding", .readingDays, [1], ("今日读经", "Today's Reading"), ("完成一天的读经", "Read on a day"), ("", "")),
        MedalDef("m08_first_favorite", "onboarding", .favorites, [1, 10, 50], ("珍藏经文", "Treasured Verses"), ("收藏 {n} 节经文", "Save {n} verses"), ("节", "verses")),
        MedalDef("m07_auto_next", "onboarding", .sameBookStreak, [2], ("一路读下去", "Read On"), ("同一卷里连着读完两章", "Finish two chapters in a row in one book"), ("", "")),
        MedalDef("m13_ten_lessons", "chapter", .chaptersRead, [5, 10, 25, 50, 100], ("累计章数", "Chapters Read"), ("累计读完 {n} 章", "Finish {n} chapters"), ("章", "chapters")),
        MedalDef("m16_hundred_lessons", "chapter", .chaptersRead, [200, 500, 1189], ("千章之程", "The Long Road"), ("累计读完 {n} 章（全本共 1189 章）", "Finish {n} chapters (1189 in all)"), ("章", "chapters")),
        MedalDef("m06_one_hour", "time", .listenHours, [1], ("第一小时", "First Hour"), ("累计听读满 1 小时", "Listen for one hour in total"), ("", "")),
        MedalDef("m18_ten_hours", "time", .listenHours, [3, 10, 25, 50], ("累计听读", "Listening Time"), ("累计听读 {n} 小时", "Listen for {n} hours in total"), ("小时", "hours")),
        MedalDef("m38_monthly_hours", "time", .listenHoursThisMonth, [10], ("月度丰收", "A Full Month"), ("本月听读满 10 小时", "Listen for 10 hours this month"), ("", "")),
        MedalDef("m04_two_days", "streak", .streakDays, [2], ("两日同行", "Two Days"), ("连续读经 2 天", "Read two days in a row"), ("", "")),
        MedalDef("m05_three_days", "streak", .streakDays, [3], ("三日坚持", "Three Days"), ("连续读经 3 天", "Read three days in a row"), ("", "")),
        MedalDef("m21_seven_days", "streak", .streakDays, [7, 14, 30], ("连续读经", "Reading Streak"), ("连续读经 {n} 天", "Read {n} days in a row"), ("天", "days")),
        MedalDef("m24_sixty_days", "streak", .streakDays, [60, 100, 365], ("长久同行", "Long Companion"), ("连续读经 {n} 天", "Read {n} days in a row"), ("天", "days")),
        MedalDef("m40_faithful_listener", "streak", .readingDays, [30, 100, 300], ("忠心同行", "Faithful"), ("累计读经 {n} 天", "Read on {n} days in total"), ("天", "days")),
        MedalDef("m37_weekly_goal", "streak", .fullWeeks, [1, 4, 12], ("一周圆满", "A Full Week"), ("整整一周每天都读经 ×{n}", "Read every day of a week, {n} time(s)"), ("周", "weeks")),
        MedalDef("m09_morning", "rhythm", .morningDays, [1, 7, 30], ("晨光", "Morning Light"), ("清晨 5–9 点读经 {n} 天", "Read between 5–9am on {n} days"), ("天", "days")),
        MedalDef("m10_night", "rhythm", .nightDays, [1, 7, 30], ("夜灯", "Night Lamp"), ("夜里 21–2 点读经 {n} 天", "Read between 9pm–2am on {n} days"), ("天", "days")),
        MedalDef("m28_first_book", "book", .booksCompleted, [1, 3, 5, 10, 20], ("读完整卷", "Books Finished"), ("读完 {n} 卷书", "Finish {n} books"), ("卷", "books")),
        MedalDef("m32_old_testament", "book", .otBooksCompleted, [5, 10, 39], ("旧约之路", "Old Testament"), ("读完 {n} 卷旧约（共 39 卷）", "Finish {n} Old Testament books (39 in all)"), ("卷", "books")),
        MedalDef("m33_new_testament", "book", .ntBooksCompleted, [5, 10, 27], ("新约之路", "New Testament"), ("读完 {n} 卷新约（共 27 卷）", "Finish {n} New Testament books (27 in all)"), ("卷", "books")),
        MedalDef("m34_both_testaments", "book", .bothTestaments, [5], ("两约相连", "Both Testaments"), ("新旧约各读完 5 卷", "Finish five books in each testament"), ("", "")),
        MedalDef("m25_first_series", "plan", .planDays, [7, 30, 100], ("跟随计划", "On Plan"), ("完成读经计划 {n} 天", "Complete {n} plan days"), ("天", "days")),
    ]
    static func def(_ key: String) -> MedalDef? { all.first { $0.key == key } }

    /// 66 卷书卷印章，顺序同圣经正典
    static let seals: [String] = [
        "seal_01_genesis",
        "seal_02_exodus",
        "seal_03_leviticus",
        "seal_04_numbers",
        "seal_05_deuteronomy",
        "seal_06_joshua",
        "seal_07_judges",
        "seal_08_ruth",
        "seal_09_1_samuel",
        "seal_10_2_samuel",
        "seal_11_1_kings",
        "seal_12_2_kings",
        "seal_13_1_chronicles",
        "seal_14_2_chronicles",
        "seal_15_ezra",
        "seal_16_nehemiah",
        "seal_17_esther",
        "seal_18_job",
        "seal_19_psalms",
        "seal_20_proverbs",
        "seal_21_ecclesiastes",
        "seal_22_song_of_solomon",
        "seal_23_isaiah",
        "seal_24_jeremiah",
        "seal_25_lamentations",
        "seal_26_ezekiel",
        "seal_27_daniel",
        "seal_28_hosea",
        "seal_29_joel",
        "seal_30_amos",
        "seal_31_obadiah",
        "seal_32_jonah",
        "seal_33_micah",
        "seal_34_nahum",
        "seal_35_habakkuk",
        "seal_36_zephaniah",
        "seal_37_haggai",
        "seal_38_zechariah",
        "seal_39_malachi",
        "seal_40_matthew",
        "seal_41_mark",
        "seal_42_luke",
        "seal_43_john",
        "seal_44_acts",
        "seal_45_romans",
        "seal_46_1_corinthians",
        "seal_47_2_corinthians",
        "seal_48_galatians",
        "seal_49_ephesians",
        "seal_50_philippians",
        "seal_51_colossians",
        "seal_52_1_thessalonians",
        "seal_53_2_thessalonians",
        "seal_54_1_timothy",
        "seal_55_2_timothy",
        "seal_56_titus",
        "seal_57_philemon",
        "seal_58_hebrews",
        "seal_59_james",
        "seal_60_1_peter",
        "seal_61_2_peter",
        "seal_62_1_john",
        "seal_63_2_john",
        "seal_64_3_john",
        "seal_65_jude",
        "seal_66_revelation",
    ]
}

enum MedalXP {
    /// 微反馈：读一节 / 每 15 秒听读，都会让 XP 跳一次
    static let perVerseRead = 8
    static let perListenTick = 12
    static let listenTickSeconds: Double = 15.0
    /// 同一章最多给几片听读 XP（防挂机刷分：80 片 ≈ 20 分钟）
    static let listenTicksPerChapterCap = 80
    /// 里程碑
    static let perChapterRead = 250
    static let perBookCompleted = 3000
    static let perReadingDay = 400
    static let firstOpenOfDay = 150
    static let perFavorite = 120
    static let perHighlight = 80
    static let perNote = 150
    static let perPlanDay = 500
    static let perMedalTier = 600
    static let perSeal = 1500
    /// 连续天数乘区：1 + 天数 × perDay，封顶 cap。取「当前连续天数」与「历史最长」的较大者——只升不降
    static let streakPerDay = 0.05
    static let streakCap = 2.5
    /// 连读同卷：第 2 章起每章额外 +step，封顶 cap
    static let comboStep = 150
    static let comboCap = 900
}

enum MedalLevels {
    static let thresholds: [Int] = [0, 300, 900, 2000, 4000, 7500, 13000, 22000, 36000, 58000, 92000, 145000]
    static let step = 60000
    static let titles: [(zh: String, en: String)] = [
        ("启程", "Setting Out"),
        ("初读", "First Light"),
        ("寻道", "Seeking"),
        ("勤读", "Steady"),
        ("深读", "Deeper"),
        ("明光", "Shining"),
        ("通读", "Through"),
        ("丰盛", "Abundant"),
        ("根深", "Rooted"),
        ("长久", "Enduring"),
        ("精金", "Refined"),
        ("恒心", "Faithful"),
    ]

    /// 当前等级（从 1 起）
    static func level(xp: Int) -> Int {
        if let i = thresholds.lastIndex(where: { xp >= $0 }), i < thresholds.count - 1 { return i + 1 }
        return thresholds.count + max(0, (xp - (thresholds.last ?? 0)) / step)
    }
    /// 该等级的 XP 下限
    static func floor(_ level: Int) -> Int {
        level <= thresholds.count ? thresholds[max(level, 1) - 1] : (thresholds.last ?? 0) + (level - thresholds.count) * step
    }
    /// 升到下一级需要的 XP 总数
    static func ceiling(_ level: Int) -> Int { floor(level + 1) }
    static func title(_ level: Int, _ l: AppLocale = AppLocale.current) -> String {
        let t = titles[min(max(level, 1), titles.count) - 1]
        return l == .en ? t.en : l.zh(t.zh)
    }
}
