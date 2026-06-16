import { readFileSync } from "fs";
import path from "path";
import {
  formatBibleBookHistoryEraAriaZh,
  formatBibleBookHistoryEraCompact,
} from "@/lib/bible/bible-book-history-era";
import {
  resolveLegacyFigureDisplayBookIds,
  sortLegacyFiguresByBookAppearance,
} from "@/lib/legacy-figure-book-appearance-order";
import {
  OLD_TESTAMENT_MAX_BOOK_NUMBER,
  scriptureBooks,
  testamentForBookNumber,
} from "@/lib/bible/scripture-books";

export type LegacyFigureArticle = {
  slug: string;
  title: string;
  summary: string;
  body: string;
  authorName: string;
  updatedAt: string;
};

export type LegacyFigureProfile = {
  id: string;
  slug: string;
  displayNameZh: string;
  englishName: string;
  aliasesZh: string[];
  identityType: string;
  importanceTier: string;
  profileStatus: string;
  primaryBookId: string;
  bookIds: string[];
  characterRoleZh: string;
  scripturePersonalityZh: string;
  periodLabelZh: string;
  lifespanZh: string;
  managementNoteZh: string;
  linkedArticleSlug: string;
  article: LegacyFigureArticle | null;
};

type LegacyFigurePreviewRoot = {
  schemaVersion: number;
  exportedAt: string;
  note: string;
  sources: { profiles: string; articles: string };
  stats: {
    profileCount: number;
    linkedCount: number;
    unlinkedProfileCount: number;
    articleCount: number;
    orphanArticleCount: number;
  };
  profiles: LegacyFigureProfile[];
  orphanArticles: LegacyFigureArticle[];
};

let cache: LegacyFigurePreviewRoot | null = null;

function readRoot(cwd = process.cwd()): LegacyFigurePreviewRoot {
  if (cache) return cache;
  const filePath = path.join(cwd, "data", "legacy-figure-preview.json");
  cache = JSON.parse(readFileSync(filePath, "utf8")) as LegacyFigurePreviewRoot;
  return cache;
}

export function readLegacyFigurePreviewStats(cwd = process.cwd()) {
  return readRoot(cwd).stats;
}

export function readLegacyFigureProfiles(cwd = process.cwd()): LegacyFigureProfile[] {
  return readRoot(cwd).profiles;
}

export function readLegacyFigureOrphanArticles(cwd = process.cwd()): LegacyFigureArticle[] {
  return readRoot(cwd).orphanArticles;
}

export function readLegacyFigureProfileBySlug(
  slug: string,
  cwd = process.cwd(),
): LegacyFigureProfile | null {
  const needle = decodeURIComponent(slug).trim().replace(/^figure-/, "");
  const profiles = buildLegacyFiguresForBookTable(cwd);
  return (
    profiles.find(
      (item) =>
        item.slug === needle
        || item.slug === `figure-${needle}`
        || item.id === needle,
    ) ?? null
  );
}

export function readLegacyFigureOrphanArticleBySlug(
  slug: string,
  cwd = process.cwd(),
): LegacyFigureArticle | null {
  const needle = decodeURIComponent(slug).trim();
  return readLegacyFigureOrphanArticles(cwd).find((item) => item.slug === needle) ?? null;
}

/** 孤儿文章 slug → 已有 V2 档案 id / slug（补绑文章）。 */
const ORPHAN_ARTICLE_PROFILE_BINDINGS: Record<string, string> = {
  "figure-abraham": "abraham",
  "figure-moses": "moses",
  "figure-david": "david",
};

/** 无 V2 档案的孤儿文章 → 归属书卷与主次。 */
const ORPHAN_ARTICLE_BOOK_ASSIGNMENTS: Record<
  string,
  { bookId: string; characterRoleZh: "主人物" | "相关人物" }
> = {
  "figure-abel": { bookId: "GEN", characterRoleZh: "相关人物" },
  "figure-cain": { bookId: "GEN", characterRoleZh: "相关人物" },
  "figure-potiphar": { bookId: "GEN", characterRoleZh: "相关人物" },
  "figure-potiphar-s-wife": { bookId: "GEN", characterRoleZh: "相关人物" },
};

function displayNameFromArticleTitle(title: string) {
  const colon = title.indexOf("：");
  return (colon > 0 ? title.slice(0, colon) : title).trim();
}

