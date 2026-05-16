/**
 * 与桌面项目 `BIBLE/tag-wall.html` 一致：子标签归类到「入口桶」，
 * 以及「复合标签」下的二级分组（仅用于后台浏览展示）。
 */

export type ReaderThemeFlatRow = {
  key: string;
  categoryId: number;
  categoryName: string;
  categoryPosition: number;
  name: string;
  displayName: string;
  /** 原数据页标题（如「58 鼓励某人的圣经经文」） */
  title?: string;
  position: number;
  verseCount: number;
  bucket: string;
};

export function canonicalLabel(text: string): string {
  const value = String(text ?? "").trim();
  const map = new Map<string, string>([
    ["开心点", "放松"],
    ["部委", "事工"],
    ["邀请函", "邀请"],
    ["守夜", "夜守"],
    ["祈祷-2", "祷告"],
    ["要祷告", "祷告"],
    ["气息", "生命气息"],
    ["水果", "结果子"],
    ["照顾身体如寺庙", "照顾身体如圣殿"],
  ]);
  return map.get(value) || value;
}

export function classifyReaderThemeBucket(row: { name: string; categoryName: string; displayName: string }): string {
  const name = canonicalLabel(row.displayName || row.name);
  const category = canonicalLabel(row.categoryName);
  const text = `${name} ${category}`.toLowerCase();

  const worshipTerms = ["敬拜", "赞美", "感恩", "称颂", "颂扬", "歌颂", "敬拜上帝"];
  const godTerms = ["上帝", "耶稣", "圣灵", "救恩", "恩典", "永生", "公义", "同在", "圣洁", "三位一体"];
  const responseTerms = ["悔改", "回转", "信心", "顺服", "盼望", "相信", "回应", "归回"];
  const restTerms = ["放松", "平静", "安静", "休息", "睡眠", "睡", "安息", "静默", "宁静"];
  const healingTerms = ["疾病", "医治", "恢复", "力量", "平安", "治愈", "痊愈"];
  const relationTerms = [
    "自己",
    "家人",
    "孩子",
    "朋友",
    "婚姻",
    "父母",
    "丈夫",
    "妻子",
    "兄弟",
    "姊妹",
    "新人",
    "病人",
    "学生",
  ];
  const workStudyTerms = ["工作", "职场", "学业", "学习", "成长", "责任", "考试", "决定"];
  const missionTerms = ["传福音", "服事", "引导", "方向", "呼召", "牧养", "门徒", "教会", "领袖"];
  const situationTerms = [
    "旷野",
    "沙漠",
    "荒地",
    "压力",
    "失去",
    "冲突",
    "选择",
    "金钱",
    "生活",
    "怀孕",
    "育儿",
    "失业",
    "痛苦",
    "忧伤",
    "困难",
    "灾害",
    "迫害",
    "风暴",
    "危机",
    "苦难",
    "焦虑",
    "绝望",
    "孤独",
  ];
  const compositeTerms = [
    "需要的时候",
    "生命",
    "神的保护",
    "神是我们的磐石",
    "安全与信任",
    "正义",
    "友谊",
    "爱情",
    "生日",
    "学会",
    "品格",
    "家庭祝福",
    "婚姻和睦",
    "果子",
    "光",
    "树",
    "路",
    "羊",
    "火",
    "气息",
  ];

  const includesAny = (terms: string[]) => terms.some((term) => text.includes(term));

  if (includesAny(worshipTerms)) return "敬拜与赞美";
  if (includesAny(godTerms)) return "神是谁";
  if (includesAny(responseTerms)) return "人的回应";
  if (includesAny(restTerms)) return "安静与睡眠";
  if (includesAny(healingTerms)) return "生命与医治";
  if (includesAny(relationTerms)) return "关系与家庭";
  if (includesAny(workStudyTerms)) return "工作与学习";
  if (includesAny(missionTerms)) return "使命与引导";
  if (includesAny(situationTerms)) return "人生处境";
  if (includesAny(compositeTerms)) return "复合标签";
  return "复合标签";
}

const BUCKET_ORDER = [
  "敬拜与赞美",
  "神是谁",
  "人的回应",
  "安静与睡眠",
  "生命与医治",
  "关系与家庭",
  "工作与学习",
  "使命与引导",
  "人生处境",
  "复合标签",
];

