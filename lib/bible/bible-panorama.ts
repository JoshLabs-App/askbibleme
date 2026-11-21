import { scriptureBooks } from "@/lib/bible/scripture-books";

export type PanoramaSpan = {
  bookId: string;
  first: number;
  last: number;
};

export type PanoramaSection = {
  id: string;
  zh: string;
  en: string;
  summaryZh: string;
  summaryEn: string;
  spans: PanoramaSpan[];
};

export type PanoramaAct = {
  zh: string;
  en: string;
  subtitleZh: string;
  subtitleEn: string;
  sections: PanoramaSection[];
};

export type PanoramaReadingLink = {
  bookId: string;
  chapter: number;
  verses: string;
  kindZh: string;
  kindEn: string;
  reasonZh: string;
  reasonEn: string;
};

export type PanoramaReadingNote = {
  zh: string;
  en: string;
  links: PanoramaReadingLink[];
};

const chaptersById = new Map(scriptureBooks.map((b) => [b.bookId, b.chapters]));

function span(bookId: string, first = 1, last = chaptersById.get(bookId) ?? 1): PanoramaSpan {
  return { bookId, first, last };
}

function books(...ids: string[]): PanoramaSpan[] {
  return ids.map((id) => span(id));
}

const epistleSpans: PanoramaSpan[] = scriptureBooks
  .filter((b) => b.bookNumber >= 45 && b.bookNumber <= 65)
  .map((b) => span(b.bookId));