function profileFromOrphanArticle(
  article: LegacyFigureArticle,
  assignment: { bookId: string; characterRoleZh: "主人物" | "相关人物" },
): LegacyFigureProfile {
  const bookId = assignment.bookId.trim().toUpperCase();
  const displayNameZh = displayNameFromArticleTitle(article.title);
  return {
    id: article.slug,
    slug: article.slug.replace(/^figure-/, ""),
    displayNameZh,
    englishName: "",
    aliasesZh: [],
    identityType: "article_only",
    importanceTier: "supporting",
    profileStatus: "article_only",
    primaryBookId: bookId,
    bookIds: [bookId],
    characterRoleZh: assignment.characterRoleZh,
    scripturePersonalityZh: article.summary || "",
    periodLabelZh: "",
    lifespanZh: "",
    managementNoteZh: "仅文章、无 V2 档案",
    linkedArticleSlug: article.slug,
    article,
  };
}

function makeLegacyFigureArticle(
  slug: string,
  title: string,
  summary: string,
  body: string,
): LegacyFigureArticle {
  return {
    slug,
    title,
    summary,
    body,
    authorName: "AskBible",
    updatedAt: "2026-06-10T00:00:00.000Z",
  };
}

const JUDAH_OT_ARTICLE = makeLegacyFigureArticle(
  "figure-judah-ot",
  "旧约·犹大：雅各的儿子",
  "旧约中的犹大是雅各的儿子、犹大支派的始祖；在约瑟叙事与雅各临终祝福中占据重要位置。",
  `## 一、人物概览
旧约中的犹大是雅各与利亚所生的儿子，名列十二支派之一。他主要出现在《创世记》的家族叙事中，与约瑟的故事、他玛的事件，以及雅各对众子的祝福紧密相连。

## 二、人物首次出现
犹大首次在《创世记》29:35 出生时被命名；名字与「赞美」相关，表明利亚在他出生时向神感恩。

## 三、身份与背景
犹大是雅各的第四子，属以色列十二支派中的犹大支派。后来大卫王与弥赛亚的应许，都关联到犹大这一脉（创 49:10）。

## 四、主要经历
### 与弟兄们对待约瑟
经文：创世记 37:26-27
犹大曾提议把约瑟卖给以实玛利人，而非直接杀害，使约瑟被带到埃及。

### 与他玛的事件
经文：创世记 38 章
这段叙事呈现犹大在公义与认过上的复杂经历，也显示神仍在他家族谱系中工作。

### 在埃及护佑便雅悯
经文：创世记 43-44 章
犹大向约瑟陈情，愿意为便雅悯代求，显露出对父亲与弟弟的承担。

### 雅各的祝福
经文：创世记 49:8-12
雅各预言犹大支派中将有掌权者，直到细罗来到；这成为日后王权与弥赛亚盼望的重要线索。

## 五、属灵提醒
- 人的软弱并不取消神对盟约家族的带领。
- 家族中的责任与 repentance，会在经文中被真实呈现。
- 读旧约犹大时，应与他后来支派、王权与应许的历史连起来看。

## 六、相关重要经文
- 创世记 29:35
- 创世记 37、38、43-44 章
- 创世记 49:8-12`,
);

const JUDE_AUTHOR_ARTICLE = makeLegacyFigureArticle(
  "figure-jude-author",
  "犹大书·犹大：短书的作者",
  "《犹大书》的作者自称作「耶稣基督的仆人，雅各的兄弟」；这封短信以劝勉信徒为真道竭力争辩著称。",
  `## 一、人物概览
《犹大书》的作者在新约中写作「犹大」（希腊文 Judas / Jude），与旧约雅各的儿子、以及卖主的加略人犹大并非同一人。传统上常把他与「雅各的兄弟」这一身份联系起来。

## 二、书信开头
经文：犹大书 1:1
作者表明自己是耶稣基督的仆人，也是雅各的兄弟，向蒙爱、被召、在父神里得保守的人写信。

## 三、写作重点
### 为真道竭力争辩
经文：犹大书 1:3
作者本要写关于救恩的信，却感到必须劝勉读者为从前一次交付圣徒的真道竭力争辩。

### 警戒假教师与偏离
经文：犹大书 1:4-16
书信严厉指出潜入教会、否定主权、放纵不义之人的危险，并以历史例证提醒读者。

### 保守与建造
经文：犹大书 1:20-21
作者劝勉读者在至圣的真道上造就自己，在神的爱中保守自己，等候 mercy。

## 四、与其他「犹大」的分别
- **旧约·犹大**：雅各的儿子，见《创世记》。
- **卖主的犹大**：加略人犹大，见四福音书与使徒行传。
- **犹大书·犹大**：仅见《犹大书》1:1 的作者署名。

## 五、属灵提醒
- 真道需要被保守，也需要被温柔而坚定地争辩。
- 读《犹大书》时，先确认作者身份，再进入书信警戒与劝勉。

## 六、相关重要经文
- 犹大书 1:1-4
- 犹大书 1:20-25`,
);