export function groupReaderThemeRows(rows: ReaderThemeFlatRow[]): {
  categoryName: string;
  count: number;
  items: ReaderThemeFlatRow[];
}[] {
  const map = new Map<string, ReaderThemeFlatRow[]>(BUCKET_ORDER.map((name) => [name, []]));
  for (const row of rows) {
    const bucket = map.get(row.bucket) ?? map.get("复合标签")!;
    bucket.push(row);
  }
  return BUCKET_ORDER.map((name) => ({
    categoryName: name,
    count: (map.get(name) || []).length,
    items: (map.get(name) || []).sort(
      (a, b) => b.verseCount - a.verseCount || a.displayName.localeCompare(b.displayName, "zh-Hans-CN"),
    ),
  })).filter((g) => g.items.length > 0);
}

export function groupCompositeReaderThemeItems(items: ReaderThemeFlatRow[]): { name: string; items: ReaderThemeFlatRow[] }[] {
  const buckets: Record<string, ReaderThemeFlatRow[]> = {
    上帝是谁: [],
    耶稣是谁: [],
    圣灵: [],
    救恩: [],
    信心: [],
    圣洁与更新: [],
    敬拜与祷告: [],
    神的应许: [],
    末世与永恒: [],
    待定: [],
  };
  const includesAny = (text: string, terms: string[]) => terms.some((term) => text.includes(term));
  const godTerms = ["上帝", "神是谁", "神的", "主权", "同在", "信实", "全能", "圣洁", "慈爱"];
  const jesusTerms = ["耶稣", "基督", "救主", "十字架", "复活", "君王", "弥赛亚"];
  const spiritTerms = ["圣灵", "恩赐", "充满", "引导", "能力", "内住", "更新"];
  const salvationTerms = ["救恩", "得救", "拯救", "赦免", "称义", "重生", "永生", "救赎"];
  const faithTerms = ["信心", "信靠", "盼望", "仰望", "顺服", "坚持", "等候"];
  const holinessTerms = ["悔改", "回转", "洁净", "成圣", "更新", "分别为圣", "归回", "圣洁"];
  const worshipPrayerTerms = ["敬拜", "赞美", "祷告", "呼求", "代祷", "感谢", "称颂", "颂扬", "歌颂"];
  const promiseTerms = ["应许", "祝福", "带领", "保护", "供应", "怜悯", "恩典", "平安", "安慰"];
  const eternalTerms = ["末世", "复活", "审判", "永恒", "永远", "天国", "将来", "国度"];

  for (const row of items) {
    const text = `${row.displayName || row.name} ${row.categoryName}`.toLowerCase();
    if (includesAny(text, jesusTerms)) {
      buckets.耶稣是谁.push(row);
    } else if (includesAny(text, spiritTerms)) {
      buckets.圣灵.push(row);
    } else if (includesAny(text, salvationTerms)) {
      buckets.救恩.push(row);
    } else if (includesAny(text, faithTerms)) {
      buckets.信心.push(row);
    } else if (includesAny(text, holinessTerms)) {
      buckets.圣洁与更新.push(row);
    } else if (includesAny(text, worshipPrayerTerms)) {
      buckets.敬拜与祷告.push(row);
    } else if (includesAny(text, promiseTerms)) {
      buckets.神的应许.push(row);
    } else if (includesAny(text, eternalTerms)) {
      buckets.末世与永恒.push(row);
    } else if (includesAny(text, godTerms)) {
      buckets.上帝是谁.push(row);
    } else {
      buckets.待定.push(row);
    }
  }

  return [
    { name: "上帝是谁", items: buckets.上帝是谁 },
    { name: "耶稣是谁", items: buckets.耶稣是谁 },
    { name: "圣灵", items: buckets.圣灵 },
    { name: "救恩", items: buckets.救恩 },
    { name: "信心", items: buckets.信心 },
    { name: "圣洁与更新", items: buckets.圣洁与更新 },
    { name: "敬拜与祷告", items: buckets.敬拜与祷告 },
    { name: "神的应许", items: buckets.神的应许 },
    { name: "末世与永恒", items: buckets.末世与永恒 },
    { name: "待定", items: buckets.待定 },
  ].filter((g) => g.items.length > 0);
}
