/** Ported from mobile explore screen for web alignment. */

type NarrowGateCategory = {
  title: string;
  refs: string[];
};

export const NARROW_GATE_BOOK_ABBR_TO_ID: Record<string, string> = {
  创: "GEN",
  申: "DEU",
  利: "LEV",
  诗: "PSA",
  箴: "PRO",
  太: "MAT",
  可: "MRK",
  路: "LUK",
  约: "JHN",
  徒: "ACT",
  罗: "ROM",
  林前: "1CO",
  林后: "2CO",
  加: "GAL",
  弗: "EPH",
  腓: "PHP",
  西: "COL",
  帖前: "1TH",
  提前: "1TI",
  提后: "2TI",
  多: "TIT",
  来: "HEB",
  雅: "JAS",
  彼前: "1PE",
  彼后: "2PE",
  约壹: "1JN",
  启: "REV",
  弥: "MIC",
};

export const NARROW_GATE_CATEGORIES: NarrowGateCategory[] = [
  { title: "1. 得救与根基", refs: ["可 1:15", "徒 2:38", "约 3:3", "罗 10:9-10", "弗 2:8-10", "太 28:19"] },
  { title: "2. 爱神爱人", refs: ["太 22:37-39", "约 13:34-35", "罗 13:8-10", "加 5:14"] },
  { title: "3. 跟随主与门徒代价", refs: ["路 9:23", "路 14:26-27", "太 6:33", "约 15:4-5", "约 14:15"] },
  { title: "4. 圣洁与分别为圣", refs: ["彼前 1:15-16", "来 12:14", "罗 12:2", "西 3:5", "林前 6:19-20"] },
  { title: "5. 品格与圣灵果子", refs: ["加 5:22-23", "弗 4:1-3", "西 3:12-14", "帖前 5:16-18", "腓 4:6-7"] },
  { title: "6. 祷告与神话语", refs: ["帖前 5:17", "路 18:1", "提后 3:16-17", "雅 1:22", "西 3:16", "约壹 5:14-15"] },
  { title: "7. 教会生活", refs: ["来 10:24-25", "加 6:2", "弗 4:32", "罗 15:7", "彼前 4:10-11", "来 13:17"] },
  { title: "8. 家庭与婚姻", refs: ["弗 5:22-25", "弗 6:1-4", "来 13:4", "彼前 3:1-2"] },
  { title: "9. 金钱与工作", refs: ["提前 6:6-10", "来 13:5", "西 3:23-24", "林后 9:6-8", "约壹 2:15-17"] },
  { title: "10. 见证与使命", refs: ["太 28:19-20", "太 5:13-16", "徒 1:8", "彼前 3:15", "提后 4:2"] },
  { title: "11. 受苦与忍耐", refs: ["太 5:10-12", "罗 5:3-5", "雅 1:12", "彼前 3:14", "来 12:1-3"] },
  { title: "12. 警醒与永恒盼望", refs: ["太 24:42-44", "彼后 3:11-14", "约 11:25-26", "启 2:10", "启 21:1-4"] },
];

export const NARROW_GATE_TITLES_EN: string[] = [
  "1. Salvation and foundation",
  "2. Love God and love people",
  "3. Follow Christ and the cost",
  "4. Holiness and being set apart",
  "5. Character and fruit of the Spirit",
  "6. Prayer and God's word",
  "7. Church life",
  "8. Family and marriage",
  "9. Money and vocation",
  "10. Witness and mission",
  "11. Suffering and endurance",
  "12. Watchfulness and eternal hope",
];
