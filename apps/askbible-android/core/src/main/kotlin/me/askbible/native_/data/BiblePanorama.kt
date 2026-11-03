package me.askbible.native_.data

/** Original editorial reading guide, not a chronology or denominational statement.
 * Six-act teaching references: Goheen/Bartholomew, The Drama of Scripture;
 * Biblica, The Drama of the Bible in Six Acts. Labels and summaries are original.
 * Spans are narrative/topic connections, not dates of authorship. */
data class PanoramaSpan(val bookId: String, val first: Int = 1, val last: Int = BibleCatalog.book(bookId)!!.chapterCount)
data class PanoramaSection(val id: String, val zh: String, val en: String, val summaryZh: String, val summaryEn: String, val spans: List<PanoramaSpan>)
data class PanoramaAct(val zh: String, val en: String, val subtitleZh: String, val subtitleEn: String, val sections: List<PanoramaSection>)

object BiblePanorama {
    private fun books(vararg ids: String) = ids.map { PanoramaSpan(it) }
    val acts = listOf(
        PanoramaAct("创造", "Creation", "美好的开始", "A good beginning", listOf(
            PanoramaSection("creation", "天地与人", "The world and humanity", "神创造天地，人受托照管受造世界。", "God creates the world and entrusts humanity with its care.", listOf(PanoramaSpan("GEN", 1, 2))))),
        PanoramaAct("堕落", "The fall", "世界的破裂", "A fractured world", listOf(
            PanoramaSection("fall", "从伊甸园到巴别", "From Eden to Babel", "人的背离带来破裂与死亡；审判与保守交织。", "Human rebellion brings rupture and death; judgment and preservation intertwine.", listOf(PanoramaSpan("GEN", 3, 11))))),
        PanoramaAct("以色列", "Israel", "应许中的百姓", "A people and a promise", listOf(
            PanoramaSection("ancestors", "先祖与应许", "Ancestors and promise", "亚伯拉罕蒙召；一家人的故事走向埃及，万族得福的应许贯穿其中（创12:1–3）。", "Abraham is called; his family's story leads to Egypt, carrying a promise of blessing for all peoples (Gen 12:1–3).", listOf(PanoramaSpan("GEN", 12, 50))),
            PanoramaSection("exodus", "出埃及与立约", "Exodus and covenant", "百姓离开奴役，在西奈立约，学习敬拜与生活（出19–20）。利未记连接这一处境。", "Freed from slavery, the people enter a covenant at Sinai and learn worship and life (Exod 19–20). Leviticus belongs in this setting.", books("EXO", "LEV")),
            PanoramaSection("wilderness", "旷野", "Wilderness", "一代人经历旷野，下一代准备进入土地（民13–14；申1）。", "One generation journeys through the wilderness; another prepares to enter the land (Num 13–14; Deut 1).", books("NUM", "DEU")),
            PanoramaSection("land", "进入土地", "Entering the land", "过约旦河、争战、分配土地，重申对神的忠诚（书3；24）。", "Crossing the Jordan, battles, allocation of land, and renewed allegiance to God (Josh 3; 24).", books("JOS")),
            PanoramaSection("judges", "士师时期", "The judges", "士师记呈现反复失信与蒙拯救。路得记1:1明确将家庭故事放在这一时期；4:17、22的家谱连接到大卫。", "Judges recounts repeated unfaithfulness and deliverance. Ruth 1:1 places its family story in this era; its genealogy leads to David (4:17, 22).", books("JDG", "RUT")),
            PanoramaSection("kingdom", "王国兴起", "The kingdom rises", "扫罗、大卫与所罗门：王权兴起、圣殿建立，大卫家室的应许成为路标（撒下7）。历代志从另一角度重述。", "Saul, David, and Solomon: kingship and the temple. The promise to David's house is a landmark (2 Sam 7). Chronicles retells this history.", listOf(PanoramaSpan("1SA"), PanoramaSpan("2SA"), PanoramaSpan("1KI",1,11), PanoramaSpan("1CH"), PanoramaSpan("2CH",1,9))),
            PanoramaSection("divided", "王国分裂", "A divided kingdom", "以色列与犹大两国并行，君王与百姓面对先知的警告与盼望（王上12）。", "Israel and Judah become separate kingdoms; prophets confront kings and people with warning and hope (1 Kgs 12).", listOf(PanoramaSpan("1KI",12,22), PanoramaSpan("2KI",1,16), PanoramaSpan("2CH",10,35))),
            PanoramaSection("exile", "亡国与被掳", "Defeat and exile", "北国覆亡，后来耶路撒冷被毁。哀歌表达悲痛；以西结书和但以理书连接被掳处境。", "The northern kingdom falls, and later Jerusalem is destroyed. Lamentations voices grief; Ezekiel and Daniel connect with exile.", listOf(PanoramaSpan("2KI",17,25),PanoramaSpan("2CH",36,36)) + books("LAM","EZK","DAN")),
            PanoramaSection("return", "归回与重建", "Return and rebuilding", "部分百姓归回，重建圣殿与城墙；以斯帖记呈现留在波斯的犹太群体。", "Some return to rebuild temple and walls; Esther portrays a Jewish community remaining in Persia.", books("EZR","NEH","EST","HAG","ZEC","MAL")),
            PanoramaSection("wisdom", "诗歌与智慧", "Poetry and wisdom", "祷告、痛苦、爱与生活智慧。这些书卷跨越处境，不把整卷固定在一个历史时期。", "Prayer, suffering, love, and wisdom for life. These books span contexts and are not assigned a single historical date.", books("JOB","PSA","PRO","ECC","SNG")),
            PanoramaSection("prophets", "先知的声音", "Prophetic voices", "在不同处境中指出失信、呼召悔改、宣告盼望。本组是阅读索引，不表示这些先知同时生活。", "In different settings, prophets confront unfaithfulness, call for repentance, and proclaim hope. This reading index does not imply they lived at the same time.", books("ISA","JER","HOS","JOL","AMO","OBA","JON","MIC","NAM","HAB","ZEP"))
        )),
        PanoramaAct("耶稣基督", "Jesus Christ", "故事的中心", "The center of the story", listOf(
            PanoramaSection("jesus", "四福音的见证", "Four Gospel witnesses", "四卷福音从各自角度见证耶稣的生活、教导、受死与复活。", "Four Gospels witness to Jesus' life, teaching, death, and resurrection from distinct perspectives.", books("MAT","MRK","LUK","JHN")))),
        PanoramaAct("教会的使命", "The church's mission", "福音传向万民", "Good news for all peoples", listOf(
            PanoramaSection("mission", "从耶路撒冷向外", "Outward from Jerusalem", "圣灵降临，门徒作见证，福音跨越地域与族群（徒1:8；2）。", "The Spirit comes; witnesses carry the gospel across places and peoples (Acts 1:8; 2).", books("ACT")),
            PanoramaSection("letters", "教会的信仰与生活", "Faith and life together", "书信回应具体群体与个人，教导信仰、生活与盼望；可结合使徒行传阅读。", "Letters address communities and individuals, teaching faith, life, and hope; read alongside Acts.", BibleCatalog.groups.flatMap { it.books }.filter { it.number in 45..65 }.map { PanoramaSpan(it.id) }),
            PanoramaSection("witness", "苦难中的见证与盼望", "Witness and hope", "启示录首先写给现实中的教会（启1–3），通过异象带来劝勉与盼望；整卷不能只当作未来时间表。", "Revelation addresses real churches (Rev 1–3), offering exhortation and hope through visions; the whole book is not simply a future timetable.", books("REV")))),
        PanoramaAct("新创造", "New creation", "万物更新的盼望", "The hope of renewal", listOf(
            PanoramaSection("renewal", "神与人同在", "God with humanity", "新天新地、生命树、神与人同在（启21–22）。这里呈现终点的盼望，不规定有争议的末世事件次序。", "New heaven and earth, the tree of life, and God with humanity (Rev 21–22). This shows the story's hope without prescribing disputed end-times sequences.", listOf(PanoramaSpan("REV",21,22)))))
    )

    fun location(bookId: String, chapter: Int): Pair<Int, PanoramaSection>? {
        // Revelation's closing vision has both its letter context and its new-creation connection.
        val order = if (bookId == "REV" && chapter >= 21) listOf(5,4) else acts.indices.toList()
        for (i in order) acts[i].sections.firstOrNull { s -> s.spans.any { it.bookId == bookId && chapter in it.first..it.last } }?.let { return i to it }
        return null
    }
}
