// 由 tools/gen-reading-plans.mjs 从 data/bible-reading-plans/registry.json + zh-CN.json / en.json + mobile-brief.{zh-CN,en}.json 生成，勿手改。文案见 SiteCopy。

/// 计划目录一条。title/subtitle/blurb 与手机版精简文案都是简 / 英两份，按 AppLocale.current 取（繁体运行时转）；name 是英文表名。
struct ReadingPlanEntry: Identifiable, Hashable {
    let planId: String
    let name: String
    let description: String
    let titleZh: String, titleEn: String
    let subtitleZh: String, subtitleEn: String
    let blurbZh: String, blurbEn: String
    let dayCount: Int
    let maxReadingsPerDay: Int
    let listPriority: Int
    /// 手机版精简文案（mobile-brief）：徽标 / 一句话 / 要点 chips / 怎么读 / 长版说明
    let badgeZh: String, badgeEn: String
    let taglineZh: String, taglineEn: String
    let facts: [PlanFact]
    let how: [PlanFact]
    let detailZh: String, detailEn: String
    var id: String { planId }
    var title: String { AppLocale.pick(titleZh, titleEn) }
    var subtitle: String { AppLocale.pick(subtitleZh, subtitleEn) }
    var blurb: String { AppLocale.pick(blurbZh, blurbEn) }
    var badge: String { AppLocale.pick(badgeZh, badgeEn) }
    var tagline: String { AppLocale.pick(taglineZh, taglineEn) }
    var detail: String { AppLocale.pick(detailZh, detailEn) }
}

/// 图标名 + 短句（图标名 → Material 字形见 Read/PlanWidgets.swift 的 PlanIcons.glyph）
struct PlanFact: Hashable {
    let icon: String
    let textZh: String
    let textEn: String
    var text: String { AppLocale.pick(textZh, textEn) }
}

