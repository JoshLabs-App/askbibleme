// 由 tools/gen-reading-plans.mjs 从 data/bible-reading-plans/registry.json + zh-CN.json / en.json + mobile-brief.{zh-CN,en}.json 生成，勿手改。文案见 SiteCopy。
package me.askbible.native_.data

/** 计划目录一条。title/subtitle/blurb 与手机版精简文案都是简 / 英两份，按 AppLocale.current 取（繁体运行时转）；name 是英文表名。 */
data class ReadingPlanEntry(
    val planId: String,
    val name: String,
    val description: String,
    val titleZh: String, val titleEn: String,
    val subtitleZh: String, val subtitleEn: String,
    val blurbZh: String, val blurbEn: String,
    val dayCount: Int,
    val maxReadingsPerDay: Int,
    val listPriority: Int,
    /** 手机版精简文案（mobile-brief）：徽标 / 一句话 / 要点 chips / 怎么读 / 长版说明 */
    val badgeZh: String, val badgeEn: String,
    val taglineZh: String, val taglineEn: String,
    val facts: List<PlanFact>,
    val how: List<PlanFact>,
    val detailZh: String, val detailEn: String,
) {
    val title: String get() = AppLocale.pick(titleZh, titleEn)
    val subtitle: String get() = AppLocale.pick(subtitleZh, subtitleEn)
    val blurb: String get() = AppLocale.pick(blurbZh, blurbEn)
    val badge: String get() = AppLocale.pick(badgeZh, badgeEn)
    val tagline: String get() = AppLocale.pick(taglineZh, taglineEn)
    val detail: String get() = AppLocale.pick(detailZh, detailEn)
}

/** 图标名 + 短句（图标名 → Material 字形见 ui/PlanWidgets.kt 的 planIconGlyph） */
data class PlanFact(val icon: String, val textZh: String, val textEn: String) {
    val text: String get() = AppLocale.pick(textZh, textEn)
}

