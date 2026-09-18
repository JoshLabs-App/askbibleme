// 由 tools/gen-medals.mjs 从 data/medals.json 生成，勿手改。
package me.askbible.native_.data

/** 勋章判定用到的统计口径 */
enum class MedalMetric {
    BOOKS_COMPLETED,
    BOTH_TESTAMENTS,
    CHAPTERS_OPENED,
    CHAPTERS_READ,
    FAVORITES,
    FULL_WEEKS,
    LISTEN_HOURS,
    LISTEN_HOURS_THIS_MONTH,
    MORNING_DAYS,
    NIGHT_DAYS,
    NT_BOOKS_COMPLETED,
    OT_BOOKS_COMPLETED,
    PLAN_DAYS,
    READING_DAYS,
    SAME_BOOK_STREAK,
    STREAK_DAYS
}

/** 一枚勋章：一张图 + 若干递增档位，App 里靠档位叠色区分铜 / 银 / 金 */
data class MedalDef(
    val key: String,
    val category: String,
    val metric: MedalMetric,
    val tiers: List<Int>,
    val name: Pair<String, String>,
    val condition: Pair<String, String>,
    val unit: Pair<String, String>,
) {
    fun localizedName(l: AppLocale = AppLocale.current): String = if (l == AppLocale.EN) name.second else l.zh(name.first)
    fun localizedUnit(l: AppLocale = AppLocale.current): String = if (l == AppLocale.EN) unit.second else l.zh(unit.first)

    /** {n} 换成该档门槛 */
    fun localizedCondition(tier: Int, l: AppLocale = AppLocale.current): String {
        val raw = if (l == AppLocale.EN) condition.second else l.zh(condition.first)
        val n = tiers[tier.coerceIn(1, tiers.size) - 1]
        return raw.replace("{n}", n.toString())
    }
}

object MedalCatalog {
    const val VERSION = 1
    const val IMAGE_BASE = "https://pub-f30fb48025d841f09c37bb9b52df5354.r2.dev/" + "medals/"
    fun imageUrl(key: String): String = IMAGE_BASE + key + ".webp"

    val all: List<MedalDef> = listOf(
        MedalDef("m01_first_play", "onboarding", MedalMetric.CHAPTERS_OPENED, listOf(1), "初次翻开" to "First Page", "打开任意一章经文" to "Open any chapter", "" to ""),
        MedalDef("m02_first_lesson", "onboarding", MedalMetric.CHAPTERS_READ, listOf(1), "读完一章" to "First Chapter", "完整读完第一章" to "Finish reading your first chapter", "" to ""),
        MedalDef("m03_daily_goal", "onboarding", MedalMetric.READING_DAYS, listOf(1), "今日读经" to "Today's Reading", "完成一天的读经" to "Read on a day", "" to ""),
        MedalDef("m08_first_favorite", "onboarding", MedalMetric.FAVORITES, listOf(1, 10, 50), "珍藏经文" to "Treasured Verses", "收藏 {n} 节经文" to "Save {n} verses", "节" to "verses"),
        MedalDef("m07_auto_next", "onboarding", MedalMetric.SAME_BOOK_STREAK, listOf(2), "一路读下去" to "Read On", "同一卷里连着读完两章" to "Finish two chapters in a row in one book", "" to ""),
        MedalDef("m13_ten_lessons", "chapter", MedalMetric.CHAPTERS_READ, listOf(5, 10, 25, 50, 100), "累计章数" to "Chapters Read", "累计读完 {n} 章" to "Finish {n} chapters", "章" to "chapters"),
        MedalDef("m16_hundred_lessons", "chapter", MedalMetric.CHAPTERS_READ, listOf(200, 500, 1189), "千章之程" to "The Long Road", "累计读完 {n} 章（全本共 1189 章）" to "Finish {n} chapters (1189 in all)", "章" to "chapters"),
        MedalDef("m06_one_hour", "time", MedalMetric.LISTEN_HOURS, listOf(1), "第一小时" to "First Hour", "累计听读满 1 小时" to "Listen for one hour in total", "" to ""),
        MedalDef("m18_ten_hours", "time", MedalMetric.LISTEN_HOURS, listOf(3, 10, 25, 50), "累计听读" to "Listening Time", "累计听读 {n} 小时" to "Listen for {n} hours in total", "小时" to "hours"),
        MedalDef("m38_monthly_hours", "time", MedalMetric.LISTEN_HOURS_THIS_MONTH, listOf(10), "月度丰收" to "A Full Month", "本月听读满 10 小时" to "Listen for 10 hours this month", "" to ""),
        MedalDef("m04_two_days", "streak", MedalMetric.STREAK_DAYS, listOf(2), "两日同行" to "Two Days", "连续读经 2 天" to "Read two days in a row", "" to ""),
        MedalDef("m05_three_days", "streak", MedalMetric.STREAK_DAYS, listOf(3), "三日坚持" to "Three Days", "连续读经 3 天" to "Read three days in a row", "" to ""),
        MedalDef("m21_seven_days", "streak", MedalMetric.STREAK_DAYS, listOf(7, 14, 30), "连续读经" to "Reading Streak", "连续读经 {n} 天" to "Read {n} days in a row", "天" to "days"),
        MedalDef("m24_sixty_days", "streak", MedalMetric.STREAK_DAYS, listOf(60, 100, 365), "长久同行" to "Long Companion", "连续读经 {n} 天" to "Read {n} days in a row", "天" to "days"),
        MedalDef("m40_faithful_listener", "streak", MedalMetric.READING_DAYS, listOf(30, 100, 300), "忠心同行" to "Faithful", "累计读经 {n} 天" to "Read on {n} days in total", "天" to "days"),
        MedalDef("m37_weekly_goal", "streak", MedalMetric.FULL_WEEKS, listOf(1, 4, 12), "一周圆满" to "A Full Week", "整整一周每天都读经 ×{n}" to "Read every day of a week, {n} time(s)", "周" to "weeks"),
        MedalDef("m09_morning", "rhythm", MedalMetric.MORNING_DAYS, listOf(1, 7, 30), "晨光" to "Morning Light", "清晨 5–9 点读经 {n} 天" to "Read between 5–9am on {n} days", "天" to "days"),
        MedalDef("m10_night", "rhythm", MedalMetric.NIGHT_DAYS, listOf(1, 7, 30), "夜灯" to "Night Lamp", "夜里 21–2 点读经 {n} 天" to "Read between 9pm–2am on {n} days", "天" to "days"),
        MedalDef("m28_first_book", "book", MedalMetric.BOOKS_COMPLETED, listOf(1, 3, 5, 10, 20), "读完整卷" to "Books Finished", "读完 {n} 卷书" to "Finish {n} books", "卷" to "books"),
        MedalDef("m32_old_testament", "book", MedalMetric.OT_BOOKS_COMPLETED, listOf(5, 10, 39), "旧约之路" to "Old Testament", "读完 {n} 卷旧约（共 39 卷）" to "Finish {n} Old Testament books (39 in all)", "卷" to "books"),
        MedalDef("m33_new_testament", "book", MedalMetric.NT_BOOKS_COMPLETED, listOf(5, 10, 27), "新约之路" to "New Testament", "读完 {n} 卷新约（共 27 卷）" to "Finish {n} New Testament books (27 in all)", "卷" to "books"),
        MedalDef("m34_both_testaments", "book", MedalMetric.BOTH_TESTAMENTS, listOf(5), "两约相连" to "Both Testaments", "新旧约各读完 5 卷" to "Finish five books in each testament", "" to ""),
        MedalDef("m25_first_series", "plan", MedalMetric.PLAN_DAYS, listOf(7, 30, 100), "跟随计划" to "On Plan", "完成读经计划 {n} 天" to "Complete {n} plan days", "天" to "days"),
    )
    fun def(key: String): MedalDef? = all.firstOrNull { it.key == key }

