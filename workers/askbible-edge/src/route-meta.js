export const PRODUCT_NAME = "AskBible.me";
export const PRODUCT_ORIGIN = "https://askbible.me";

/** 圣经正典 66 卷（与 lib/bible/scripture-books.ts 对齐） */
export const BIBLE_BOOKS = {
  GEN: { name: "创世记", chapters: 50 },
  EXO: { name: "出埃及记", chapters: 40 },
  LEV: { name: "利未记", chapters: 27 },
  NUM: { name: "民数记", chapters: 36 },
  DEU: { name: "申命记", chapters: 34 },
  JOS: { name: "约书亚记", chapters: 24 },
  JDG: { name: "士师记", chapters: 21 },
  RUT: { name: "路得记", chapters: 4 },
  "1SA": { name: "撒母耳记上", chapters: 31 },
  "2SA": { name: "撒母耳记下", chapters: 24 },
  "1KI": { name: "列王纪上", chapters: 22 },
  "2KI": { name: "列王纪下", chapters: 25 },
  "1CH": { name: "历代志上", chapters: 29 },
  "2CH": { name: "历代志下", chapters: 36 },
  EZR: { name: "以斯拉记", chapters: 10 },
  NEH: { name: "尼希米记", chapters: 13 },
  EST: { name: "以斯帖记", chapters: 10 },
  JOB: { name: "约伯记", chapters: 42 },
  PSA: { name: "诗篇", chapters: 150 },
  PRO: { name: "箴言", chapters: 31 },
  ECC: { name: "传道书", chapters: 12 },
  SNG: { name: "雅歌", chapters: 8 },
  ISA: { name: "以赛亚书", chapters: 66 },
  JER: { name: "耶利米书", chapters: 52 },
  LAM: { name: "耶利米哀歌", chapters: 5 },
  EZK: { name: "以西结书", chapters: 48 },
  DAN: { name: "但以理书", chapters: 12 },
  HOS: { name: "何西阿书", chapters: 14 },
  JOL: { name: "约珥书", chapters: 3 },
  AMO: { name: "阿摩司书", chapters: 9 },
  OBA: { name: "俄巴底亚书", chapters: 1 },
  JON: { name: "约拿书", chapters: 4 },
  MIC: { name: "弥迦书", chapters: 7 },
  NAM: { name: "那鸿书", chapters: 3 },
  HAB: { name: "哈巴谷书", chapters: 3 },
  ZEP: { name: "西番雅书", chapters: 3 },
  HAG: { name: "哈该书", chapters: 2 },
  ZEC: { name: "撒迦利亚书", chapters: 14 },
  MAL: { name: "玛拉基书", chapters: 4 },
  MAT: { name: "马太福音", chapters: 28 },
  MRK: { name: "马可福音", chapters: 16 },
  LUK: { name: "路加福音", chapters: 24 },
  JHN: { name: "约翰福音", chapters: 21 },
  ACT: { name: "使徒行传", chapters: 28 },
  ROM: { name: "罗马书", chapters: 16 },
  "1CO": { name: "哥林多前书", chapters: 16 },
  "2CO": { name: "哥林多后书", chapters: 13 },
  GAL: { name: "加拉太书", chapters: 6 },
  EPH: { name: "以弗所书", chapters: 6 },
  PHP: { name: "腓立比书", chapters: 4 },
  COL: { name: "歌罗西书", chapters: 4 },
  "1TH": { name: "帖撒罗尼迦前书", chapters: 5 },
  "2TH": { name: "帖撒罗尼迦后书", chapters: 3 },
  "1TI": { name: "提摩太前书", chapters: 6 },
  "2TI": { name: "提摩太后书", chapters: 4 },
  TIT: { name: "提多书", chapters: 3 },
  PHM: { name: "腓利门书", chapters: 1 },
  HEB: { name: "希伯来书", chapters: 13 },
  JAS: { name: "雅各书", chapters: 5 },
  "1PE": { name: "彼得前书", chapters: 5 },
  "2PE": { name: "彼得后书", chapters: 3 },
  "1JN": { name: "约翰一书", chapters: 5 },
  "2JN": { name: "约翰二书", chapters: 1 },
  "3JN": { name: "约翰三书", chapters: 1 },
  JUD: { name: "犹大书", chapters: 1 },
  REV: { name: "启示录", chapters: 22 },
};