function isMergedJudahProfile(profile: LegacyFigureProfile): boolean {
  return profile.id === "犹大" || profile.slug === "figure-犹大" || profile.slug === "犹大";
}

function expandJudahProfiles(profiles: LegacyFigureProfile[]): LegacyFigureProfile[] {
  const merged = profiles.find(isMergedJudahProfile);
  const rest = profiles.filter((profile) => !isMergedJudahProfile(profile));
  const judasArticle =
    merged?.article
    ?? makeLegacyFigureArticle(
      "figure-judah",
      "卖主的犹大：背叛者的象征",
      "卖主的犹大是耶稣十二门徒之一，因出卖主而臭名昭著，主要见于四部福音书。",
      "（见原 figure-judah 文章。）",
    );

  const judasIscariot: LegacyFigureProfile = {
    id: "judas-iscariot",
    slug: "judas-iscariot",
    displayNameZh: "卖主的犹大",
    englishName: "Judas Iscariot",
    aliasesZh: ["加略人犹大"],
    identityType: "split",
    importanceTier: "supporting",
    profileStatus: "legacy_imported",
    primaryBookId: "MAT",
    bookIds: ["MAT", "MRK", "LUK", "JHN", "ACT"],
    characterRoleZh: "主人物",
    scripturePersonalityZh: "耶稣十二门徒之一，因出卖主而臭名昭著，仅见于新约福音书与使徒行传。",
    periodLabelZh: "福音书时代",
    lifespanZh: "不详",
    managementNoteZh: "自旧 V2「犹大」档案拆分；绑定原 figure-judah 文章。",
    linkedArticleSlug: judasArticle.slug,
    article: {
      ...judasArticle,
      title: "卖主的犹大：背叛者的象征",
      summary:
        "卖主的犹大是耶稣十二门徒之一，因贪婪与背叛而出卖主；他的故事见于四福音书，是警戒与悔改的提醒。",
    },
  };

  const otJudah: LegacyFigureProfile = {
    id: "judah-ot",
    slug: "judah-ot",
    displayNameZh: "旧约·犹大",
    englishName: "Judah",
    aliasesZh: ["雅各的儿子"],
    identityType: "split",
    importanceTier: "core",
    profileStatus: "legacy_imported",
    primaryBookId: "GEN",
    bookIds: ["GEN", "1CH", "2CH"],
    characterRoleZh: "主人物",
    scripturePersonalityZh: "雅各的儿子、犹大支派始祖；与约瑟叙事、他玛事件及雅各祝福密切相关。",
    periodLabelZh: "族长时期",
    lifespanZh: "不详",
    managementNoteZh: "自旧 V2「犹大」档案拆分；旧约人物。",
    linkedArticleSlug: JUDAH_OT_ARTICLE.slug,
    article: JUDAH_OT_ARTICLE,
  };

  const judeAuthor: LegacyFigureProfile = {
    id: "jude-author",
    slug: "jude-author",
    displayNameZh: "犹大书·犹大",
    englishName: "Jude",
    aliasesZh: ["雅各的兄弟"],
    identityType: "split",
    importanceTier: "core",
    profileStatus: "legacy_imported",
    primaryBookId: "JUD",
    bookIds: ["JUD"],
    characterRoleZh: "主人物",
    scripturePersonalityZh: "《犹大书》作者，劝勉信徒为真道竭力争辩。",
    periodLabelZh: "使徒时代",
    lifespanZh: "不详",
    managementNoteZh: "自旧 V2「犹大」档案拆分；犹大书作者。",
    linkedArticleSlug: JUDE_AUTHOR_ARTICLE.slug,
    article: JUDE_AUTHOR_ARTICLE,
  };

  return [...rest, judasIscariot, otJudah, judeAuthor];
}

function isMergedPharaohProfile(profile: LegacyFigureProfile): boolean {
  return profile.id === "pharaoh" || profile.slug === "figure-pharaoh";
}