    /** 66 卷书卷印章，顺序同圣经正典 */
    val seals: List<String> = listOf(
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
    )
}

object MedalXP {
    // 微反馈：读一节 / 每 15 秒听读，都会让 XP 跳一次
    const val perVerseRead = 8
    const val perListenTick = 12
    const val listenTickSeconds: Double = 15.0
    // 同一章最多给几片听读 XP（防挂机刷分：80 片 ≈ 20 分钟）
    const val listenTicksPerChapterCap = 80
    // 里程碑
    const val perChapterRead = 250
    const val perBookCompleted = 3000
    const val perReadingDay = 400
    const val firstOpenOfDay = 150
    const val perFavorite = 120
    const val perHighlight = 80
    const val perNote = 150
    const val perPlanDay = 500
    const val perMedalTier = 600
    const val perSeal = 1500
    // 连续天数乘区：1 + 天数 × perDay，封顶 cap。取「当前连续天数」与「历史最长」的较大者——只升不降
    const val streakPerDay: Double = 0.05
    const val streakCap: Double = 2.5
    // 连读同卷：第 2 章起每章额外 +step，封顶 cap
    const val comboStep = 150
    const val comboCap = 900
}

object MedalLevels {
    val thresholds: List<Int> = listOf(0, 300, 900, 2000, 4000, 7500, 13000, 22000, 36000, 58000, 92000, 145000)
    const val STEP = 60000
    val titles: List<Pair<String, String>> = listOf(
        "启程" to "Setting Out",
        "初读" to "First Light",
        "寻道" to "Seeking",
        "勤读" to "Steady",
        "深读" to "Deeper",
        "明光" to "Shining",
        "通读" to "Through",
        "丰盛" to "Abundant",
        "根深" to "Rooted",
        "长久" to "Enduring",
        "精金" to "Refined",
        "恒心" to "Faithful",
    )

    /** 当前等级（从 1 起） */
    fun level(xp: Int): Int {
        val i = thresholds.indexOfLast { xp >= it }
        if (i in 0 until thresholds.size - 1) return i + 1
        return thresholds.size + maxOf(0, (xp - thresholds.last()) / STEP)
    }

    /** 该等级的 XP 下限 */
    fun floor(level: Int): Int =
        if (level <= thresholds.size) thresholds[maxOf(level, 1) - 1]
        else thresholds.last() + (level - thresholds.size) * STEP

    /** 升到下一级需要的 XP 总数 */
    fun ceiling(level: Int): Int = floor(level + 1)

    fun title(level: Int, l: AppLocale = AppLocale.current): String {
        val t = titles[level.coerceIn(1, titles.size) - 1]
        return if (l == AppLocale.EN) t.second else l.zh(t.first)
    }
}