const STATIC_ROUTES = {
  "/": {
    title: `${PRODUCT_NAME} · 安静地，回到经文`,
    description: "一个让人重新进入圣经的安静入口。网页、iPhone、iPad、Android 都可以用。",
    summary: "AskBible.me — 一个让人重新进入圣经的安静入口，提供正典六十六卷阅读、章节朗读、读经计划与救赎全景。",
  },
  "/web": {
    title: PRODUCT_NAME,
    description: "全屏自然影像与轮播经文，安静回到经文。",
    summary: "AskBible.me 网页版入口 — 全屏自然影像、轮播金句与安静阅读体验。",
  },
  "/nature": {
    title: `自然 | ${PRODUCT_NAME}`,
    description: "全屏自然影像与轮播经文。",
    summary: "AskBible.me 自然静修页 — 全屏自然影像与每日金句。",
  },
  "/read": {
    title: `圣经 | ${PRODUCT_NAME}`,
    description: "正典六十六卷目录、今日读经与安静的阅读入口。",
    summary: "AskBible.me 圣经阅读 — 正典六十六卷目录、今日读经与双语对照阅读。",
  },
  "/panorama": {
    title: `救赎全景 | ${PRODUCT_NAME}`,
    description: "在完整的救赎故事中安静灵修，看见今天所读经文的位置。",
    summary: "救赎全景 — 从创世、拣选、应许到成全，看清整本圣经的历史脉络。",
  },
  "/journey": {
    title: `救赎全景 | ${PRODUCT_NAME}`,
    description: "在完整的救赎故事中安静灵修，看见今天所读经文的位置。",
    summary: "救赎全景 — 从创世、拣选、应许到成全，看清整本圣经的历史脉络。",
  },
  "/plans": {
    title: `读经计划 | ${PRODUCT_NAME}`,
    description: "可选的一年通读、编年、分段等读经表；链到章节阅读。",
    summary: "AskBible.me 读经计划 — 提供一年通读、编年与分段等读经节奏。",
  },
  "/read/plans": {
    title: `读经计划 | ${PRODUCT_NAME}`,
    description: "可选的一年通读、编年、分段等读经表；链到章节阅读。",
    summary: "AskBible.me 读经计划 — 提供一年通读、编年与分段等读经节奏。",
  },
  "/explore": {
    title: `探索 | ${PRODUCT_NAME}`,
    description: "圣经人物馆、历代信经、祷告与经文等安静灵修入口。",
    summary: "AskBible.me 探索 — 涵盖圣经人物馆、历代信经、窄门之路、祷告与经文等专题入口。",
  },
  "/figures": {
    title: `圣经人物库 | ${PRODUCT_NAME}`,
    description: "按正典书卷与时间线查阅人物；主、次混排，按本卷出现先后排列。",
    summary: "圣经人物库 — 按正典书卷与时间线查阅圣经人物索引与相关经文出处。",
  },
  "/explore/figures": {
    title: `圣经人物库 | ${PRODUCT_NAME}`,
    description: "按正典书卷与时间线查阅人物；主、次混排，按本卷出现先后排列。",
    summary: "圣经人物库 — 按正典书卷与时间线查阅圣经人物索引与相关经文出处。",
  },
  "/music": {
    title: `音乐 | ${PRODUCT_NAME}`,
    description: "安静的纯音乐伴读空间，陪你回到经文。",
    summary: "AskBible.me 音乐 — 安静纯音乐伴读，配合每日灵修与阅读。",
  },
  "/scenes": {
    title: `场景 | ${PRODUCT_NAME}`,
    description: "选择自然首页背景场景；静态列表，选择保存在本机。",
    summary: "AskBible.me 自然场景选择 — 自定义静修首页背景与自然声景。",
  },
  "/verse": {
    title: `金句 | ${PRODUCT_NAME}`,
    description: "每日金句与经文卡片分享。",
    summary: "AskBible.me 金句 — 每日精选经文与静默聆听。",
  },
  "/read/search": {
    title: `经文搜索 | ${PRODUCT_NAME}`,
    description: "快速检索正典六十六卷圣经经文内容。",
    summary: "AskBible.me 经文搜索 — 离线快速查找圣经经文与章节。",
  },
  "/read/translations": {
    title: `圣经版本 | ${PRODUCT_NAME}`,
    description: "管理与下载离线圣经译本。",
    summary: "AskBible.me 圣经版本 — 选择与缓存常用中文、英文圣经译本。",
  },
  "/read/favorites": {
    title: `收藏 | ${PRODUCT_NAME}`,
    description: "已收藏的经文书签与章节记录。",
    summary: "AskBible.me 收藏 — 回顾保存的经文书签与笔记。",
  },
  "/explore/prayer": {
    title: `祷告与经文 | ${PRODUCT_NAME}`,
    description: "按场景慢读祷告相关经文。",
    summary: "祷告与经文 — 按灵修场景安静阅读圣经祷告经文。",
  },
  "/explore/historical-creeds": {
    title: `历代信经 | ${PRODUCT_NAME}`,
    description: "使徒信经、尼西亚信经等大公教会经典信条原文与对照。",
    summary: "历代信经 — 汇聚大公教会经典历史信经文本。",
  },
  "/explore/narrow-gate": {
    title: `窄门之路 | ${PRODUCT_NAME}`,
    description: "沿着主耶稣指出的窄路，按主题慢读经文。",
    summary: "窄门之路 — 按主题慢读主耶稣的教导与核心经文。",
  },
  "/explore/achievements": {
    title: `成就 | ${PRODUCT_NAME}`,
    description: "勋章、书卷印章与等级：看得见的读经积累。",
    summary: "AskBible.me 读经成就 — 记录书卷印章与持续读经足迹。",
  },
  "/explore/year-day-count": {
    title: `数算年日 | ${PRODUCT_NAME}`,
    description: "以生日为起点，在百年横轴上看自己已走过的日子。",
    summary: "数算年日 — 在百年时间横轴中默想诗篇九十篇的提醒。",
  },
};

