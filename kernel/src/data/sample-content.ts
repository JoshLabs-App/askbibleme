export interface PanoramaActItem {
  id: string;
  title: string;
  subtitle: string;
  summary: string;
  readings: Array<{ bookId: string; chapter: number; label: string }>;
}

export const PANORAMA_ACTS: PanoramaActItem[] = [
  {
    id: "creation",
    title: "第一幕 · 创造",
    subtitle: "美好的起初",
    summary: "神创造天地万物，人按神的形像受造并受托照管受造世界。",
    readings: [
      { bookId: "GEN", chapter: 1, label: "创世记 1" },
      { bookId: "PSA", chapter: 19, label: "诗篇 19" },
    ],
  },
  {
    id: "fall",
    title: "第二幕 · 堕落",
    subtitle: "世界的破裂",
    summary: "人与神之间的关系破裂，罪与死亡进入世界，却仍有起初的应许。",
    readings: [
      { bookId: "GEN", chapter: 3, label: "创世记 3" },
      { bookId: "ROM", chapter: 3, label: "罗马书 3" },
    ],
  },
  {
    id: "covenant",
    title: "第三幕 · 立约与以色列",
    subtitle: "在等候中预备道路",
    summary: "从亚伯拉罕之约、出埃及到大卫国度，神在历史中持守信实。",
    readings: [
      { bookId: "GEN", chapter: 12, label: "创世记 12" },
      { bookId: "EXO", chapter: 19, label: "出埃及记 19" },
      { bookId: "ISA", chapter: 53, label: "以赛亚书 53" },
    ],
  },
  {
    id: "christ",
    title: "第四幕 · 基督道成肉身",
    subtitle: "道成了肉身，住在我们中间",
    summary: "耶稣基督的降生、教导、受难与复活，成全律法与先知的应许。",
    readings: [
      { bookId: "JHN", chapter: 1, label: "约翰福音 1" },
      { bookId: "LUK", chapter: 15, label: "路加福音 15" },
      { bookId: "JHN", chapter: 19, label: "约翰福音 19" },
    ],
  },
  {
    id: "church",
    title: "第五幕 · 教会与书信",
    subtitle: "在圣灵里同行",
    summary: "圣灵降临，门徒走入万邦，在书信与日常中活出基督的平安。",
    readings: [
      { bookId: "ACT", chapter: 2, label: "使徒行传 2" },
      { bookId: "ROM", chapter: 8, label: "罗马书 8" },
      { bookId: "EPH", chapter: 2, label: "以弗所书 2" },
    ],
  },
  {
    id: "new-creation",
    title: "第六幕 · 新天新地",
    subtitle: "一切都将更新",
    summary: "眼泪被擦去，神与人永远同住，受造界进入最终的安息。",
    readings: [
      { bookId: "REV", chapter: 21, label: "启示录 21" },
      { bookId: "REV", chapter: 22, label: "启示录 22" },
    ],
  },
];

export interface ReadingPlanItem {
  id: string;
  title: string;
  durationDays: number;
  summary: string;
  todayEntries: Array<{ id: string; label: string; bookId: string; chapter: number }>;
}

export const READING_PLANS: ReadingPlanItem[] = [
  {
    id: "quiet-gospel",
    title: "静读约翰福音 · 21 天",
    durationDays: 21,
    summary: "每日一章，跟随门徒约翰的笔触安静认识道成肉身的基督。",
    todayEntries: [
      { id: "jg-1", label: "第 1 日 · 太初有道（约 1）", bookId: "JHN", chapter: 1 },
      { id: "jg-2", label: "第 2 日 · 迦拿婚宴（约 2）", bookId: "JHN", chapter: 2 },
      { id: "jg-3", label: "第 3 日 · 重生与神爱（约 3）", bookId: "JHN", chapter: 3 },
    ],
  },
  {
    id: "morning-psalms",
    title: "清晨诗篇祈祷 · 30 天",
    durationDays: 30,
    summary: "以诗篇开启清晨十分钟，把祷告与安息带进日常。",
    todayEntries: [
      { id: "mp-1", label: "诗篇 1 · 昼夜思想", bookId: "PSA", chapter: 1 },
      { id: "mp-2", label: "诗篇 23 · 耶和华是我的牧者", bookId: "PSA", chapter: 23 },
      { id: "mp-3", label: "诗篇 121 · 我要向山举目", bookId: "PSA", chapter: 121 },
    ],
  },
];