function expandPharaohProfiles(
  profiles: LegacyFigureProfile[],
  cwd = process.cwd(),
): LegacyFigureProfile[] {
  const merged = profiles.find(isMergedPharaohProfile);
  const rest = profiles.filter((profile) => !isMergedPharaohProfile(profile));

  const josephOrphan =
    readLegacyFigureOrphanArticles(cwd).find((item) => item.slug === "figure-pharaoh-670b") ?? null;

  const exodusArticle =
    merged?.article
    ?? makeLegacyFigureArticle(
      "figure-pharaoh",
      "出埃及·法老：傲慢无礼的压迫者",
      "出埃及·法老是《出埃及记》中的主要反派，以刚硬心肠对抗摩西，十灾与红海审判显明神的权能。",
      "（见原 figure-pharaoh 文章。）",
    );

  const josephArticle =
    josephOrphan
    ?? makeLegacyFigureArticle(
      "figure-pharaoh-joseph",
      "约瑟·法老：解梦与收留",
      "约瑟·法老出现在《创世记》约瑟叙事中，因梦召约瑟解梦并立他为宰相，后在饥荒中收留雅各全家。",
      "（见原 figure-pharaoh-670b 文章。）",
    );

  const pharaohExodus: LegacyFigureProfile = {
    id: "pharaoh-exodus",
    slug: "pharaoh-exodus",
    displayNameZh: "出埃及·法老",
    englishName: "Pharaoh of the Exodus",
    aliasesZh: ["法老"],
    identityType: "split",
    importanceTier: "supporting",
    profileStatus: "legacy_imported",
    primaryBookId: "EXO",
    bookIds: ["EXO"],
    characterRoleZh: "主人物",
    scripturePersonalityZh:
      "出埃及叙事中的关键王权象征，常与刚硬、压迫和神审判权能有关；与摩西、十灾、红海相关。",
    periodLabelZh: "出埃及与律法时代",
    lifespanZh: "不详",
    managementNoteZh: "自旧 V2「法老」档案拆分；出埃及记人物。",
    linkedArticleSlug: exodusArticle.slug,
    article: {
      ...exodusArticle,
      title: "出埃及·法老：傲慢无礼的压迫者",
      summary:
        "出埃及·法老是《出埃及记》中的主要反派，以刚硬心肠压迫以色列人、对抗摩西；十灾与红海显明神的权能。",
    },
  };

  const pharaohJoseph: LegacyFigureProfile = {
    id: "pharaoh-joseph",
    slug: "pharaoh-joseph",
    displayNameZh: "约瑟·法老",
    englishName: "Pharaoh of Joseph",
    aliasesZh: ["法老"],
    identityType: "split",
    importanceTier: "supporting",
    profileStatus: "legacy_imported",
    primaryBookId: "GEN",
    bookIds: ["GEN"],
    characterRoleZh: "相关人物",
    scripturePersonalityZh:
      "《创世记》约瑟叙事中的埃及君王；因梦召约瑟解梦、立他为宰相，后在饥荒中接待雅各全家。",
    periodLabelZh: "族长时期",
    lifespanZh: "不详",
    managementNoteZh: "自旧 V2「法老」档案与 figure-pharaoh-670b 孤儿文章拆分；约瑟时代。",
    linkedArticleSlug: josephArticle.slug,
    article: {
      ...josephArticle,
      title: "约瑟·法老：解梦与收留",
      summary:
        "约瑟·法老出现在《创世记》约瑟叙事中，因梦召约瑟解梦并立他为宰相，后在饥荒中收留雅各全家。",
    },
  };

  return [...rest, pharaohExodus, pharaohJoseph];
}

function isMergedJosephProfile(profile: LegacyFigureProfile): boolean {
  return profile.id === "joseph" || profile.slug === "figure-joseph";
}

const GOSPEL_JOSEPH_ARTICLE = makeLegacyFigureArticle(
  "figure-joseph-gospel",
  "福音·约瑟：马利亚的丈夫",
  "福音·约瑟是大卫家的后裔、马利亚的丈夫，在耶稣降生叙事中顺服神，抚养神子。",
  `## 一、人物概览
福音·约瑟是《马太福音》《路加福音》中的约瑟，与创世记里雅各的儿子并非同一人。他是大卫后裔，马利亚的丈夫，在道成肉身叙事里以安静顺服著称。

## 二、人物首次出现
马太福音 1:16-25 与路加福音 1:27、2:1-52 记载他与马利亚的婚约、天使显现，以及带婴孩耶稣下埃及、后归拿撒勒。

## 三、身份与背景
路加 1:27 称他为大卫家的后裔；马太 1 章家谱将他与弥赛亚应许的谱系相连。圣经未记载他后期公开事奉，重点在其家庭中的信实。

## 四、主要经历
### 迎娶马利亚与天使显现
经文：马太 1:18-25
得知马利亚有孕，他本欲暗中休她，天使在梦中指示他不要怕，娶过马利亚，并给婴孩起名叫耶稣。

### 耶稣降生与逃往埃及
经文：马太 2:13-23
他遵 angel 吩咐带母子下埃及，后再迁往拿撒勒，保护婴孩脱离危害。

## 五、与其他「约瑟」的分别
- **创世·约瑟**：雅各的儿子，见《创世记》。
- **约瑟·法老**：埃及君王，见《创世记》约瑟叙事。
- **福音·约瑟**：马利亚的丈夫，见《马太》《路加》降生叙事。

## 六、相关重要经文
- 马太 1:18-25
- 马太 2:13-23
- 路加 1:27
- 路加 2:1-52`,
);