/** 六幕救赎历史灵修导览（与 iOS / Android BiblePanorama 对齐） */
export const BIBLE_PANORAMA_ACTS: PanoramaAct[] = [
  {
    zh: "创造",
    en: "Creation",
    subtitleZh: "美好的开始",
    subtitleEn: "A good beginning",
    sections: [
      {
        id: "creation",
        zh: "天地与人",
        en: "The world and humanity",
        summaryZh: "神创造天地，人受托照管受造世界。",
        summaryEn: "God creates the world and entrusts humanity with its care.",
        spans: [span("GEN", 1, 2)],
      },
    ],
  },
  {
    zh: "堕落",
    en: "The fall",
    subtitleZh: "世界的破裂",
    subtitleEn: "A fractured world",
    sections: [
      {
        id: "fall",
        zh: "从伊甸园到巴别",
        en: "From Eden to Babel",
        summaryZh: "人的背离带来破裂与死亡；审判与保守交织。",
        summaryEn: "Human rebellion brings rupture and death; judgment and preservation intertwine.",
        spans: [span("GEN", 3, 11)],
      },
    ],
  },
  {
    zh: "以色列",
    en: "Israel",
    subtitleZh: "应许中的百姓",
    subtitleEn: "A people and a promise",
    sections: [
      {
        id: "ancestors",
        zh: "先祖与应许",
        en: "Ancestors and promise",
        summaryZh: "亚伯拉罕蒙召；一家人的故事走向埃及，万族得福的应许贯穿其中（创12:1–3）。",
        summaryEn: "Abraham is called; his family's story leads to Egypt, carrying a promise of blessing for all peoples (Gen 12:1–3).",
        spans: [span("GEN", 12, 50)],
      },
      {
        id: "exodus",
        zh: "出埃及与立约",
        en: "Exodus and covenant",
        summaryZh: "百姓离开奴役，在西奈立约，学习敬拜与生活（出19–20）。利未记连接这一处境。",
        summaryEn: "Freed from slavery, the people enter a covenant at Sinai and learn worship and life (Exod 19–20).",
        spans: books("EXO", "LEV"),
      },
      {
        id: "wilderness",
        zh: "旷野",
        en: "Wilderness",
        summaryZh: "一代人经历旷野，下一代准备进入土地（民13–14；申1）。",
        summaryEn: "One generation journeys through the wilderness; another prepares to enter the land (Num 13–14; Deut 1).",
        spans: books("NUM", "DEU"),
      },
      {
        id: "land",
        zh: "进入土地",
        en: "Entering the land",
        summaryZh: "过约旦河、争战、分配土地，重申对神的忠诚（书3；24）。",
        summaryEn: "Crossing the Jordan, allocation of land, and renewed allegiance to God (Josh 3; 24).",
        spans: books("JOS"),
      },
      {
        id: "judges",
        zh: "士师时期",
        en: "The judges",
        summaryZh: "士师记呈现反复失信与蒙拯救。路得记将家庭故事放在这一时期；书末家谱连接到大卫。",
        summaryEn: "Judges recounts repeated unfaithfulness and deliverance; Ruth's family story leads to David.",
        spans: books("JDG", "RUT"),
      },
      {
        id: "kingdom",
        zh: "王国兴起",
        en: "The kingdom rises",
        summaryZh: "扫罗、大卫与所罗门：王权兴起、圣殿建立，大卫家室的应许成为路标（撒下7）。",
        summaryEn: "Saul, David, and Solomon: kingship, the temple, and the promise to David's house (2 Sam 7).",
        spans: [span("1SA"), span("2SA"), span("1KI", 1, 11), span("1CH"), span("2CH", 1, 9)],
      },
      {
        id: "divided",
        zh: "王国分裂",
        en: "A divided kingdom",
        summaryZh: "以色列与犹大两国并行，君王与百姓面对先知的警告与盼望（王上12）。",
        summaryEn: "Israel and Judah divide; prophets confront kings and people with warning and hope.",
        spans: [span("1KI", 12, 22), span("2KI", 1, 16), span("2CH", 10, 35)],
      },
      {
        id: "exile",
        zh: "亡国与被掳",
        en: "Defeat and exile",
        summaryZh: "北国覆亡，后来耶路撒冷被毁。哀歌表达悲痛；以西结书和但以理书连接被掳处境。",
        summaryEn: "Jerusalem falls; Lamentations voices grief while Ezekiel and Daniel speak in exile.",
        spans: [span("2KI", 17, 25), span("2CH", 36, 36), ...books("LAM", "EZK", "DAN")],
      },
      {
        id: "return",
        zh: "归回与重建",
        en: "Return and rebuilding",
        summaryZh: "部分百姓归回，重建圣殿与城墙；以斯帖记呈现留在波斯的犹太群体。",
        summaryEn: "Some return to rebuild temple and walls; Esther portrays Jews remaining in Persia.",
        spans: books("EZR", "NEH", "EST", "HAG", "ZEC", "MAL"),
      },
      {
        id: "wisdom",
        zh: "诗歌与智慧",
        en: "Poetry and wisdom",
        summaryZh: "祷告、痛苦、爱与生活智慧。这些书卷跨越处境，陪伴人在故事中呼求与思想。",
        summaryEn: "Prayer, suffering, love, and wisdom for life across contexts.",
        spans: books("JOB", "PSA", "PRO", "ECC", "SNG"),
      },
      {
        id: "prophets",
        zh: "先知的声音",
        en: "Prophetic voices",
        summaryZh: "在不同处境中指出失信、呼召悔改、宣告盼望。",
        summaryEn: "Prophets confront unfaithfulness, call for repentance, and proclaim hope.",
        spans: books("ISA", "JER", "HOS", "JOL", "AMO", "OBA", "JON", "MIC", "NAM", "HAB", "ZEP"),
      },
    ],
  },
  {
    zh: "耶稣基督",
    en: "Jesus Christ",
    subtitleZh: "故事的中心",
    subtitleEn: "The center of the story",
    sections: [
      {
        id: "jesus",
        zh: "四福音的见证",
        en: "Four Gospel witnesses",
        summaryZh: "四卷福音从各自角度见证耶稣的生活、教导、受死与复活。",
        summaryEn: "Four Gospels witness to Jesus' life, teaching, death, and resurrection.",
        spans: books("MAT", "MRK", "LUK", "JHN"),
      },
    ],
  },
  {
    zh: "教会的使命",
    en: "The church's mission",
    subtitleZh: "福音传向万民",
    subtitleEn: "Good news for all peoples",
    sections: [
      {
        id: "mission",
        zh: "从耶路撒冷向外",
        en: "Outward from Jerusalem",
        summaryZh: "圣灵降临，门徒作见证，福音跨越地域与族群（徒1:8；2）。",
        summaryEn: "The Spirit comes; witnesses carry the gospel across places and peoples (Acts 1:8).",
        spans: books("ACT"),
      },
      {
        id: "letters",
        zh: "教会的信仰与生活",
        en: "Faith and life together",
        summaryZh: "书信回应具体群体与个人，教导信仰、生活与盼望；可结合使徒行传阅读。",
        summaryEn: "Letters address communities and individuals, teaching faith, life, and hope.",
        spans: epistleSpans,
      },
      {
        id: "witness",
        zh: "苦难中的见证与盼望",
        en: "Witness and hope",
        summaryZh: "启示录首先写给现实中的教会（启1–3），通过异象带来劝勉与盼望。",
        summaryEn: "Revelation addresses real churches (Rev 1–3), offering exhortation and hope.",
        spans: books("REV"),
      },
    ],
  },
  {
    zh: "新创造",
    en: "New creation",
    subtitleZh: "万物更新的盼望",
    subtitleEn: "The hope of renewal",
    sections: [
      {
        id: "renewal",
        zh: "神与人同在",
        en: "God with humanity",
        summaryZh: "新天新地、生命树、神与人同在（启21–22）。这里呈现终点的盼望。",
        summaryEn: "New heaven and earth, the tree of life, and God with humanity (Rev 21–22).",
        spans: [span("REV", 21, 22)],
      },
    ],
  },
];

