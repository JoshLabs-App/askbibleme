package me.askbible.native_.data

/** Original, concise reading introductions. References are entry points, not exhaustive outlines.
 * No disputed authorship or composition dates are asserted. */
data class BibleBookIntroduction(val zh: String, val en: String, val references: String) {
    fun text(locale: AppLocale) = AppLocale.pick(zh, en, locale)
}

object BibleBookIntroductions {
    private val entries = """
GEN|从创造与人的背离，到亚伯拉罕一家，讲述世界的起源与神应许的开始。|From creation and human rebellion to Abraham's family: the world's beginnings and God's promises.|1–3; 12; 37–50
EXO|神拯救受奴役的以色列人，在西奈与他们立约，并住在百姓中间。|God frees enslaved Israel, makes a covenant at Sinai, and dwells among the people.|1–20; 25–40
LEV|借献祭、洁净与生活条例，教导百姓怎样亲近圣洁的神、爱邻舍。|Sacrifices, purity, and daily conduct teach a people to approach a holy God and love their neighbors.|1–7; 16; 19
NUM|记述旷野中的不信与失败，以及神带领新一代走向应许地。|Wilderness journeys expose unbelief and failure as God leads a new generation toward the promised land.|13–14; 20–21; 26–27
DEU|摩西向新一代重申律法，呼吁他们记念神、爱神，并忠于所立的约。|Moses renews the law for a new generation, calling them to remember God, love him, and keep the covenant.|5–6; 28–30
JOS|以色列进入迦南、争战并分配土地，受呼召继续忠于神。|Israel enters Canaan, fights battles, receives land, and is called to remain faithful to God.|1–6; 13–24
JDG|百姓反复离弃神、受压迫又蒙拯救，整个群体逐渐陷入混乱。|Repeated rebellion, oppression, and deliverance reveal a people descending into disorder.|2; 6–8; 17–21
RUT|拿俄米与路得在失去与归回中经历眷顾，一个家庭的故事最终连到大卫。|Naomi and Ruth find care amid loss and return; their family story leads to David.|1–4
1SA|从撒母耳到扫罗与大卫，讲述王权的兴起，以及人怎样回应神。|Samuel, Saul, and David introduce Israel's monarchy and contrasting responses to God.|1–3; 8–16; 24–26
2SA|大卫成为王，领受家室的应许；他的严重过犯也给家庭和国家带来后果。|David becomes king and receives a promise for his house; his grave sins bring consequences for family and nation.|5–7; 11–19
1KI|从所罗门建殿到王国分裂，君王的选择与先知的警告交织。|Solomon's temple gives way to a divided kingdom, as royal choices meet prophetic warnings.|1–12; 17–22
2KI|南北两国走向覆亡与被掳，先知持续呼唤百姓回转。|Israel and Judah move toward defeat and exile while prophets call the people back to God.|2–5; 17; 22–25
1CH|借家谱和大卫的故事，回顾以色列的身份，并着重圣殿与敬拜的预备。|Genealogies and David's story recall Israel's identity and preparations for temple worship.|1–9; 15–17; 22–29
2CH|以圣殿敬拜与君王对神的回应为重点，重述所罗门到被掳、归回诏令的历史。|Temple worship and royal responses to God frame the story from Solomon to exile and the decree to return.|1–7; 29–36
EZR|被掳者归回、重建圣殿，并面对重建群体生活与忠于律法的挑战。|Returning exiles rebuild the temple and face the challenge of renewing communal life under God's law.|1–6; 7–10
NEH|尼希米带领重建耶路撒冷城墙，百姓也重新聆听律法、整顿群体生活。|Nehemiah leads Jerusalem's wall rebuilding as the people hear the law and reform community life.|1–6; 8–13
EST|波斯境内的犹太人面临灭族危机，以斯帖与末底改参与带来局势的逆转。|Jews in Persia face destruction; Esther and Mordecai take part in a dramatic reversal.|3–9
JOB|一个义人的苦难引发追问，挑战把苦难简单归因于个人犯罪的解释。|A righteous man's suffering challenges easy explanations that equate affliction with personal wrongdoing.|1–2; 3–31; 38–42
PSA|用赞美、哀哭、感恩与祈求，把人生各种处境带到神面前。|Praise, lament, thanksgiving, and petition bring the breadth of human experience before God.|1; 13; 23; 51; 104; 150
PRO|以敬畏神为智慧的起点，教导言语、工作、家庭、财富与待人处事。|Wisdom begins with reverence for God and shapes speech, work, family, wealth, and relationships.|1–9; 10–31
ECC|面对人生的短暂、劳碌与不可掌控，追问什么值得追求，呼吁敬畏神。|Life's brevity, toil, and uncertainty prompt a search for what matters and a call to fear God.|1–3; 9; 12
SNG|以男女相爱的诗歌，表达爱慕、寻找、喜悦与爱情的力量。|Love poetry voices desire, searching, delight, and the strength of love.|1–8
ISA|指出百姓的罪与审判，又展开安慰、仆人的工作和更新世界的盼望。|Judgment on sin stands alongside comfort, the servant's work, and hope for a renewed world.|1; 6; 40; 52–55; 65–66
JER|在犹大走向亡国时呼召悔改，并在审判中宣告归回与新约的盼望。|As Judah approaches disaster, Jeremiah calls for repentance and announces hope of return and a new covenant.|1–7; 25; 29–33; 52
LAM|为耶路撒冷被毁哀哭，在痛苦中向神诉说，也挣扎着持守盼望。|Poems mourn Jerusalem's destruction, bringing grief to God and struggling toward hope.|1–5
EZK|在被掳处境中宣告审判，也描绘新心、新灵与神同在归回的盼望。|In exile, visions announce judgment and hope for a new heart, a new spirit, and God's returning presence.|1–3; 10–11; 36–37; 40–48
DAN|借异邦宫廷中的忠诚信仰和异象，呈现地上帝国之上神的主权。|Faithfulness in foreign courts and visions of kingdoms affirm God's sovereignty over earthly empires.|1–6; 7–12
HOS|用破裂的婚姻揭示以色列的失信，也表达神呼唤百姓归回的爱。|A broken marriage portrays Israel's unfaithfulness and God's love calling the people to return.|1–3; 11; 14
JOL|从灾难呼唤悔改，宣告耶和华的日子与神浇灌圣灵的应许。|Disaster becomes a call to repentance, with the day of the Lord and the promise of the Spirit.|1–3
AMO|斥责欺压穷人和空洞敬拜，宣告公义的审判及末后的恢复。|Oppression and hollow worship face judgment, while the closing vision promises restoration.|2; 5; 8–9
OBA|责备以东在弟兄遭难时的骄傲与暴力，宣告神施行公义。|Edom's pride and violence against its afflicted brother come under God's judgment.|1
JON|先知逃避使命，又不愿看见敌人蒙怜悯；故事追问神恩典的范围。|A reluctant prophet resists both his mission and mercy for enemies, exposing the reach of God's compassion.|1–4
MIC|揭露领袖与百姓的不义，呼召行公义、好怜悯，并展望将来的牧者。|Corrupt leaders and injustice are confronted with a call to justice and mercy and hope for a coming ruler.|1–3; 5–7
NAM|宣告尼尼微的倾覆，指出暴力帝国也要面对神的审判。|Nineveh's downfall declares that even violent empires must face God's judgment.|1–3
HAB|先知就不义与神的作为发问，在未见局势改变时学习信靠。|A prophet questions injustice and God's actions, learning trust before circumstances change.|1–3
ZEP|宣告耶和华的日子，呼召寻求神，并展望余民得恢复。|The day of the Lord brings judgment, a call to seek God, and hope for a restored remnant.|1–3
HAG|鼓励归回的百姓重建圣殿，重新调整生活的优先次序。|Returned exiles are urged to rebuild the temple and reconsider their priorities.|1–2
ZEC|借异象与应许鼓励归回群体，展望洁净、君王与神的同在。|Visions and promises encourage the returned community with cleansing, kingship, and God's presence.|1–8; 9–14
MAL|指出敷衍的敬拜与关系中的失信，呼召百姓归向神并等候祂的来到。|Careless worship and broken faithfulness are challenged by a call to return to God and await his coming.|1–4
MAT|将耶稣的事奉连到以色列的经文与应许，教导门徒活在天国之下。|Jesus' ministry is linked to Israel's Scriptures and promises, teaching disciples life under heaven's kingdom.|1–2; 5–7; 13; 26–28
MRK|以紧凑叙事呈现耶稣的权柄、受苦与十字架，并追问跟随祂意味着什么。|A fast-moving account of Jesus' authority, suffering, and cross asks what it means to follow him.|1–3; 8–10; 14–16
LUK|讲述耶稣带来的救恩，特别关注贫穷者、被排斥者与失丧的人。|Jesus brings salvation, with particular attention to the poor, outsiders, and the lost.|1–4; 10; 15; 19; 22–24
JHN|借耶稣的神迹与讲论，引导人相信祂是基督、神的儿子，并因祂得生命。|Jesus' signs and teaching invite belief in him as Messiah and Son of God, and life in his name.|1; 3; 11; 13–17; 20
ACT|圣灵推动门徒作见证，福音从耶路撒冷跨越族群，传到罗马。|The Spirit empowers witnesses as the gospel crosses peoples and places from Jerusalem to Rome.|1–2; 10–11; 13–28
ROM|解释神怎样借基督使人因信称义，并使不同背景的人在恩典中共同生活。|God makes people right with him through faith in Christ, shaping a shared life of grace across different backgrounds.|1–8; 9–11; 12–16
1CO|回应教会的分裂、伦理与敬拜问题，以十字架、爱和复活重整群体生活。|The cross, love, and resurrection reshape a church facing division, ethical failures, and disorder in worship.|1–4; 5–7; 11–15
2CO|保罗坦诚谈软弱、受苦与使徒职分，呼吁和好、信任和慷慨。|Paul speaks openly of weakness, suffering, and ministry, calling for reconciliation, trust, and generosity.|1–7; 8–9; 10–13
GAL|强调人因信基督得称义，并教导信徒在自由中靠圣灵生活、彼此相爱。|Justification comes through faith in Christ; freedom is lived by the Spirit in love for others.|2–3; 5–6
EPH|讲述神在基督里使不同群体成为一体，并把这身份落实在教会、家庭与生活中。|God unites different peoples in Christ, shaping the church, households, and everyday conduct.|1–3; 4–6
PHP|在受苦中仍以基督为喜乐，呼吁信徒效法祂的谦卑、同心生活。|Joy in Christ amid suffering accompanies a call to share his humility and live in unity.|1–4
COL|高举基督的身份与充足，呼吁信徒扎根于祂，脱去旧生活、活出新人。|Christ's supremacy and sufficiency ground a call to leave the old life and put on the new.|1–3
1TH|鼓励年轻教会在患难中坚立、活出圣洁，并以主再来的盼望彼此安慰。|A young church is encouraged to stand firm, live holy lives, and find comfort in the Lord's return.|1–5
2TH|纠正关于主再来的混乱，鼓励受苦者坚定，并忠实承担日常责任。|Confusion about the Lord's return is addressed with encouragement to persevere and fulfill daily responsibilities.|1–3
1TI|指导提摩太守护教导、安排教会服事，并照顾群体中不同处境的人。|Timothy receives guidance on sound teaching, church service, and care for people in different circumstances.|1–6
2TI|劝勉提摩太在艰难中忠于福音、持守圣经，并把所领受的继续传下去。|Timothy is urged to remain faithful through hardship, hold to Scripture, and pass on what he has received.|1–4
TIT|指导提多设立长老、抵挡错误教导，让恩典结出良善生活的果子。|Titus is guided to appoint elders, resist false teaching, and nurture good lives shaped by grace.|1–3
PHM|保罗为阿尼西谋求情，请腓利门接纳他为亲爱的弟兄，展现福音对关系的改变。|Paul appeals for Onesimus to be received as a beloved brother, showing the gospel's impact on relationships.|1
HEB|说明耶稣是更美之约的中保与大祭司，鼓励疲惫、受压的信徒持守信心。|Jesus is high priest and mediator of a better covenant; weary believers are urged to persevere in faith.|1–10; 11–13
JAS|强调信心必须活在行动中，具体谈试炼、偏待、言语、财富与祷告。|Faith must take shape in action: trials, favoritism, speech, wealth, and prayer become practical tests.|1–5
1PE|帮助因信仰受苦的人持守盼望，以圣洁、善行与温柔回应周围的人。|Those suffering for their faith are encouraged to hold hope and respond with holiness, goodness, and gentleness.|1–5
2PE|警告假教师，呼吁信徒在认识基督上成长，并耐心等候神的应许。|Warnings about false teachers accompany a call to grow in knowing Christ and patiently await God's promise.|1–3
1JN|围绕耶稣的真实身份、顺服与彼此相爱，帮助信徒辨认真理并确知生命。|Jesus' true identity, obedience, and mutual love help believers discern truth and know they have life.|1–5
2JN|劝勉信徒在真理与爱中生活，并谨慎对待否认基督的教导。|Believers are urged to walk in truth and love and reject teaching that denies Christ.|1
3JN|借接待与拒绝接待的对比，鼓励支持忠实传道者，效法善行。|Contrasting hospitality and rejection encourage support for faithful messengers and imitation of good.|1
JUD|警告把恩典当作放纵借口的人，呼吁守护信仰、彼此怜悯并倚靠神。|Warnings against abusing grace call believers to guard their faith, show mercy, and rely on God.|1
REV|借写给教会的书信与异象，呼召忠于基督，并以审判和新创造带来盼望。|Letters and visions call churches to faithfulness to Christ, with judgment and new creation grounding hope.|1–3; 4–5; 21–22
    """.trimIndent().lines().associate { line ->
        val fields = line.split('|')
        fields[0] to BibleBookIntroduction(fields[1], fields[2], fields[3])
    }

    fun get(bookId: String): BibleBookIntroduction = requireNotNull(entries[bookId]) { "Missing introduction: $bookId" }
}