enum ReadingPlanCatalog {
    static let tripleLoopId = "triple-loop"
    static let ntDeepRepeatId = "nt-deep-repeat"
    /// 已按 listPriority / planId 排好（RN sortPlans）
    static let plans: [ReadingPlanEntry] = [
        ReadingPlanEntry(planId: "triple-loop", name: "轻松循环读经计划", description: "旧约、新约、智慧书三条独立循环；不按日历补读。",
            titleZh: "轻松循环读经计划", titleEn: "Easy cycle reading plan", subtitleZh: "AskBible 方法一 · 无压力通读", subtitleEn: "AskBible Path 1 · Easy read-through", blurbZh: "旧约、新约、智慧书三条独立循环，每日各一小段；不补读、不展示落后。适合第一次建立习惯，或希望低压、可持续回到神话语的人。", blurbEn: "Three independent loops—one short segment per track daily. No catch-up, no “behind.” For first habits or a low-pressure return to Scripture.",
            dayCount: 1, maxReadingsPerDay: 3, listPriority: -20,
            badgeZh: "方法一 · 轻松读经", badgeEn: "Path 1 · Easy reading", taglineZh: "旧约、新约、智慧书，每天各读一小段", taglineEn: "One short reading a day from the Old Testament, New Testament and Wisdom books",
            facts: [PlanFact(icon: "today", textZh: "每日 3 段", textEn: "3 readings a day"), PlanFact(icon: "loop", textZh: "随时跟上", textEn: "Never fall behind"), PlanFact(icon: "swap", textZh: "三条进度各走各的", textEn: "Three tracks, each at its own pace")],
            how: [PlanFact(icon: "sync", textZh: "读哪条就推哪条，三条互不绑定", textEn: "Only the track you read advances; the three are independent"), PlanFact(icon: "spa", textZh: "停了再回来，别担心漏读", textEn: "Come back whenever you stop; never worry about missing a day"), PlanFact(icon: "replay", textZh: "读完一环末章，回到该环起点", textEn: "When a track reaches its last chapter, it loops back to its start")],
            detailZh: "适合第一次建立习惯，或希望低压、可持续地回到神话语的人。三轨默认每日各进一章，你可随时在章节页推进，也可以恢复默认进度。", detailEn: "For building a first habit, or returning to God's Word in a low-pressure, sustainable way. Each track advances one chapter a day by default; you can move ahead from any chapter page, or reset to the default progress at any time."),
        ReadingPlanEntry(planId: "nt-deep-repeat", name: "新约深读 · 旧约通读", description: "AskBible 方法二 · 有效深读：参考麦克阿瑟研经法，52 阶，7 / 14 / 28 天深度。",
            titleZh: "正式研经", titleEn: "Formal Scripture Study", subtitleZh: "AskBible 方法二 · 有效深读", subtitleEn: "AskBible Path 2 · Effective deep study", blurbZh: "参考麦克阿瑟新约研读法，我们整理为 52 阶（4–6 章/阶）。从每阶 7 天起，可选 14 / 28 天深度；约 12 个月 / 2 年 / 4 年一轮，旧约每日一章并行。若刚开始，建议先用方法一。", blurbEn: "MacArthur-inspired NT study, shaped into 52 stages (4–6 chapters each). From 7 days/stage—optional 14 / 28-day depth (~12 mo / 2 yr / 4 yr per round); one OT chapter daily. New? Start with Path 1.",
            dayCount: 1, maxReadingsPerDay: 2, listPriority: -15,
            badgeZh: "方法二 · 正式研读", badgeEn: "Path 2 · Formal study", taglineZh: "同一段新约反复读，直到读进心里", taglineEn: "Read the same New Testament passage again and again until it sinks in",
            facts: [PlanFact(icon: "stairs", textZh: "新约 52 阶", textEn: "52 NT stages"), PlanFact(icon: "repeat", textZh: "每阶 7 / 14 / 28 天", textEn: "7 / 14 / 28 days per stage"), PlanFact(icon: "book", textZh: "旧约每日 1 章", textEn: "1 OT chapter a day")],
            how: [PlanFact(icon: "stairs", textZh: "新约分 52 阶，每阶 4–6 章", textEn: "The New Testament in 52 stages of 4–6 chapters"), PlanFact(icon: "repeat", textZh: "同一阶连读 7、14 或 28 天", textEn: "Stay on one stage for 7, 14 or 28 days"), PlanFact(icon: "book", textZh: "旧约每天 1 章并行通读", textEn: "One Old Testament chapter a day alongside")],
            detailZh: "参考约翰·麦克阿瑟的新约研读法。「读 N 遍」= 每阶连读 N 天；走完 52 阶为一轮，约 12 个月 / 2 年 / 4 年。停了再回来，别担心漏读；若刚开始读经，建议先用方法一。", detailEn: "Based on John MacArthur's New Testament reading method. “N readings” means staying on each stage for N days; 52 stages make one cycle of about 12 months, 2 years or 4 years. Come back whenever you stop; if you are new to Bible reading, start with Path 1."),
        ReadingPlanEntry(planId: "esvthroughthebible", name: "Through The Bible", description: "Through the Biblewww.esv.org",
            titleZh: "按书卷顺序通读圣经", titleEn: "Through The Bible", subtitleZh: "Through The Bible", subtitleEn: "按书卷顺序通读圣经", blurbZh: "每日旧约、新约各一段（多为两截经文），一年通读；列表里与「旧约新约并进」类计划只保留这一种较轻的节奏。", blurbEn: "One OT and one NT reading most days (often two passages), finishing the Bible in a year. We list one daily OT+NT plan to avoid near-duplicates.",
            dayCount: 365, maxReadingsPerDay: 2, listPriority: 0,
            badgeZh: "经典日课表", badgeEn: "Classic schedule", taglineZh: "每日旧约、新约各一段（多为两截经文），一年通读", taglineEn: "One OT and one NT reading most days (often two passages), finishing the Bible in a year",
            facts: [PlanFact(icon: "calendar", textZh: "365 天", textEn: "365 days"), PlanFact(icon: "today", textZh: "每日 ≤ 2 段", textEn: "≤ 2 readings a day")],
            how: [PlanFact(icon: "calendar", textZh: "按日课表逐日读，一年读完", textEn: "Read the schedule day by day and finish in a year"), PlanFact(icon: "today", textZh: "从今天起算，或对齐今年 1 月 1 日", textEn: "Start from today, or align to January 1 of this year"), PlanFact(icon: "spa", textZh: "停了再回来，别担心漏读", textEn: "Come back whenever you stop; never worry about missing a day")],
            detailZh: "每日旧约、新约各一段（多为两截经文），一年通读；列表里与「旧约新约并进」类计划只保留这一种较轻的节奏。", detailEn: "One OT and one NT reading most days (often two passages), finishing the Bible in a year. We list one daily OT+NT plan to avoid near-duplicates."),
        ReadingPlanEntry(planId: "backtothebiblechronological", name: "Back to the Bible Chronological", description: "Copyright Back to the Bible www.backtothebible.org",
            titleZh: "按历史时间线读通圣经", titleEn: "Back to the Bible Chronological", subtitleZh: "Back to the Bible Chronological", subtitleEn: "按历史时间线读通圣经", blurbZh: "按历史线索重排经文顺序的一年通读，常穿插约伯记等段落。适合想从「故事时间线」进入整本圣经的人。表内版权信息以英文标注为准。", blurbEn: "A one-year chronological sweep, often weaving Job and other blocks by storyline. Good if you like reading along historical time. Copyright notes in the source appear in English.",
            dayCount: 365, maxReadingsPerDay: 6, listPriority: 1,
            badgeZh: "经典日课表", badgeEn: "Classic schedule", taglineZh: "按历史线索重排经文顺序的一年通读，常穿插约伯记等段落", taglineEn: "A one-year chronological sweep, often weaving Job and other blocks by storyline",
            facts: [PlanFact(icon: "calendar", textZh: "365 天", textEn: "365 days"), PlanFact(icon: "today", textZh: "每日 ≤ 6 段", textEn: "≤ 6 readings a day")],
            how: [PlanFact(icon: "calendar", textZh: "按日课表逐日读，一年读完", textEn: "Read the schedule day by day and finish in a year"), PlanFact(icon: "today", textZh: "从今天起算，或对齐今年 1 月 1 日", textEn: "Start from today, or align to January 1 of this year"), PlanFact(icon: "spa", textZh: "停了再回来，别担心漏读", textEn: "Come back whenever you stop; never worry about missing a day")],
            detailZh: "按历史线索重排经文顺序的一年通读，常穿插约伯记等段落。适合想从「故事时间线」进入整本圣经的人。表内版权信息以英文标注为准。", detailEn: "A one-year chronological sweep, often weaving Job and other blocks by storyline. Good if you like reading along historical time. Copyright notes in the source appear in English."),
        ReadingPlanEntry(planId: "esvgospelsandepistles", name: "Gospel and Epistles", description: "Gospel and Epistleswww.esv.org",
            titleZh: "福音与书信", titleEn: "Gospel and Epistles", subtitleZh: "Gospel and Epistles", subtitleEn: "福音与书信", blurbZh: "聚焦新约福音与书信脉络的一年轨道，可与旧约通读计划搭配使用。", blurbEn: "A New-Testament-focused year through Gospels and letters—pair it with an OT plan if you like balance.",
            dayCount: 365, maxReadingsPerDay: 1, listPriority: 2,
            badgeZh: "经典日课表", badgeEn: "Classic schedule", taglineZh: "聚焦新约福音与书信脉络的一年轨道，可与旧约通读计划搭配使用", taglineEn: "A New-Testament-focused year through Gospels and letters—pair it with an OT plan if you like balance",
            facts: [PlanFact(icon: "calendar", textZh: "365 天", textEn: "365 days"), PlanFact(icon: "today", textZh: "每日 ≤ 1 段", textEn: "≤ 1 readings a day")],
            how: [PlanFact(icon: "calendar", textZh: "按日课表逐日读，一年读完", textEn: "Read the schedule day by day and finish in a year"), PlanFact(icon: "today", textZh: "从今天起算，或对齐今年 1 月 1 日", textEn: "Start from today, or align to January 1 of this year"), PlanFact(icon: "spa", textZh: "停了再回来，别担心漏读", textEn: "Come back whenever you stop; never worry about missing a day")],
            detailZh: "聚焦新约福音与书信脉络的一年轨道，可与旧约通读计划搭配使用。", detailEn: "A New-Testament-focused year through Gospels and letters—pair it with an OT plan if you like balance."),
        ReadingPlanEntry(planId: "esvchroniclesandprophets", name: "Chronicles and Prophets", description: "Chronicles and Prophetswww.esv.org",
            titleZh: "历代志与先知书", titleEn: "Chronicles and Prophets", subtitleZh: "Chronicles and Prophets", subtitleEn: "历代志与先知书", blurbZh: "以历代志与先知书等书卷为主线编排的读经轨道，偏历史与神论脉络。名称中的 ESV 为来源资料标签。", blurbEn: "A track centered on Chronicles and the prophetic books—helpful for history-and-oracle threads. “ESV” in the name is a source label only.",
            dayCount: 365, maxReadingsPerDay: 1, listPriority: 100,
            badgeZh: "经典日课表", badgeEn: "Classic schedule", taglineZh: "以历代志与先知书等书卷为主线编排的读经轨道，偏历史与神论脉络", taglineEn: "A track centered on Chronicles and the prophetic books—helpful for history-and-oracle threads",
            facts: [PlanFact(icon: "calendar", textZh: "365 天", textEn: "365 days"), PlanFact(icon: "today", textZh: "每日 ≤ 1 段", textEn: "≤ 1 readings a day")],
            how: [PlanFact(icon: "calendar", textZh: "按日课表逐日读，一年读完", textEn: "Read the schedule day by day and finish in a year"), PlanFact(icon: "today", textZh: "从今天起算，或对齐今年 1 月 1 日", textEn: "Start from today, or align to January 1 of this year"), PlanFact(icon: "spa", textZh: "停了再回来，别担心漏读", textEn: "Come back whenever you stop; never worry about missing a day")],
            detailZh: "以历代志与先知书等书卷为主线编排的读经轨道，偏历史与神论脉络。名称中的 ESV 为来源资料标签。", detailEn: "A track centered on Chronicles and the prophetic books—helpful for history-and-oracle threads. “ESV” in the name is a source label only."),
        ReadingPlanEntry(planId: "esveverydayinword", name: "Every Day In the Word", description: "Every Day in the Wordwww.esv.org",
            titleZh: "每日读经（叙事分块）", titleEn: "Every Day In the Word", subtitleZh: "Every Day In the Word", subtitleEn: "每日读经（叙事分块）", blurbZh: "每日多段经文，常按叙事大块划分（含跨章经节）。适合愿意跟随编辑划分细读的人；英文经题有助于对照原表。", blurbEn: "Several readings per day, often large narrative slices including cross-chapter spans. English labels help you match the upstream table exactly.",
            dayCount: 365, maxReadingsPerDay: 5, listPriority: 100,
            badgeZh: "经典日课表", badgeEn: "Classic schedule", taglineZh: "每日多段经文，常按叙事大块划分（含跨章经节）", taglineEn: "Several readings per day, often large narrative slices including cross-chapter spans",
            facts: [PlanFact(icon: "calendar", textZh: "365 天", textEn: "365 days"), PlanFact(icon: "today", textZh: "每日 ≤ 5 段", textEn: "≤ 5 readings a day")],
            how: [PlanFact(icon: "calendar", textZh: "按日课表逐日读，一年读完", textEn: "Read the schedule day by day and finish in a year"), PlanFact(icon: "today", textZh: "从今天起算，或对齐今年 1 月 1 日", textEn: "Start from today, or align to January 1 of this year"), PlanFact(icon: "spa", textZh: "停了再回来，别担心漏读", textEn: "Come back whenever you stop; never worry about missing a day")],
            detailZh: "每日多段经文，常按叙事大块划分（含跨章经节）。适合愿意跟随编辑划分细读的人；英文经题有助于对照原表。", detailEn: "Several readings per day, often large narrative slices including cross-chapter spans. English labels help you match the upstream table exactly."),
        ReadingPlanEntry(planId: "esvliterarystudybible", name: "ESV Literary Study Bible Plan", description: "ESV Literary Study Biblewww.esv.org",
            titleZh: "文学研读圣经计划", titleEn: "ESV Literary Study Bible Plan", subtitleZh: "ESV Literary Study Bible Plan", subtitleEn: "文学研读圣经计划", blurbZh: "按「文学研读」思路拆分的日课，常一日多段。名称含 ESV 为来源标签；正文仍以你在站内选择的译本为准。", blurbEn: "Multiple readings per day from a literary-study style table. The ESV wording in the title is historical; your on-site Bible text follows the translation you import.",
            dayCount: 365, maxReadingsPerDay: 4, listPriority: 100,
            badgeZh: "经典日课表", badgeEn: "Classic schedule", taglineZh: "按「文学研读」思路拆分的日课，常一日多段", taglineEn: "Multiple readings per day from a literary-study style table",
            facts: [PlanFact(icon: "calendar", textZh: "365 天", textEn: "365 days"), PlanFact(icon: "today", textZh: "每日 ≤ 4 段", textEn: "≤ 4 readings a day")],
            how: [PlanFact(icon: "calendar", textZh: "按日课表逐日读，一年读完", textEn: "Read the schedule day by day and finish in a year"), PlanFact(icon: "today", textZh: "从今天起算，或对齐今年 1 月 1 日", textEn: "Start from today, or align to January 1 of this year"), PlanFact(icon: "spa", textZh: "停了再回来，别担心漏读", textEn: "Come back whenever you stop; never worry about missing a day")],
            detailZh: "按「文学研读」思路拆分的日课，常一日多段。名称含 ESV 为来源标签；正文仍以你在站内选择的译本为准。", detailEn: "Multiple readings per day from a literary-study style table. The ESV wording in the title is historical; your on-site Bible text follows the translation you import."),
        ReadingPlanEntry(planId: "esvpentateuchandhistoryofisrael", name: "Pentateuch and History of Israel", description: "Pentateuch and History of Israelwww.esv.org",
            titleZh: "五经与以色列历史", titleEn: "Pentateuch and History of Israel", subtitleZh: "Pentateuch and History of Israel", subtitleEn: "五经与以色列历史", blurbZh: "自摩西五经延伸至列国与王朝叙事，适合想从立约与历史骨架读起的人。", blurbEn: "Starts in the Torah and walks through Israel’s historical books—good if you want covenant and narrative spine first.",
            dayCount: 365, maxReadingsPerDay: 1, listPriority: 100,
            badgeZh: "经典日课表", badgeEn: "Classic schedule", taglineZh: "自摩西五经延伸至列国与王朝叙事，适合想从立约与历史骨架读起的人", taglineEn: "Starts in the Torah and walks through Israel’s historical books—good if you want covenant and narrative spine first",
            facts: [PlanFact(icon: "calendar", textZh: "365 天", textEn: "365 days"), PlanFact(icon: "today", textZh: "每日 ≤ 1 段", textEn: "≤ 1 readings a day")],
            how: [PlanFact(icon: "calendar", textZh: "按日课表逐日读，一年读完", textEn: "Read the schedule day by day and finish in a year"), PlanFact(icon: "today", textZh: "从今天起算，或对齐今年 1 月 1 日", textEn: "Start from today, or align to January 1 of this year"), PlanFact(icon: "spa", textZh: "停了再回来，别担心漏读", textEn: "Come back whenever you stop; never worry about missing a day")],
            detailZh: "自摩西五经延伸至列国与王朝叙事，适合想从立约与历史骨架读起的人。", detailEn: "Starts in the Torah and walks through Israel’s historical books—good if you want covenant and narrative spine first."),
        ReadingPlanEntry(planId: "esvpsalmsandwisdomliterature", name: "Psalms and Wisdom Literature", description: "Psalm and Wisdom Literaturewww.esv.org",
            titleZh: "诗篇与智慧文学", titleEn: "Psalms and Wisdom Literature", subtitleZh: "Psalms and Wisdom Literature", subtitleEn: "诗篇与智慧文学", blurbZh: "以诗篇、箴言、传道书等智慧传统为主的轨道，可与叙事类计划互补。", blurbEn: "Emphasizes Psalms and wisdom books—useful alongside more narrative-heavy schedules.",
            dayCount: 365, maxReadingsPerDay: 1, listPriority: 100,
            badgeZh: "经典日课表", badgeEn: "Classic schedule", taglineZh: "以诗篇、箴言、传道书等智慧传统为主的轨道，可与叙事类计划互补", taglineEn: "Emphasizes Psalms and wisdom books—useful alongside more narrative-heavy schedules",
            facts: [PlanFact(icon: "calendar", textZh: "365 天", textEn: "365 days"), PlanFact(icon: "today", textZh: "每日 ≤ 1 段", textEn: "≤ 1 readings a day")],
            how: [PlanFact(icon: "calendar", textZh: "按日课表逐日读，一年读完", textEn: "Read the schedule day by day and finish in a year"), PlanFact(icon: "today", textZh: "从今天起算，或对齐今年 1 月 1 日", textEn: "Start from today, or align to January 1 of this year"), PlanFact(icon: "spa", textZh: "停了再回来，别担心漏读", textEn: "Come back whenever you stop; never worry about missing a day")],
            detailZh: "以诗篇、箴言、传道书等智慧传统为主的轨道，可与叙事类计划互补。", detailEn: "Emphasizes Psalms and wisdom books—useful alongside more narrative-heavy schedules."),
        ReadingPlanEntry(planId: "mcheyne", name: "M'Cheyne", description: "M'Cheyne Reading Plan",
            titleZh: "麦琴读经表", titleEn: "M'Cheyne reading plan", subtitleZh: "M'Cheyne Reading Plan", subtitleEn: "麦琴读经表", blurbZh: "每日四章并行，约一年内通读旧约一遍，新约与诗篇各约两遍。节奏较密，适合能稳定安排读经时间的人。副题与经题保留英文，便于查对常见版本。", blurbEn: "Four short readings per day in a pattern linked to M'Cheyne: OT once, NT and Psalms about twice in a year. Steady daily time helps. Chinese title above is a short guide; English labels stay authoritative for the slice boundaries.",
            dayCount: 365, maxReadingsPerDay: 4, listPriority: 100,
            badgeZh: "经典日课表", badgeEn: "Classic schedule", taglineZh: "每日四章并行，约一年内通读旧约一遍，新约与诗篇各约两遍", taglineEn: "Four short readings per day in a pattern linked to M'Cheyne: OT once, NT and Psalms about twice in a year",
            facts: [PlanFact(icon: "calendar", textZh: "365 天", textEn: "365 days"), PlanFact(icon: "today", textZh: "每日 ≤ 4 段", textEn: "≤ 4 readings a day")],
            how: [PlanFact(icon: "calendar", textZh: "按日课表逐日读，一年读完", textEn: "Read the schedule day by day and finish in a year"), PlanFact(icon: "today", textZh: "从今天起算，或对齐今年 1 月 1 日", textEn: "Start from today, or align to January 1 of this year"), PlanFact(icon: "spa", textZh: "停了再回来，别担心漏读", textEn: "Come back whenever you stop; never worry about missing a day")],
            detailZh: "每日四章并行，约一年内通读旧约一遍，新约与诗篇各约两遍。节奏较密，适合能稳定安排读经时间的人。副题与经题保留英文，便于查对常见版本。", detailEn: "Four short readings per day in a pattern linked to M'Cheyne: OT once, NT and Psalms about twice in a year. Steady daily time helps. Chinese title above is a short guide; English labels stay authoritative for the slice boundaries."),
        ReadingPlanEntry(planId: "oneyearchronological", name: "One Year Chronological", description: "One Year Chronologicalwww.oneyearbibleonline.com",
            titleZh: "一年编年通读（多段并行）", titleEn: "One Year Chronological", subtitleZh: "One Year Chronological", subtitleEn: "一年编年通读（多段并行）", blurbZh: "按编年思路编排；部分日期会并列多段经文以贴近历史平行叙事。单日阅读量可能较多，可按自己的节奏延展完成。", blurbEn: "Chronological ordering; some days stack several passages to mirror parallel events—feel free to spread a heavy day across more than one sitting.",
            dayCount: 365, maxReadingsPerDay: 15, listPriority: 100,
            badgeZh: "经典日课表", badgeEn: "Classic schedule", taglineZh: "按编年思路编排", taglineEn: "Chronological ordering",
            facts: [PlanFact(icon: "calendar", textZh: "365 天", textEn: "365 days"), PlanFact(icon: "today", textZh: "每日 ≤ 15 段", textEn: "≤ 15 readings a day")],
            how: [PlanFact(icon: "calendar", textZh: "按日课表逐日读，一年读完", textEn: "Read the schedule day by day and finish in a year"), PlanFact(icon: "today", textZh: "从今天起算，或对齐今年 1 月 1 日", textEn: "Start from today, or align to January 1 of this year"), PlanFact(icon: "spa", textZh: "停了再回来，别担心漏读", textEn: "Come back whenever you stop; never worry about missing a day")],
            detailZh: "按编年思路编排；部分日期会并列多段经文以贴近历史平行叙事。单日阅读量可能较多，可按自己的节奏延展完成。", detailEn: "Chronological ordering; some days stack several passages to mirror parallel events—feel free to spread a heavy day across more than one sitting."),
    ]
    static func plan(id: String) -> ReadingPlanEntry? { plans.first { $0.planId == id } }
    /// 目录页分组：主推（三循环、新约深读，按此序）与其它
    static var featured: [ReadingPlanEntry] { [tripleLoopId, ntDeepRepeatId].compactMap(plan(id:)) }
    static var others: [ReadingPlanEntry] { plans.filter { $0.planId != tripleLoopId && $0.planId != ntDeepRepeatId } }
    static func isPointerPlan(_ id: String) -> Bool { id == tripleLoopId || id == ntDeepRepeatId }
}

