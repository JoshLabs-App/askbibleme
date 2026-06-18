export type HistoricalCreedGroup = "ecumenical" | "reformation" | "catechism" | "modern";

export type HistoricalCreedItem = {
  id: string;
  group: HistoricalCreedGroup;
  orderLabel: string;
  yearLabel: string;
  yearLabelLeft?: string;
  titleZh: string;
  titleZhTw: string;
  titleEn: string;
  significanceZh: string;
  significanceZhTw: string;
  significanceEn: string;
  problemAddressedZh: string;
  problemAddressedZhTw: string;
  problemAddressedEn: string;
};

export const HISTORICAL_CREED_GROUP_ORDER: HistoricalCreedGroup[] = [
  "ecumenical",
  "reformation",
  "catechism",
  "modern",
];

/** 普世大公信经「三信经」：使徒、尼西亚、迦克墩。 */
export const CORE_ECUMENICAL_CREED_IDS = [
  "apostles-creed",
  "nicene-creed",
  "chalcedonian-definition",
] as const;

export type CoreEcumenicalCreedId = (typeof CORE_ECUMENICAL_CREED_IDS)[number];

export function isCoreEcumenicalCreed(id: string): id is CoreEcumenicalCreedId {
  return (CORE_ECUMENICAL_CREED_IDS as readonly string[]).includes(id);
}

