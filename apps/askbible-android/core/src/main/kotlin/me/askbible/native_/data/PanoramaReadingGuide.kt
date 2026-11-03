package me.askbible.native_.data

/** Original summaries inspired by the supplied overview notes, checked against the
 * cited passages. Connections distinguish explicit references from thematic readings.
 * No course transcript text or denominational end-times sequence is reproduced. */
data class PanoramaReadingLink(val bookId: String, val chapter: Int, val verses: String, val kindZh: String, val kindEn: String, val reasonZh: String, val reasonEn: String)
data class PanoramaReadingNote(val zh: String, val en: String, val links: List<PanoramaReadingLink> = emptyList())
object PanoramaReadingGuide {
    val notes = mapOf(
        "creation" to PanoramaReadingNote("创造呈现美好的关系；接下来，人的背离使人与神、人与人、人与土地的关系破裂。", "Creation presents good relationships; human rebellion then fractures relationships with God, one another, and the ground."),
        "fall" to PanoramaReadingNote("该隐、家谱中的死亡、洪水与巴别接续展现人的困境。故事随后转向神呼召亚伯拉罕，开启应许的道路。", "Cain, the deaths in the genealogy, the flood, and Babel unfold humanity's plight. The story then turns to God's call of Abraham and a path of promise."),
        "ancestors" to PanoramaReadingNote("百姓、土地、万民得福，是阅读这一段的三个线索。家族迁往埃及，把先祖的故事连接到出埃及。", "People, land, and blessing for all peoples are three reading threads. The family's move to Egypt connects the ancestors' story to the exodus.", listOf(
            PanoramaReadingLink("GEN",12,"1–3","关键经文","Key passage","神呼召亚伯兰，指示他前往土地，应许使他成为大国，并使地上的万族因他得福。","God calls Abram to a land, promises to make him a great nation, and promises blessing for all families of the earth through him."),
            PanoramaReadingLink("GAL",3,"8–9","新约明确引用","Explicit New Testament reference","保罗引用万国得福的应许，讨论亚伯拉罕、信心与福音的关系。","Paul cites the promise of blessing for the nations as he discusses Abraham, faith, and the gospel.")
        )),
        "exodus" to PanoramaReadingNote("出埃及记讲蒙拯救并立约；利未记展开敬拜与圣洁。接下来，民数记呈现百姓在旷野怎样回应神。", "Exodus tells of rescue and covenant; Leviticus develops worship and holiness. Numbers then shows how the people respond to God in the wilderness."),
        "wilderness" to PanoramaReadingNote("民数记连接两代人；申命记向将进入土地的新一代重申约。进入土地之后，是否忠于神成为持续的问题。", "Numbers connects two generations; Deuteronomy renews the covenant with those about to enter the land. Faithfulness remains a central question after entry.", listOf(
            PanoramaReadingLink("DEU",28,"","关键经文","Key passage","守约的祝福与背约的咒诅，为阅读以色列此后的历史提供背景；不能把它套用为所有人遭灾的原因。","Covenant blessings and curses frame Israel's subsequent history; they should not be used to explain every person's suffering.")
        )),
        "land" to PanoramaReadingNote("进入与分配土地之后，故事转向百姓如何在其中生活。士师记继续追问他们是否忠于神。", "After entry and the allocation of land, the story turns to life within it. Judges continues to ask whether the people remain faithful to God."),
        "judges" to PanoramaReadingNote("失信 → 受压迫 → 呼求 → 蒙拯救；反复的循环伴随日益恶化的局面。路得的家庭故事则把士师时期连接到大卫。", "Unfaithfulness → oppression → crying out → deliverance: repeated cycles accompany worsening conditions. Ruth's family story links the era of the judges to David.", listOf(
            PanoramaReadingLink("RUT",4,"17–22","经文明确连接","Explicit textual connection","书末家谱从路得的家庭延伸到大卫，把家庭故事连接到王国历史。","The closing genealogy leads from Ruth's family to David, connecting the family story with the history of the kingdom.")
        )),
        "kingdom" to PanoramaReadingNote("君王带来新的局面，却也显出人的失败。大卫家室的应许，使王国的盼望超越眼前的一位君王。", "Kingship brings a new situation but also reveals human failure. The promise to David's house carries hope beyond any one reigning king.", listOf(
            PanoramaReadingLink("2SA",7,"12–16","关键经文","Key passage","神应许大卫的后裔、家室与王位；这是理解后来王权盼望的重要经文。","God promises David an offspring, a house, and an enduring throne: a key passage for later hopes of kingship."),
            PanoramaReadingLink("LUK",1,"32–33","经文关联","Biblical connection","关于耶稣的宣告提到大卫的宝座和没有穷尽的国，呼应大卫家室的应许。","The announcement about Jesus names David's throne and a kingdom without end, echoing the promise to David's house.")
        )),
        "divided" to PanoramaReadingNote("先知既指出失信、呼召悔改，也宣告盼望。王国的分裂与失败，把故事带向亡国与被掳。", "Prophets confront unfaithfulness and call for repentance while also announcing hope. Division and failure lead the story toward defeat and exile."),
        "exile" to PanoramaReadingNote("被掳带来失地与失去圣殿的创伤，但审判并不是故事的终点；接下来出现归回与重建。", "Exile brings the trauma of losing land and temple, but judgment is not the end of the story. Return and rebuilding follow."),
        "return" to PanoramaReadingNote("土地、圣殿与城墙的恢复，并未消除人的困境。旧约的盼望继续朝向将来，福音书从这里展开新的见证。", "Restoring land, temple, and walls does not remove humanity's plight. Old Testament hope still looks forward as the Gospels open a new witness."),
        "wisdom" to PanoramaReadingNote("这些书卷帮助人在故事中祷告、哀哭、思考与生活；它们不是历史主线上的下一个事件。", "These books help people pray, lament, reflect, and live within the story; they are not the next event in a historical sequence."),
        "prophets" to PanoramaReadingNote("读先知书时，把审判与盼望放回各自处境，再与相关历史书一起读；不同先知并不处在同一时代。", "Read prophetic judgment and hope in their settings alongside the relevant histories; the prophets do not all belong to one period."),
        "jesus" to PanoramaReadingNote("耶稣受死、复活，门徒随后受托作见证。路加福音与使徒行传尤其清楚地连接这段转折。", "Jesus dies and rises, and his followers are commissioned as witnesses. Luke and Acts connect this transition especially clearly.", listOf(
            PanoramaReadingLink("ACT",1,"1–8","叙事衔接","Narrative continuation","使徒行传开头回顾前书，记述复活后的耶稣，并展开圣灵赐能力、门徒作见证的使命。","Acts recalls the earlier account, describes the risen Jesus, and unfolds the Spirit-empowered mission of the witnesses.")
        )),
        "mission" to PanoramaReadingNote("使徒行传记述圣灵推动福音跨越地域与族群。书信则帮助这些群体面对信仰、共同生活与苦难中的问题。", "Acts describes the Spirit carrying the gospel across places and peoples. The letters help communities address faith, shared life, and suffering."),
        "letters" to PanoramaReadingNote("读每封信，先留意收信群体和具体问题，再观察所信的道怎样成为共同生活；不要只摘出孤立的句子。", "For each letter, notice its recipients and concrete concerns, then observe how belief shapes shared life rather than extracting isolated sentences."),
        "witness" to PanoramaReadingNote("启示录在劝勉现实教会的同时，把盼望引向神最终的更新；地图不把异象排列成唯一的末世时间表。", "As Revelation exhorts actual churches, it directs hope toward God's final renewal. This map does not arrange its visions into a single end-times timetable."),
        "renewal" to PanoramaReadingNote("从创造中的园，到生命与同在的更新，可以回看整条故事。这里是主题上的呼应，不表示首尾的每个细节完全相同。", "From the garden in creation to renewed life and presence, look back across the whole story. This is a thematic correspondence, not an identity of every detail.", listOf(
            PanoramaReadingLink("GEN",2,"9–10","主题呼应","Thematic correspondence","创世记中的生命树与河流，可与启示录22章的生命树和生命水一同阅读。","The tree of life and river in Genesis can be read alongside the tree of life and water of life in Revelation 22."),
            PanoramaReadingLink("REV",22,"1–5","主题呼应","Thematic correspondence","生命水、生命树与神的同在，呈现故事终点的盼望。","The water of life, tree of life, and God's presence portray the story's concluding hope.")
        ))
    )
}