function normalizePath(pathname) {
  if (!pathname || pathname === "/") return "/";
  const cleaned = pathname.replace(/\/+$/, "");
  return cleaned || "/";
}

export function resolveRouteMeta(pathname) {
  const path = normalizePath(pathname);

  if (STATIC_ROUTES[path]) {
    return { ...STATIC_ROUTES[path], url: `${PRODUCT_ORIGIN}${path}` };
  }

  // /read/:book/:chapter 或 /read/:book
  const readMatch = /^\/read\/([^/]+)(?:\/(\d+))?$/i.exec(path);
  if (readMatch) {
    const bookId = decodeURIComponent(readMatch[1]).toUpperCase();
    const chapterRaw = readMatch[2];
    const book = BIBLE_BOOKS[bookId];
    if (book && chapterRaw) {
      const chapter = Number(chapterRaw);
      if (Number.isInteger(chapter) && chapter >= 1 && chapter <= book.chapters) {
        const canonicalPath = `/read/${bookId}/${chapter}`;
        return {
          title: `${book.name} ${chapter} | ${PRODUCT_NAME}`,
          description: `阅读圣经${book.name}第 ${chapter} 章经文与章节朗读 — ${PRODUCT_NAME}。`,
          summary: `${book.name}第 ${chapter} 章（全卷共 ${book.chapters} 章）— ${PRODUCT_NAME} 安静圣经阅读入口。`,
          url: `${PRODUCT_ORIGIN}${canonicalPath}`,
        };
      }
    }
    if (book && !chapterRaw) {
      const canonicalPath = `/read/${bookId}`;
      return {
        title: `${book.name} | ${PRODUCT_NAME}`,
        description: `${book.name}（共 ${book.chapters} 章）章节目录与经文阅读 — ${PRODUCT_NAME}。`,
        summary: `${book.name}（共 ${book.chapters} 章）— ${PRODUCT_NAME} 正典书卷阅读入口。`,
        url: `${PRODUCT_ORIGIN}${canonicalPath}`,
      };
    }
    return {
      title: `经文 | ${PRODUCT_NAME}`,
      description: `正典六十六卷圣经阅读与朗读入口 — ${PRODUCT_NAME}。`,
      summary: `${PRODUCT_NAME} — 正典六十六卷圣经阅读入口。`,
      url: `${PRODUCT_ORIGIN}${path}`,
    };
  }

  if (path.startsWith("/plans/") || path.startsWith("/read/plans/")) {
    return {
      ...STATIC_ROUTES["/plans"],
      url: `${PRODUCT_ORIGIN}${path}`,
    };
  }

  if (path.startsWith("/figures/") || path.startsWith("/explore/figures/")) {
    return {
      ...STATIC_ROUTES["/figures"],
      url: `${PRODUCT_ORIGIN}${path}`,
    };
  }

  return {
    ...STATIC_ROUTES["/"],
    url: `${PRODUCT_ORIGIN}${path}`,
  };
}