function expandJosephProfiles(profiles: LegacyFigureProfile[]): LegacyFigureProfile[] {
  const merged = profiles.find(isMergedJosephProfile);
  const rest = profiles.filter((profile) => !isMergedJosephProfile(profile));

  const patriarchArticle =
    merged?.article
    ?? makeLegacyFigureArticle(
      "figure-joseph",
      "创世·约瑟：有远见的忠诚者",
      "创世·约瑟是雅各的儿子，被卖至埃及后升高，保全家族，是受苦与信靠的典范。",
      "（见原 figure-joseph 文章。）",
    );

  const josephGenesis: LegacyFigureProfile = {
    id: "joseph-genesis",
    slug: "joseph-genesis",
    displayNameZh: "创世·约瑟",
    englishName: "Joseph (son of Jacob)",
    aliasesZh: ["雅各的儿子"],
    identityType: "split",
    importanceTier: "core",
    profileStatus: "legacy_imported",
    primaryBookId: "GEN",
    bookIds: ["GEN", "1CH", "EXO", "NUM", "DEU", "JOS"],
    characterRoleZh: "主人物",
    scripturePersonalityZh: "创世记后半的重要人物，受苦、升高和家族进入埃及的叙事都围绕他展开。",
    periodLabelZh: "族长时期",
    lifespanZh: merged?.lifespanZh ?? "活了110岁",
    managementNoteZh: "自旧 V2「约瑟」档案拆分；创世记人物。",
    linkedArticleSlug: patriarchArticle.slug,
    article: {
      ...patriarchArticle,
      title: "创世·约瑟：有远见的忠诚者",
      summary:
        "创世·约瑟是雅各的儿子，被兄弟们卖至埃及后升高为宰相，在饥荒中保全家族，显明信靠与宽恕。",
    },
  };

  const josephGospel: LegacyFigureProfile = {
    id: "joseph-gospel",
    slug: "joseph-gospel",
    displayNameZh: "福音·约瑟",
    englishName: "Joseph (husband of Mary)",
    aliasesZh: ["马利亚的丈夫"],
    identityType: "split",
    importanceTier: "supporting",
    profileStatus: "legacy_imported",
    primaryBookId: "MAT",
    bookIds: ["MAT", "LUK"],
    characterRoleZh: "相关人物",
    scripturePersonalityZh: "大卫后裔、马利亚的丈夫；在耶稣降生叙事中顺服神，抚养神子。",
    periodLabelZh: "福音书时代",
    lifespanZh: "不详",
    managementNoteZh: "自旧 V2「约瑟」档案拆分；福音书人物。",
    linkedArticleSlug: GOSPEL_JOSEPH_ARTICLE.slug,
    article: GOSPEL_JOSEPH_ARTICLE,
  };

  return [...rest, josephGenesis, josephGospel];
}

function isMergedZechariahProfile(profile: LegacyFigureProfile): boolean {
  return profile.id === "zechariah" || profile.slug === "figure-zechariah";
}

const ZECHARIAH_LUKE_ARTICLE = makeLegacyFigureArticle(
  "figure-zechariah-luke",
  "路加·撒迦利亚：施洗约翰的父亲",
  "路加·撒迦利亚是亚比雅班祭司，施洗约翰的父亲；在路加 1 章因不信受罚，后认信称颂神。",
  `## 一、人物概览
路加·撒迦利亚仅见于《路加福音》第 1 章，与《撒迦利亚书》先知并非同一人。他是祭司，与妻以利沙伯在年老时得子约翰。

## 二、人物首次出现
路加 1:5-25 记载他在圣殿事奉时，天使加百列预告约翰出生；他因不信暂时失语，直到孩子命名时恢复并预言。

## 三、与其他「撒迦利亚」的分别
- **先知·撒迦利亚**：《撒迦利亚书》作者，被掳归回后的先知。
- **路加·撒迦利亚**：施洗约翰之父，仅见《路加福音》1 章。

## 四、相关重要经文
- 路加 1:5-25
- 路加 1:57-80`,
);