export interface FigureIndexItem {
  id: string;
  name: string;
  testament: "old" | "new";
  era: string;
  summary: string;
  refs: Array<{ label: string; bookId: string; chapter: number }>;
}

export const BIBLE_FIGURES: FigureIndexItem[] = [
  {
    id: "abraham",
    name: "亚伯拉罕",
    testament: "old",
    era: "族长时期",
    summary: "蒙召离开本地本族，因信顺服神应许的信心之父。",
    refs: [
      { label: "创世记 12 · 蒙召出吾珥", bookId: "GEN", chapter: 12 },
      { label: "创世记 22 · 摩利亚山的信靠", bookId: "GEN", chapter: 22 },
    ],
  },
  {
    id: "moses",
    name: "摩西",
    testament: "old",
    era: "出埃及与旷野",
    summary: "受差遣领以色列人出埃及、在西奈山领受律法的仆人。",
    refs: [
      { label: "出埃及记 3 · 荆棘火焰", bookId: "EXO", chapter: 3 },
      { label: "申命记 34 · 尼波山眺望", bookId: "DEU", chapter: 34 },
    ],
  },
  {
    id: "ruth",
    name: "路得",
    testament: "old",
    era: "士师时期",
    summary: "在荒年与离散中持守忠信与慈爱的摩押女子，进入大卫的谱系。",
    refs: [
      { label: "路得记 1 · 你的神就是我的神", bookId: "RUT", chapter: 1 },
      { label: "路得记 4 · 伯利恒的救赎", bookId: "RUT", chapter: 4 },
    ],
  },
  {
    id: "david",
    name: "大卫",
    testament: "old",
    era: "联合王国",
    summary: "牧羊人、诗人、以色列君王，在软弱与悔改中仍被称为合神心意的人。",
    refs: [
      { label: "撒母耳记上 16 · 受膏", bookId: "1SA", chapter: 16 },
      { label: "诗篇 51 · 忧伤痛悔的心", bookId: "PSA", chapter: 51 },
    ],
  },
  {
    id: "mary",
    name: "马利亚（拿撒勒）",
    testament: "new",
    era: "福音书",
    summary: "安静领受天使报信、在尊主颂中宣告神恩典的耶稣母亲。",
    refs: [
      { label: "路加福音 1 · 尊主颂", bookId: "LUK", chapter: 1 },
      { label: "约翰福音 19 · 十字架下", bookId: "JHN", chapter: 19 },
    ],
  },
  {
    id: "peter",
    name: "彼得",
    testament: "new",
    era: "福音书与使徒行传",
    summary: "从打鱼人成为宣讲福音的使徒，跌倒后在加利利海边被主恢复。",
    refs: [
      { label: "马太福音 16 · 认信", bookId: "MAT", chapter: 16 },
      { label: "约翰福音 21 · 你爱我比这些更深吗", bookId: "JHN", chapter: 21 },
    ],
  },
  {
    id: "paul",
    name: "保罗",
    testament: "new",
    era: "使徒行传与书信",
    summary: "大马士革路上蒙光照的使徒，在列邦中见证十字架与复活的福音。",
    refs: [
      { label: "使徒行传 9 · 大马士革路", bookId: "ACT", chapter: 9 },
      { label: "腓立比书 3 · 认识基督为至宝", bookId: "PHP", chapter: 3 },
    ],
  },
];

export interface ExLibrisSeal {
  key: string;
  name: string;
  condition: string;
  unlocked: boolean;
}

export const EX_LIBRIS_SEALS: ExLibrisSeal[] = [
  { key: "m01_first_play", name: "初次翻开", condition: "打开任意一章经文", unlocked: true },
  { key: "m02_first_lesson", name: "读完一章", condition: "完整读完第一章", unlocked: true },
  { key: "m03_daily_goal", name: "今日读经", condition: "完成一天的读经计划", unlocked: false },
  { key: "m04_quiet_week", name: "七日同行", condition: "累计安静读经 7 天", unlocked: false },
  { key: "m05_gospel_seal", name: "四福音印记", condition: "翻阅任意一部福音书", unlocked: true },
  { key: "m06_psalms_seal", name: "诗篇清晨", condition: "收藏或聆听一首诗篇", unlocked: false },
];