export const PANORAMA_READING_GUIDE: Record<string, PanoramaReadingNote> = {
  creation: {
    zh: "创造呈现美好的关系；接下来，人的背离使人与神、人与人、人与土地的关系破裂。",
    en: "Creation presents good relationships; human rebellion then fractures relationships with God, one another, and the ground.",
    links: [],
  },
  fall: {
    zh: "该隐、家谱中的死亡、洪水与巴别接续展现人的困境。故事随后转向神呼召亚伯拉罕，开启应许的道路。",
    en: "Cain, the flood, and Babel unfold humanity's plight. The story then turns to God's call of Abraham.",
    links: [],
  },
  ancestors: {
    zh: "百姓、土地、万民得福，是阅读这一段的三个线索。家族迁往埃及，把先祖的故事连接到出埃及。",
    en: "People, land, and blessing for all peoples are three reading threads.",
    links: [
      {
        bookId: "GEN",
        chapter: 12,
        verses: "1–3",
        kindZh: "关键经文",
        kindEn: "Key passage",
        reasonZh: "神呼召亚伯兰，应许使地上的万族因他得福。",
        reasonEn: "God calls Abram and promises blessing for all families of the earth through him.",
      },
      {
        bookId: "GAL",
        chapter: 3,
        verses: "8–9",
        kindZh: "新约引用",
        kindEn: "NT reference",
        reasonZh: "保罗引用万国得福的应许，阐述信心与福音的关系。",
        reasonEn: "Paul cites the promise of blessing for the nations.",
      },
    ],
  },
  wilderness: {
    zh: "民数记连接两代人；申命记向将进入土地的新一代重申约。",
    en: "Numbers connects two generations; Deuteronomy renews the covenant.",
    links: [
      {
        bookId: "DEU",
        chapter: 28,
        verses: "",
        kindZh: "关键经文",
        kindEn: "Key passage",
        reasonZh: "守约的祝福与背约的警戒，为阅读以色列此后的历史提供背景。",
        reasonEn: "Covenant blessings and warnings frame Israel's subsequent history.",
      },
    ],
  },
  judges: {
    zh: "失信 → 受压迫 → 呼求 → 蒙拯救；路得的家庭故事则把士师时期连接到大卫。",
    en: "Ruth's family story links the era of the judges to David.",
    links: [
      {
        bookId: "RUT",
        chapter: 4,
        verses: "17–22",
        kindZh: "经文连接",
        kindEn: "Textual link",
        reasonZh: "书末家谱从路得的家庭延伸到大卫，连接到王国历史。",
        reasonEn: "The closing genealogy leads from Ruth's family to David.",
      },
    ],
  },
  kingdom: {
    zh: "大卫家室的应许，使王国的盼望超越眼前的一位君王。",
    en: "The promise to David's house carries hope beyond any one reigning king.",
    links: [
      {
        bookId: "2SA",
        chapter: 7,
        verses: "12–16",
        kindZh: "关键经文",
        kindEn: "Key passage",
        reasonZh: "神应许大卫的后裔、家室与王位。",
        reasonEn: "God promises David an offspring, a house, and an enduring throne.",
      },
      {
        bookId: "LUK",
        chapter: 1,
        verses: "32–33",
        kindZh: "经文关联",
        kindEn: "Biblical link",
        reasonZh: "关于耶稣的宣告提到大卫的宝座和没有穷尽的国。",
        reasonEn: "The announcement about Jesus names David's throne and a kingdom without end.",
      },
    ],
  },
  jesus: {
    zh: "耶稣受死、复活，门徒随后受托作见证。路加福音与使徒行传清楚地连接这段转折。",
    en: "Jesus dies and rises, and his followers are commissioned as witnesses.",
    links: [
      {
        bookId: "ACT",
        chapter: 1,
        verses: "1–8",
        kindZh: "叙事衔接",
        kindEn: "Continuation",
        reasonZh: "记述复活后的耶稣，并展开圣灵赐能力、门徒作见证的使命。",
        reasonEn: "Describes the risen Jesus and unfolds the Spirit-empowered mission.",
      },
    ],
  },
  renewal: {
    zh: "从创造中的园，到生命与同在的更新，可以回看整条故事。",
    en: "From the garden in creation to renewed life and presence, look back across the whole story.",
    links: [
      {
        bookId: "GEN",
        chapter: 2,
        verses: "9–10",
        kindZh: "主题呼应",
        kindEn: "Correspondence",
        reasonZh: "创世记中的生命树与河流，可与启示录22章的生命树和生命水一同阅读。",
        reasonEn: "The tree of life and river in Genesis correspond with Revelation 22.",
      },
      {
        bookId: "REV",
        chapter: 22,
        verses: "1–5",
        kindZh: "主题呼应",
        kindEn: "Correspondence",
        reasonZh: "生命水、生命树与神的同在，呈现故事终点的盼望。",
        reasonEn: "The water of life, tree of life, and God's presence portray concluding hope.",
      },
    ],
  },
};

export function findPanoramaLocation(
  bookId: string,
  chapter: number,
): { actIndex: number; section: PanoramaSection } | null {
  const bid = bookId.toUpperCase();
  const order = bid === "REV" && chapter >= 21 ? [5, 4] : BIBLE_PANORAMA_ACTS.map((_, i) => i);
  for (const actIndex of order) {
    const act = BIBLE_PANORAMA_ACTS[actIndex];
    if (!act) continue;
    for (const section of act.sections) {
      if (section.spans.some((s) => s.bookId === bid && chapter >= s.first && chapter <= s.last)) {
        return { actIndex, section };
      }
    }
  }
  return null;
}