function expandZechariahProfiles(profiles: LegacyFigureProfile[]): LegacyFigureProfile[] {
  const merged = profiles.find(isMergedZechariahProfile);
  const rest = profiles.filter((profile) => !isMergedZechariahProfile(profile));

  const prophetArticle =
    merged?.article
    ?? makeLegacyFigureArticle(
      "figure-zechariah",
      "先知·撒迦利亚：信靠神的启示先知",
      "先知·撒迦利亚是《撒迦利亚书》作者，在被掳归回时代传达复兴与弥赛亚盼望。",
      "（见原 figure-zechariah 文章。）",
    );

  const zechariahProphet: LegacyFigureProfile = {
    id: "zechariah-prophet",
    slug: "zechariah-prophet",
    displayNameZh: "先知·撒迦利亚",
    englishName: "Zechariah the prophet",
    aliasesZh: [],
    identityType: "split",
    importanceTier: "supporting",
    profileStatus: "legacy_imported",
    primaryBookId: "ZEC",
    bookIds: ["ZEC"],
    characterRoleZh: "主人物",
    scripturePersonalityZh: "被掳归回后的关键先知人物，与异象、安慰和将来盼望有关。",
    periodLabelZh: "小先知时期",
    lifespanZh: merged?.lifespanZh ?? "不详",
    managementNoteZh: "自旧 V2「撒迦利亚」档案拆分；先知书作者。",
    linkedArticleSlug: prophetArticle.slug,
    article: {
      ...prophetArticle,
      title: "先知·撒迦利亚：信靠神的启示先知",
      summary:
        "先知·撒迦利亚是《撒迦利亚书》作者，在被掳归回时代传达复兴、重建与弥赛亚盼望。",
    },
  };

  const zechariahLuke: LegacyFigureProfile = {
    id: "zechariah-luke",
    slug: "zechariah-luke",
    displayNameZh: "路加·撒迦利亚",
    englishName: "Zechariah (father of John)",
    aliasesZh: ["施洗约翰的父亲"],
    identityType: "split",
    importanceTier: "supporting",
    profileStatus: "legacy_imported",
    primaryBookId: "LUK",
    bookIds: ["LUK"],
    characterRoleZh: "相关人物",
    scripturePersonalityZh: "亚比雅班祭司，施洗约翰之父；路加 1 章的降生叙事核心人物之一。",
    periodLabelZh: "福音书时代",
    lifespanZh: "不详",
    managementNoteZh: "自旧 V2「撒迦利亚」档案拆分；路加福音人物。",
    linkedArticleSlug: ZECHARIAH_LUKE_ARTICLE.slug,
    article: ZECHARIAH_LUKE_ARTICLE,
  };

  return [...rest, zechariahProphet, zechariahLuke];
}

function isMergedJacobProfile(profile: LegacyFigureProfile): boolean {
  return profile.id === "jacob" || profile.slug === "figure-jacob";
}

const JAMES_APOSTLE_ARTICLE = makeLegacyFigureArticle(
  "figure-james-apostle",
  "雅各书·雅各：主的兄弟",
  "雅各书·雅各是耶路撒冷教会领袖，《雅各书》作者；传统上视为耶稣的兄弟，亦见于使徒行传。",
  `## 一、人物概览
雅各书·雅各（英文 James）与创世记里的族长雅各并非同一人。新约中他是耶路撒冷教会的领袖，《雅各书》署名作者，并在使徒行传 15 章主持耶路撒冷大会。

## 二、人物首次出现
使徒行传 12:17 与 15:13 提到雅各在教会中的权威；雅各书 1:1 自称「神与主耶稣基督的仆人雅各」。

## 三、身份与背景
加拉太 1:19 提到「主的兄弟雅各」。其具体家世在圣经中未详述，传统上常与耶稣家族成员联系。

## 四、与其他「雅各」的分别
- **族长·雅各**：以撒的儿子、以色列始祖，见《创世记》。
- **雅各书·雅各**：新约书信作者与耶路撒冷领袖，见《雅各书》《使徒行传》。

## 五、相关重要经文
- 雅各书 1:1
- 使徒行传 12:17
- 使徒行传 15:13-21
- 加拉太 1:19`,
);

