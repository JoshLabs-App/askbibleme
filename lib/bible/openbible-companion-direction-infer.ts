/**
 * 三种「陪伴方向」：由英文 topic + 中文译名做关键词命中（启发式，非神学分类学）。
 * 一行可同时命中多类；也可能三类皆未命中（筛「全部」时仍可见）。
 */

const QUIET_EN = [
  "comfort",
  "anxiety",
  "anxious",
  "worry",
  "worried",
  "fear",
  "afraid",
  "fright",
  "peace of mind",
  "peace ",
  "calm",
  "rest ",
  "grief",
  "grieve",
  "mourn",
  "lonely",
  "loneliness",
  "depression",
  "sorrow",
  "hurt",
  "hurting",
  "stress",
  "stressed",
  "weary",
  "tired",
  "encourag",
  "panic",
  "trauma",
  "emptiness",
  "helpless",
  "discourag",
  "hopeless",
  "shame",
  "guilty",
  "guilt",
  "overwhelm",
  "mourning",
  "sadness",
  "broken heart",
  "brokenhearted",
  "healing",
  "consolation",
];

const PRAY_EN = [
  "pray",
  "prayer",
  "petition",
  "intercess",
  "supplication",
  "thanksgiv",
  "worship",
  "fasting",
  "fast ",
  "seeking god",
  "call upon",
  "cry out",
  "praise",
  "humble",
  "supplic",
  "asking god",
  "pray for",
  "pray to",
  "pray about",
  "intercede",
  "petitions",
];

const FORM_EN = [
  "repent",
  "repentance",
  "sin ",
  " sins",
  "sin,",
  "sin.",
  "sin;",
  "obedien",
  "obey",
  "holiness",
  "holy living",
  "sanctif",
  "temptation",
  "commandment",
  "commandments",
  "disciplin",
  "self-control",
  "self control",
  "submit",
  "submission",
  "grow in",
  "spiritual growth",
  "spiritual maturity",
  "disciple",
  "deny yourself",
  "take up your cross",
  "law of moses",
  "law of god",
  "judgment",
  "accountability",
  "conviction",
  "renew",
  "renewal",
  "transform",
  "transformed",
  "consecrat",
  "steadfast",
  "obedience",
  "chasten",
  "rebuke",
  "correct",
  "discipline",
];

const QUIET_ZH = [
  "安慰",
  "焦虑",
  "忧虑",
  "惧怕",
  "平安",
  "哀伤",
  "抑郁",
  "孤独",
  "疲惫",
  "压力",
  "平静",
  "安息",
  "受伤",
  "恐慌",
  "绝望",
  "空虚",
  "羞愧",
  "内疚",
  "鼓励",
  "忧伤",
  "重担", // 情绪承载侧；与「祷告交托」重叠时多类同时为 true 可接受
];

const PRAY_ZH = ["祷告", "祈求", "敬拜", "感恩", "代求", "交托", "呼求", "倾心", "等候"];

const FORM_ZH = [
  "认罪",
  "悔改",
  "顺服",
  "圣洁",
  "试探",
  "诫命",
  "操练",
  "界线",
  "成长",
  "管教",
  "成圣",
  "真理",
  "治死",
  "老我",
  "对付罪",
];

function normTopic(topic: string): string {
  return topic.trim().toLowerCase().replace(/\s+/g, " ");
}

function hitEn(hay: string, needles: readonly string[]): boolean {
  return needles.some((n) => hay.includes(n));
}

function hitZh(zh: string, needles: readonly string[]): boolean {
  if (!zh.trim()) return false;
  return needles.some((n) => zh.includes(n));
}

export function inferCompanionDirectionFlags(
  topic: string,
  topicZh: string | null,
): { quiet: boolean; pray: boolean; form: boolean } {
  const t = normTopic(topic);
  const zh = (topicZh ?? "").trim();
  return {
    quiet: hitEn(t, QUIET_EN) || hitZh(zh, QUIET_ZH),
    pray: hitEn(t, PRAY_EN) || hitZh(zh, PRAY_ZH),
    form: hitEn(t, FORM_EN) || hitZh(zh, FORM_ZH),
  };
}