object ReadingPlanCatalog {
    const val TRIPLE_LOOP_ID = "triple-loop"
    const val NT_DEEP_REPEAT_ID = "nt-deep-repeat"
    /** 已按 listPriority / planId 排好（RN sortPlans） */
    val plans: List<ReadingPlanEntry> = listOf(
        ReadingPlanEntry("triple-loop", "轻松循环读经计划", "旧约、新约、智慧书三条独立循环；不按日历补读。",
            "轻松循环读经计划", "Easy cycle reading plan", "AskBible 方法一 · 无压力通读", "AskBible Path 1 · Easy read-through", "旧约、新约、智慧书三条独立循环，每日各一小段；不补读、不展示落后。适合第一次建立习惯，或希望低压、可持续回到神话语的人。", "Three independent loops—one short segment per track daily. No catch-up, no “behind.” For first habits or a low-pressure return to Scripture.",
            1, 3, -20,
            "方法一 · 轻松读经", "Path 1 · Easy reading", "旧约、新约、智慧书，每天各读一小段", "One short reading a day from the Old Testament, New Testament and Wisdom books",
            listOf(PlanFact("today", "每日 3 段", "3 readings a day"), PlanFact("loop", "随时跟上", "Never fall behind"), PlanFact("swap", "三条进度各走各的", "Three tracks, each at its own pace")),
            listOf(PlanFact("sync", "读哪条就推哪条，三条互不绑定", "Only the track you read advances; the three are independent"), PlanFact("spa", "停了再回来，别担心漏读", "Come back whenever you stop; never worry about missing a day"), PlanFact("replay", "读完一环末章，回到该环起点", "When a track reaches its last chapter, it loops back to its start")),
            "适合第一次建立习惯，或希望低压、可持续地回到神话语的人。三轨默认每日各进一章，你可随时在章节页推进，也可以恢复默认进度。", "For building a first habit, or returning to God's Word in a low-pressure, sustainable way. Each track advances one chapter a day by default; you can move ahead from any chapter page, or reset to the default progress at any time."),
        ReadingPlanEntry("nt-deep-repeat", "新约深读 · 旧约通读", "AskBible 方法二 · 有效深读：参考麦克阿瑟研经法，52 阶，7 / 14 / 28 天深度。",
            "正式研经", "Formal Scripture Study", "AskBible 方法二 · 有效深读", "AskBible Path 2 · Effective deep study", "参考麦克阿瑟新约研读法，我们整理为 52 阶（4–6 章/阶）。从每阶 7 天起，可选 14 / 28 天深度；约 12 个月 / 2 年 / 4 年一轮，旧约每日一章并行。若刚开始，建议先用方法一。", "MacArthur-inspired NT study, shaped into 52 stages (4–6 chapters each). From 7 days/stage—optional 14 / 28-day depth (~12 mo / 2 yr / 4 yr per round); one OT chapter daily. New? Start with Path 1.",
            1, 2, -15,
            "方法二 · 正式研读", "Path 2 · Formal study", "同一段新约反复读，直到读进心里", "Read the same New Testament passage again and again until it sinks in",
            listOf(PlanFact("stairs", "新约 52 阶", "52 NT stages"), PlanFact("repeat", "每阶 7 / 14 / 28 天", "7 / 14 / 28 days per stage"), PlanFact("book", "旧约每日 1 章", "1 OT chapter a day")),
            listOf(PlanFact("stairs", "新约分 52 阶，每阶 4–6 章", "The New Testament in 52 stages of 4–6 chapters"), PlanFact("repeat", "同一阶连读 7、14 或 28 天", "Stay on one stage for 7, 14 or 28 days"), PlanFact("book", "旧约每天 1 章并行通读", "One Old Testament chapter a day alongside")),
            "参考约翰·麦克阿瑟的新约研读法。「读 N 遍」= 每阶连读 N 天；走完 52 阶为一轮，约 12 个月 / 2 年 / 4 年。停了再回来，别担心漏读；若刚开始读经，建议先用方法一。", "Based on John MacArthur's New Testament reading method. “N readings” means staying on each stage for N days; 52 stages make one cycle of about 12 months, 2 years or 4 years. Come back whenever you stop; if you are new to Bible reading, start with Path 1."),
        ReadingPlanEntry("esvthroughthebible", "Through The Bible", "Through the Biblewww.esv.org",
            "按书卷顺序通读圣经", "Through The Bible", "Through The Bible", "按书卷顺序通读圣经", "每日旧约、新约各一段（多为两截经文），一年通读；列表里与「旧约新约并进」类计划只保留这一种较轻的节奏。", "One OT and one NT reading most days (often two passages), finishing the Bible in a year. We list one daily OT+NT plan to avoid near-duplicates.",
            365, 2, 0,
            "经典日课表", "Classic schedule", "每日旧约、新约各一段（多为两截经文），一年通读", "One OT and one NT reading most days (often two passages), finishing the Bible in a year",
            listOf(PlanFact("calendar", "365 天", "365 days"), PlanFact("today", "每日 ≤ 2 段", "≤ 2 readings a day")),
            listOf(PlanFact("calendar", "按日课表逐日读，一年读完", "Read the schedule day by day and finish in a year"), PlanFact("today", "从今天起算，或对齐今年 1 月 1 日", "Start from today, or align to January 1 of this year"), PlanFact("spa", "停了再回来，别担心漏读", "Come back whenever you stop; never worry about missing a day")),
            "每日旧约、新约各一段（多为两截经文），一年通读；列表里与「旧约新约并进」类计划只保留这一种较轻的节奏。", "One OT and one NT reading most days (often two passages), finishing the Bible in a year. We list one daily OT+NT plan to avoid near-duplicates."),
        ReadingPlanEntry("backtothebiblechronological", "Back to the Bible Chronological", "Copyright Back to the Bible www.backtothebible.org",
            "按历史时间线读通圣经", "Back to the Bible Chronological", "Back to the Bible Chronological", "按历史时间线读通圣经", "按历史线索重排经文顺序的一年通读，常穿插约伯记等段落。适合想从「故事时间线」进入整本圣经的人。表内版权信息以英文标注为准。", "A one-year chronological sweep, often weaving Job and other blocks by storyline. Good if you like reading along historical time. Copyright notes in the source appear in English.",
            365, 6, 1,
            "经典日课表", "Classic schedule", "按历史线索重排经文顺序的一年通读，常穿插约伯记等段落", "A one-year chronological sweep, often weaving Job and other blocks by storyline",
            listOf(PlanFact("calendar", "365 天", "365 days"), PlanFact("today", "每日 ≤ 6 段", "≤ 6 readings a day")),
            listOf(PlanFact("calendar", "按日课表逐日读，一年读完", "Read the schedule day by day and finish in a year"), PlanFact("today", "从今天起算，或对齐今年 1 月 1 日", "Start from today, or align to January 1 of this year"), PlanFact("spa", "停了再回来，别担心漏读", "Come back whenever you stop; never worry about missing a day")),
            "按历史线索重排经文顺序的一年通读，常穿插约伯记等段落。适合想从「故事时间线」进入整本圣经的人。表内版权信息以英文标注为准。", "A one-year chronological sweep, often weaving Job and other blocks by storyline. Good if you like reading along historical time. Copyright notes in the source appear in English."),
        ReadingPlanEntry("esvgospelsandepistles", "Gospel and Epistles", "Gospel and Epistleswww.esv.org",
            "福音与书信", "Gospel and Epistles", "Gospel and Epistles", "福音与书信", "聚焦新约福音与书信脉络的一年轨道，可与旧约通读计划搭配使用。", "A New-Testament-focused year through Gospels and letters—pair it with an OT plan if you like balance.",
            365, 1, 2,
            "经典日课表", "Classic schedule", "聚焦新约福音与书信脉络的一年轨道，可与旧约通读计划搭配使用", "A New-Testament-focused year through Gospels and letters—pair it with an OT plan if you like balance",
            listOf(PlanFact("calendar", "365 天", "365 days"), PlanFact("today", "每日 ≤ 1 段", "≤ 1 readings a day")),
            listOf(PlanFact("calendar", "按日课表逐日读，一年读完", "Read the schedule day by day and finish in a year"), PlanFact("today", "从今天起算，或对齐今年 1 月 1 日", "Start from today, or align to January 1 of this year"), PlanFact("spa", "停了再回来，别担心漏读", "Come back whenever you stop; never worry about missing a day")),
            "聚焦新约福音与书信脉络的一年轨道，可与旧约通读计划搭配使用。", "A New-Testament-focused year through Gospels and letters—pair it with an OT plan if you like balance."),
        ReadingPlanEntry("esvchroniclesandprophets", "Chronicles and Prophets", "Chronicles and Prophetswww.esv.org",
            "历代志与先知书", "Chronicles and Prophets", "Chronicles and Prophets", "历代志与先知书", "以历代志与先知书等书卷为主线编排的读经轨道，偏历史与神论脉络。名称中的 ESV 为来源资料标签。", "A track centered on Chronicles and the prophetic books—helpful for history-and-oracle threads. “ESV” in the name is a source label only.",
            365, 1, 100,
            "经典日课表", "Classic schedule", "以历代志与先知书等书卷为主线编排的读经轨道，偏历史与神论脉络", "A track centered on Chronicles and the prophetic books—helpful for history-and-oracle threads",
            listOf(PlanFact("calendar", "365 天", "365 days"), PlanFact("today", "每日 ≤ 1 段", "≤ 1 readings a day")),
            listOf(PlanFact("calendar", "按日课表逐日读，一年读完", "Read the schedule day by day and finish in a year"), PlanFact("today", "从今天起算，或对齐今年 1 月 1 日", "Start from today, or align to January 1 of this year"), PlanFact("spa", "停了再回来，别担心漏读", "Come back whenever you stop; never worry about missing a day")),
            "以历代志与先知书等书卷为主线编排的读经轨道，偏历史与神论脉络。名称中的 ESV 为来源资料标签。", "A track centered on Chronicles and the prophetic books—helpful for history-and-oracle threads. “ESV” in the name is a source label only."),
        ReadingPlanEntry("esveverydayinword", "Every Day In the Word", "Every Day in the Wordwww.esv.org",
            "每日读经（叙事分块）", "Every Day In the Word", "Every Day In the Word", "每日读经（叙事分块）", "每日多段经文，常按叙事大块划分（含跨章经节）。适合愿意跟随编辑划分细读的人；英文经题有助于对照原表。", "Several readings per day, often large narrative slices including cross-chapter spans. English labels help you match the upstream table exactly.",
            365, 5, 100,
            "经典日课表", "Classic schedule", "每日多段经文，常按叙事大块划分（含跨章经节）", "Several readings per day, often large narrative slices including cross-chapter spans",
            listOf(PlanFact("calendar", "365 天", "365 days"), PlanFact("today", "每日 ≤ 5 段", "≤ 5 readings a day")),
            listOf(PlanFact("calendar", "按日课表逐日读，一年读完", "Read the schedule day by day and finish in a year"), PlanFact("today", "从今天起算，或对齐今年 1 月 1 日", "Start from today, or align to January 1 of this year"), PlanFact("spa", "停了再回来，别担心漏读", "Come back whenever you stop; never worry about missing a day")),
            "每日多段经文，常按叙事大块划分（含跨章经节）。适合愿意跟随编辑划分细读的人；英文经题有助于对照原表。", "Several readings per day, often large narrative slices including cross-chapter spans. English labels help you match the upstream table exactly."),
        ReadingPlanEntry("esvliterarystudybible", "ESV Literary Study Bible Plan", "ESV Literary Study Biblewww.esv.org",
            "文学研读圣经计划", "ESV Literary Study Bible Plan", "ESV Literary Study Bible Plan", "文学研读圣经计划", "按「文学研读」思路拆分的日课，常一日多段。名称含 ESV 为来源标签；正文仍以你在站内选择的译本为准。", "Multiple readings per day from a literary-study style table. The ESV wording in the title is historical; your on-site Bible text follows the translation you import.",
            365, 4, 100,
            "经典日课表", "Classic schedule", "按「文学研读」思路拆分的日课，常一日多段", "Multiple readings per day from a literary-study style table",
            listOf(PlanFact("calendar", "365 天", "365 days"), PlanFact("today", "每日 ≤ 4 段", "≤ 4 readings a day")),
            listOf(PlanFact("calendar", "按日课表逐日读，一年读完", "Read the schedule day by day and finish in a year"), PlanFact("today", "从今天起算，或对齐今年 1 月 1 日", "Start from today, or align to January 1 of this year"), PlanFact("spa", "停了再回来，别担心漏读", "Come back whenever you stop; never worry about missing a day")),
            "按「文学研读」思路拆分的日课，常一日多段。名称含 ESV 为来源标签；正文仍以你在站内选择的译本为准。", "Multiple readings per day from a literary-study style table. The ESV wording in the title is historical; your on-site Bible text follows the translation you import."),
        ReadingPlanEntry("esvpentateuchandhistoryofisrael", "Pentateuch and History of Israel", "Pentateuch and History of Israelwww.esv.org",
            "五经与以色列历史", "Pentateuch and History of Israel", "Pentateuch and History of Israel", "五经与以色列历史", "自摩西五经延伸至列国与王朝叙事，适合想从立约与历史骨架读起的人。", "Starts in the Torah and walks through Israel’s historical books—good if you want covenant and narrative spine first.",
            365, 1, 100,
            "经典日课表", "Classic schedule", "自摩西五经延伸至列国与王朝叙事，适合想从立约与历史骨架读起的人", "Starts in the Torah and walks through Israel’s historical books—good if you want covenant and narrative spine first",
            listOf(PlanFact("calendar", "365 天", "365 days"), PlanFact("today", "每日 ≤ 1 段", "≤ 1 readings a day")),
            listOf(PlanFact("calendar", "按日课表逐日读，一年读完", "Read the schedule day by day and finish in a year"), PlanFact("today", "从今天起算，或对齐今年 1 月 1 日", "Start from today, or align to January 1 of this year"), PlanFact("spa", "停了再回来，别担心漏读", "Come back whenever you stop; never worry about missing a day")),
            "自摩西五经延伸至列国与王朝叙事，适合想从立约与历史骨架读起的人。", "Starts in the Torah and walks through Israel’s historical books—good if you want covenant and narrative spine first."),
        ReadingPlanEntry("esvpsalmsandwisdomliterature", "Psalms and Wisdom Literature", "Psalm and Wisdom Literaturewww.esv.org",
            "诗篇与智慧文学", "Psalms and Wisdom Literature", "Psalms and Wisdom Literature", "诗篇与智慧文学", "以诗篇、箴言、传道书等智慧传统为主的轨道，可与叙事类计划互补。", "Emphasizes Psalms and wisdom books—useful alongside more narrative-heavy schedules.",
            365, 1, 100,
            "经典日课表", "Classic schedule", "以诗篇、箴言、传道书等智慧传统为主的轨道，可与叙事类计划互补", "Emphasizes Psalms and wisdom books—useful alongside more narrative-heavy schedules",
            listOf(PlanFact("calendar", "365 天", "365 days"), PlanFact("today", "每日 ≤ 1 段", "≤ 1 readings a day")),
            listOf(PlanFact("calendar", "按日课表逐日读，一年读完", "Read the schedule day by day and finish in a year"), PlanFact("today", "从今天起算，或对齐今年 1 月 1 日", "Start from today, or align to January 1 of this year"), PlanFact("spa", "停了再回来，别担心漏读", "Come back whenever you stop; never worry about missing a day")),
            "以诗篇、箴言、传道书等智慧传统为主的轨道，可与叙事类计划互补。", "Emphasizes Psalms and wisdom books—useful alongside more narrative-heavy schedules."),
        ReadingPlanEntry("mcheyne", "M'Cheyne", "M'Cheyne Reading Plan",
            "麦琴读经表", "M'Cheyne reading plan", "M'Cheyne Reading Plan", "麦琴读经表", "每日四章并行，约一年内通读旧约一遍，新约与诗篇各约两遍。节奏较密，适合能稳定安排读经时间的人。副题与经题保留英文，便于查对常见版本。", "Four short readings per day in a pattern linked to M'Cheyne: OT once, NT and Psalms about twice in a year. Steady daily time helps. Chinese title above is a short guide; English labels stay authoritative for the slice boundaries.",
            365, 4, 100,
            "经典日课表", "Classic schedule", "每日四章并行，约一年内通读旧约一遍，新约与诗篇各约两遍", "Four short readings per day in a pattern linked to M'Cheyne: OT once, NT and Psalms about twice in a year",
            listOf(PlanFact("calendar", "365 天", "365 days"), PlanFact("today", "每日 ≤ 4 段", "≤ 4 readings a day")),
            listOf(PlanFact("calendar", "按日课表逐日读，一年读完", "Read the schedule day by day and finish in a year"), PlanFact("today", "从今天起算，或对齐今年 1 月 1 日", "Start from today, or align to January 1 of this year"), PlanFact("spa", "停了再回来，别担心漏读", "Come back whenever you stop; never worry about missing a day")),
            "每日四章并行，约一年内通读旧约一遍，新约与诗篇各约两遍。节奏较密，适合能稳定安排读经时间的人。副题与经题保留英文，便于查对常见版本。", "Four short readings per day in a pattern linked to M'Cheyne: OT once, NT and Psalms about twice in a year. Steady daily time helps. Chinese title above is a short guide; English labels stay authoritative for the slice boundaries."),
        ReadingPlanEntry("oneyearchronological", "One Year Chronological", "One Year Chronologicalwww.oneyearbibleonline.com",
            "一年编年通读（多段并行）", "One Year Chronological", "One Year Chronological", "一年编年通读（多段并行）", "按编年思路编排；部分日期会并列多段经文以贴近历史平行叙事。单日阅读量可能较多，可按自己的节奏延展完成。", "Chronological ordering; some days stack several passages to mirror parallel events—feel free to spread a heavy day across more than one sitting.",
            365, 15, 100,
            "经典日课表", "Classic schedule", "按编年思路编排", "Chronological ordering",
            listOf(PlanFact("calendar", "365 天", "365 days"), PlanFact("today", "每日 ≤ 15 段", "≤ 15 readings a day")),
            listOf(PlanFact("calendar", "按日课表逐日读，一年读完", "Read the schedule day by day and finish in a year"), PlanFact("today", "从今天起算，或对齐今年 1 月 1 日", "Start from today, or align to January 1 of this year"), PlanFact("spa", "停了再回来，别担心漏读", "Come back whenever you stop; never worry about missing a day")),
            "按编年思路编排；部分日期会并列多段经文以贴近历史平行叙事。单日阅读量可能较多，可按自己的节奏延展完成。", "Chronological ordering; some days stack several passages to mirror parallel events—feel free to spread a heavy day across more than one sitting."),
    )
    fun plan(id: String): ReadingPlanEntry? = plans.firstOrNull { it.planId == id }
    /** 目录页分组：主推（三循环、新约深读，按此序）与其它 */
    val featured: List<ReadingPlanEntry> get() = listOf(TRIPLE_LOOP_ID, NT_DEEP_REPEAT_ID).mapNotNull { plan(it) }
    val others: List<ReadingPlanEntry> get() = plans.filter { it.planId != TRIPLE_LOOP_ID && it.planId != NT_DEEP_REPEAT_ID }
    fun isPointerPlan(id: String): Boolean = id == TRIPLE_LOOP_ID || id == NT_DEEP_REPEAT_ID
}