function expandJacobProfiles(profiles: LegacyFigureProfile[]): LegacyFigureProfile[] {
  const merged = profiles.find(isMergedJacobProfile);
  const rest = profiles.filter((profile) => !isMergedJacobProfile(profile));

  const patriarchArticle =
    merged?.article
    ?? makeLegacyFigureArticle(
      "figure-jacob",
      "族长·雅各：以奋斗为名的族长",
      "族长·雅各是以撒的儿子，后改名以色列，十二支派始祖。",
      "（见原 figure-jacob 文章。）",
    );

  const jacobPatriarch: LegacyFigureProfile = {
    id: "jacob-patriarch",
    slug: "jacob-patriarch",
    displayNameZh: "族长·雅各",
    englishName: "Jacob",
    aliasesZh: ["以色列"],
    identityType: "split",
    importanceTier: "core",
    profileStatus: "legacy_imported",
    primaryBookId: "GEN",
    bookIds: ["GEN", "1CH", "2CH", "ISA", "JER", "HOS", "OBA"],
    characterRoleZh: "主人物",
    scripturePersonalityZh: "族长时代的核心人物，改名以色列、家族扩展和十二支派主线都与他相关。",
    periodLabelZh: "族长时期",
    lifespanZh: merged?.lifespanZh ?? "活了147岁",
    managementNoteZh: "自旧 V2「雅各」档案拆分；创世记族长。",
    linkedArticleSlug: patriarchArticle.slug,
    article: {
      ...patriarchArticle,
      title: "族长·雅各：以奋斗为名的族长",
      summary:
        "族长·雅各是以撒的儿子，后改名以色列；其家族叙事贯穿《创世记》，是以色列十二支派的始祖。",
    },
  };

  const jamesApostle: LegacyFigureProfile = {
    id: "james-apostle",
    slug: "james-apostle",
    displayNameZh: "雅各书·雅各",
    englishName: "James (brother of the Lord)",
    aliasesZh: ["主的兄弟"],
    identityType: "split",
    importanceTier: "core",
    profileStatus: "legacy_imported",
    primaryBookId: "JAS",
    bookIds: ["JAS", "ACT", "GAL"],
    characterRoleZh: "主人物",
    scripturePersonalityZh: "耶路撒冷教会领袖，《雅各书》作者；传统上视为耶稣的兄弟。",
    periodLabelZh: "使徒时代",
    lifespanZh: "不详",
    managementNoteZh: "自旧 V2「雅各」档案拆分；新约人物。",
    linkedArticleSlug: JAMES_APOSTLE_ARTICLE.slug,
    article: JAMES_APOSTLE_ARTICLE,
  };

  return [...rest, jacobPatriarch, jamesApostle];
}

function applyLegacyFigurePreviewPatches(profiles: LegacyFigureProfile[]): LegacyFigureProfile[] {
  return profiles.map((profile) => {
    if (
      isMergedJudahProfile(profile)
      || isMergedPharaohProfile(profile)
      || isMergedJosephProfile(profile)
      || isMergedZechariahProfile(profile)
      || isMergedJacobProfile(profile)
    ) {
      return profile;
    }

    const isApostleJohn = profile.id === "约翰" || profile.slug === "figure-约翰";
    if (isApostleJohn) {
      const johnBookIds = ["JHN", "ACT", "1JN", "2JN", "3JN", "REV"] as const;
      const otherBookIds = profile.bookIds.filter(
        (bookId) => !johnBookIds.includes(bookId as (typeof johnBookIds)[number]),
      );

      return {
        ...profile,
        primaryBookId: "JHN",
        bookIds: [...johnBookIds, ...otherBookIds],
        periodLabelZh: "福音书时代",
        scripturePersonalityZh:
          "使徒约翰，耶稣所爱的门徒；传统上视为约翰福音、书信与启示录的作者。",
      };
    }

    if (profile.id === "jesus" || profile.slug === "figure-jesus") {
      return {
        ...profile,
        importanceTier: "core",
        primaryBookId: "MAT",
        bookIds: ["MAT", "MRK", "LUK", "JHN", "ACT", "REV"],
      };
    }

    if (profile.id === "joshua" || profile.slug === "figure-joshua") {
      return {
        ...profile,
        importanceTier: "core",
        primaryBookId: "JOS",
        bookIds: ["NUM", "DEU", "JOS"],
      };
    }

    return profile;
  });
}