export const HISTORICAL_CREEDS: HistoricalCreedItem[] = [
  {
    id: "apostles-creed",
    group: "ecumenical",
    orderLabel: "01",
    yearLabel: "约 2–4 世纪",
    yearLabelLeft: "2–4 世纪",
    titleZh: "使徒信经",
    titleZhTw: "使徒信經",
    titleEn: "Apostles' Creed",
    significanceZh:
      "西方教会洗礼与崇拜中最常用的信仰摘要，按救恩历史叙述父、子、圣灵，以及教会、复活与永生。帮助信徒用简短、统一的语言确认所信。",
    significanceZhTw:
      "西方教會洗禮與崇拜中最常用的信仰摘要，按救恩歷史敘述父、子、聖靈，以及教會、復活與永生。幫助信徒用簡短、統一的語言確認所信。",
    significanceEn:
      "The most widely used Western summary of faith in baptism and worship. It walks through Father, Son, and Spirit, the church, resurrection, and eternal life in salvation history.",
    problemAddressedZh:
      "早期教会需要让初信者与慕道友用同一套语言明白福音核心，避免各人自行拼凑、彼此不能相通。",
    problemAddressedZhTw:
      "早期教會需要讓初信者與慕道友用同一套語言明白福音核心，避免各人自行拼湊、彼此不能相通。",
    problemAddressedEn:
      "The early church needed one shared language for new believers, so the gospel core was not left to private improvisation.",
  },
  {
    id: "nicene-creed",
    group: "ecumenical",
    orderLabel: "02",
    yearLabel: "325–381",
    yearLabelLeft: "325–381",
    titleZh: "尼西亚信经",
    titleZhTw: "尼西亞信經",
    titleEn: "Nicene Creed",
    significanceZh:
      "大公教会共同承认的信仰宣言，明确圣父、圣子、圣灵的神性，以及基督道成肉身、受死复活。东正教、天主教与主流新教礼仪中仍共同使用。",
    significanceZhTw:
      "大公教會共同承認的信仰宣言，明確聖父、聖子、聖靈的神性，以及基督道成肉身、受死復活。東正教、天主教與主流新教禮儀中仍共同使用。",
    significanceEn:
      "An ecumenical confession of Father, Son, and Holy Spirit, Christ's incarnation, death, and resurrection—still shared across Orthodox, Catholic, and mainstream Protestant worship.",
    problemAddressedZh:
      "回应亚流派等异端，当教会争论「圣子是否与父同质」时，需要清楚界定基督的神性与人性的根基。",
    problemAddressedZhTw:
      "回應亞流派等異端，當教會爭論「聖子是否與父同質」時，需要清楚界定基督的神性與人性的根基。",
    problemAddressedEn:
      "It answered Arianism and similar teaching by defining that the Son is of the same substance as the Father.",
  },
  {
    id: "chalcedonian-definition",
    group: "ecumenical",
    orderLabel: "03",
    yearLabel: "451",
    yearLabelLeft: "451",
    titleZh: "迦克墩定义",
    titleZhTw: "迦克墩定義",
    titleEn: "Chalcedonian Definition",
    significanceZh:
      "界定基督是一位位格、二性：完全的神性与完全的人性，不相混、不相换、不相分、不相离。成为后世讨论基督论的重要准绳。",
    significanceZhTw:
      "界定基督是一位位格、二性：完全的神性與完全的人性，不相混、不相換、不相分、不相離。成為後世討論基督論的重要準繩。",
    significanceEn:
      "Confesses one person in two natures—fully God and fully human—without confusion, change, division, or separation.",
    problemAddressedZh:
      "回应基督是「只神」「只人」或二性混乱等教导，防止救恩根基被削弱或基督的真实人性被否定。",
    problemAddressedZhTw:
      "回應基督是「只神」「只人」或二性混亂等教導，防止救恩根基被削弱或基督的真實人性被否定。",
    problemAddressedEn:
      "It answered teachings that made Christ only divine, only human, or a confused mixture—protecting both the incarnation and salvation.",
  },
  {
    id: "athanasian-creed",
    group: "ecumenical",
    orderLabel: "04",
    yearLabel: "约 5–6 世纪",
    yearLabelLeft: "5–6 世纪",
    titleZh: "亚他那修信经",
    titleZhTw: "亞他那修信經",
    titleEn: "Athanasian Creed",
    significanceZh:
      "以严密语言阐述三位一体与基督一位二性，强调真实敬拜必须以正确的信仰为根基。西方教会虽较少在礼仪中朗诵，神学地位却十分重要。",
    significanceZhTw:
      "以嚴密語言闡述三位一體與基督一位二性，強調真實敬拜必須以正確的信仰為根基。西方教會雖較少在禮儀中朗誦，神學地位卻十分重要。",
    significanceEn:
      "A precise Western statement on the Trinity and Christ's two natures, insisting that true worship rests on true faith.",
    problemAddressedZh:
      "当信仰用语趋于模糊时，教会需要更严密的表述，守住三一与基督论的边界，避免敬拜对象被稀释。",
    problemAddressedZhTw:
      "當信仰用語趨於模糊時，教會需要更嚴密的表述，守住三一與基督論的邊界，避免敬拜對象被稀釋。",
    problemAddressedEn:
      "When language about God grew vague, the church needed tighter boundaries around the Trinity and Christology.",
  },
  {
    id: "heidelberg-catechism",
    group: "reformation",
    orderLabel: "05",
    yearLabel: "1563",
    yearLabelLeft: "1563",
    titleZh: "海德堡要理问答",
    titleZhTw: "海德堡要理問答",
    titleEn: "Heidelberg Catechism",
    significanceZh:
      "改革宗要理问答，以「你的安慰」起首，将罪、恩典与感恩三部分串联，帮助家庭与教会逐周教导信仰。",
    significanceZhTw:
      "改革宗要理問答，以「你的安慰」起首，將罪、恩典與感恩三部分串聯，幫助家庭與教會逐週教導信仰。",
    significanceEn:
      "A Reformed catechism opening with comfort in Christ, teaching guilt, grace, and gratitude for home and church instruction.",
    problemAddressedZh:
      "改教地区需要可教导的信仰框架，让牧者与家长用问答方式把救恩与感恩生活讲清楚，而不只停留在争论。",
    problemAddressedZhTw:
      "改教地區需要可教導的信仰框架，讓牧者與家長用問答方式把救恩與感恩生活講清楚，而不只停留在爭論。",
    problemAddressedEn:
      "Reformed regions needed teachable faith—question and answer that moved from guilt to grace to gratitude.",
  },
  {
    id: "westminster-shorter-catechism",
    group: "catechism",
    orderLabel: "06",
    yearLabel: "1647",
    yearLabelLeft: "1647",
    titleZh: "威斯敏斯特小要理问答",
    titleZhTw: "威斯敏斯特小要理問答",
    titleEn: "Westminster Shorter Catechism",
    significanceZh:
      "107 问简短要理，首问「人生的首要目的是什么？」——荣耀神，并以他为乐。适合主日学、家庭崇拜与入门教导。",
    significanceZhTw:
      "107 問簡短要理，首問「人生的首要目的是什麼？」——榮耀神，並以他為樂。適合主日學、家庭崇拜與入門教導。",
    significanceEn:
      "107 brief questions, opening with life's chief end—to glorify God and enjoy him forever—for catechesis at home and church.",
    problemAddressedZh:
      "信仰告白篇幅宏大，普通信徒与儿童需要更短、可背诵的版本，把核心真理带进日常生活。",
    problemAddressedZhTw:
      "信仰告白篇幅宏大，普通信徒與兒童需要更短、可背誦的版本，把核心真理帶進日常生活。",
    problemAddressedEn:
      "The full confession was too long for daily life; believers and children needed a memorizable core.",
  },
  {
    id: "westminster-larger-catechism",
    group: "catechism",
    orderLabel: "07",
    yearLabel: "1648",
    yearLabelLeft: "1648",
    titleZh: "威斯敏斯特大要理问答",
    titleZhTw: "威斯敏斯特大要理問答",
    titleEn: "Westminster Larger Catechism",
    significanceZh:
      "196 问详尽要理，在小要理基础上展开圣经教义与基督徒生活细节，供牧者讲道、教导与查经参考。",
    significanceZhTw:
      "196 問詳盡要理，在小要理基礎上展開聖經教義與基督徒生活細節，供牧者講道、教導與查經參考。",
    significanceEn:
      "196 questions expanding the Shorter Catechism for preaching, teaching, and deeper study.",
    problemAddressedZh:
      "教会需要比小要理更完整、仍保持问答形式的教导材料，帮助牧者系统讲解信仰与生活应用。",
    problemAddressedZhTw:
      "教會需要比小要理更完整、仍保持問答形式的教導材料，幫助牧者系統講解信仰與生活應用。",
    problemAddressedEn:
      "Pastors needed a fuller question-and-answer resource than the Shorter Catechism for systematic instruction.",
  },
  {
    id: "chicago-inerrancy",
    group: "modern",
    orderLabel: "08",
    yearLabel: "1978",
    yearLabelLeft: "1978",
    titleZh: "芝加哥圣经无误宣言",
    titleZhTw: "芝加哥聖經無誤宣言",
    titleEn: "Chicago Statement on Biblical Inerrancy",
    significanceZh:
      "阐述圣经完全默示、无误与权威，区分无误与现代字句批判所能回答的问题；与 1982 年《芝加哥圣经解释宣言》配对，前者论「圣经是否无误」，后者论「如何解释圣经」。",
    significanceZhTw:
      "闡述聖經完全默示、無誤與權威，區分無誤與現代字句批判所能回答的問題；與 1982 年《芝加哥聖經解釋宣言》配對，前者論「聖經是否無誤」，後者論「如何解釋聖經」。",
    significanceEn:
      "Articulates full inspiration, inerrancy, and authority of Scripture; paired with the 1982 Hermeneutics Statement—inerrancy first, then how to interpret faithfully.",
    problemAddressedZh:
      "当历史批判与自由主义神学质疑圣经可靠性时，教会需要清楚说明：仍愿全然倚靠神话语的真实与权威。",
    problemAddressedZhTw:
      "當歷史批判與自由主義神學質疑聖經可靠性時，教會需要清楚說明：仍願全然倚靠神話語的真實與權威。",
    problemAddressedEn:
      "As historical criticism and liberal theology challenged Scripture's reliability, evangelicals needed a clear commitment to its truth and authority.",
  },
  {
    id: "chicago-hermeneutics",
    group: "modern",
    orderLabel: "09",
    yearLabel: "1982",
    yearLabelLeft: "1982",
    titleZh: "芝加哥圣经解释宣言",
    titleZhTw: "芝加哥聖經解釋宣言",
    titleEn: "Chicago Statement on Biblical Hermeneutics",
    significanceZh:
      "在 1978 无误宣言之后，专门阐明释经原则：基督中心、文法—历史解经、文学体裁、字面意义，以及圣经内外真理的一致，防止把无误变成空洞口号。",
    significanceZhTw:
      "在 1978 無誤宣言之後，專門闡明釋經原則：基督中心、文法—歷史解經、文學體裁、字面意義，以及聖經內外真理的一致，防止把無誤變成空洞口號。",
    significanceEn:
      "Following the 1978 Inerrancy Statement, this sets hermeneutical principles—Christ-centered, grammatical-historical, literary genre, and literal sense—so inerrancy is not an empty slogan.",
    problemAddressedZh:
      "有人承认圣经无误，却在解释上任意相对化或迁就文化；教会需要说明：无误的圣经应当怎样被读懂、讲明并遵行。",
    problemAddressedZhTw:
      "有人承認聖經無誤，卻在解釋上任意相對化或遷就文化；教會需要說明：無誤的聖經應當怎樣被讀懂、講明並遵行。",
    problemAddressedEn:
      "Some affirmed inerrancy yet relativized interpretation; the church needed clear principles for reading and preaching Scripture faithfully.",
  },
];

export const HISTORICAL_CREEDS_BOTTOM_PAD = 140;