/** 合并孤儿文章：补绑已有档案，或按书卷生成仅文章条目。 */
export function buildLegacyFiguresForBookTable(cwd = process.cwd()): LegacyFigureProfile[] {
  const profiles = expandJacobProfiles(
    expandZechariahProfiles(
      expandJosephProfiles(
        expandPharaohProfiles(
          expandJudahProfiles(
            applyLegacyFigurePreviewPatches(
              readLegacyFigureProfiles(cwd).map((profile) => ({ ...profile })),
            ),
          ),
          cwd,
        ),
      ),
    ),
  );
  const orphans = readLegacyFigureOrphanArticles(cwd);

  for (const orphan of orphans) {
    const bindTarget = ORPHAN_ARTICLE_PROFILE_BINDINGS[orphan.slug];
    if (bindTarget) {
      const profile = profiles.find(
        (item) => item.id === bindTarget || item.slug === bindTarget,
      );
      if (profile && !profile.linkedArticleSlug) {
        profile.linkedArticleSlug = orphan.slug;
        profile.article = orphan;
      }
      continue;
    }

    const assignment = ORPHAN_ARTICLE_BOOK_ASSIGNMENTS[orphan.slug];
    if (assignment) {
      profiles.push(profileFromOrphanArticle(orphan, assignment));
    }
  }

  return profiles;
}

export function legacyFigureEntryHref(
  profile: Pick<LegacyFigureProfile, "profileStatus" | "linkedArticleSlug" | "slug">,
): string {
  if (profile.profileStatus === "article_only") {
    return `/explore/figures/article/${profile.linkedArticleSlug}`;
  }
  return `/explore/figures/${profile.slug}`;
}

export function groupLegacyFigureProfiles(profiles: LegacyFigureProfile[]): Array<{
  groupId: string;
  groupLabel: string;
  items: LegacyFigureProfile[];
}> {
  const linked = profiles.filter((p) => p.linkedArticleSlug);
  const unlinked = profiles.filter((p) => !p.linkedArticleSlug);
  const groups: Array<{ groupId: string; groupLabel: string; items: LegacyFigureProfile[] }> = [];

  if (linked.length) {
    groups.push({
      groupId: "linked",
      groupLabel: "已绑文章",
      items: linked,
    });
  }
  if (unlinked.length) {
    groups.push({
      groupId: "unlinked",
      groupLabel: "档案在、未绑文章",
      items: unlinked,
    });
  }
  return groups;
}

export type LegacyFigureBookRow = {
  bookNumber: number;
  bookId: string;
  bookName: string;
  testament: "old" | "new";
  eraCompact: string;
  eraAria: string;
  /** 主、次人物合并，按本卷出现顺序排列 */
  figures: LegacyFigureProfile[];
};

export function isLegacyFigurePrimary(
  profile: Pick<LegacyFigureProfile, "characterRoleZh">,
) {
  return profile.characterRoleZh !== "相关人物";
}

function profileBelongsToBook(
  profile: LegacyFigureProfile,
  bookId: string,
  displayBookIds?: ReadonlySet<string>,
): boolean {
  const normalizedBookId = bookId.trim().toUpperCase();
  const bookIds = displayBookIds ?? new Set(resolveLegacyFigureDisplayBookIds(profile));
  return bookIds.has(normalizedBookId);
}

/** 按正典书卷顺序列出各卷人物（首次出现 + 各卷主人物；按出现顺序排序）。 */
export function groupLegacyFiguresByBook(
  profiles: LegacyFigureProfile[],
): LegacyFigureBookRow[] {
  const displayBookIdsByProfileId = new Map<string, ReadonlySet<string>>(
    profiles.map((profile) => [
      profile.id,
      new Set(resolveLegacyFigureDisplayBookIds(profile)),
    ]),
  );

  return scriptureBooks.map((book) => {
    const bookProfiles = profiles.filter((profile) =>
      profileBelongsToBook(
        profile,
        book.bookId,
        displayBookIdsByProfileId.get(profile.id),
      ),
    );
    const figures = sortLegacyFiguresByBookAppearance(bookProfiles, book.bookId);

    return {
      bookNumber: book.bookNumber,
      bookId: book.bookId,
      bookName: book.bookName,
      testament: testamentForBookNumber(book.bookNumber),
      eraCompact: formatBibleBookHistoryEraCompact(book.bookId),
      eraAria: formatBibleBookHistoryEraAriaZh(book.bookId),
      figures,
    };
  });
}

export function legacyFigureBookRowsWithCharacters(rows: LegacyFigureBookRow[]) {
  return rows.filter((row) => row.figures.length > 0);
}

export { OLD_TESTAMENT_MAX_BOOK_NUMBER };
