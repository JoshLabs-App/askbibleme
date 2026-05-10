/**
 * AI 反思生成：第一阶段为本地模拟；第二阶段替换为真实 API。
 *
 * **Minimal**：先直接回应问题；mock 阶段对中文输入给足篇幅做产品向分析，不做人读字数上限（仅防异常超长硬截断）。
 * **Reflective**：「判断 / 原因 / 建议」三段各自展开，可长文分析。
 * **Deep**：分层上下文 + 对照；正文摘录仍可有上限以免撑爆内存。
 */

import { STUDIO_DOC_ENTRIES } from "@/lib/studio-config";
import type { StudioDocId } from "@/lib/studio-config";
import type {
  AIReflection,
  AIStudioResponseMode,
  DiscussionRole,
  DiscussionRoleConfig,
} from "./discussion-types";
import { DEFAULT_DISCUSSION_ROLE_CONFIGS } from "./discussion-types";

export type ReflectionContext = {
  currentDocId: StudioDocId;
  currentDocBody: string;
  allDocBodies: Record<string, string>;
  recentDiscussion?: string;
  assembledPrompt?: string;
  detectedTopics?: string[];
  relatedThreadSlugs?: string[];
  /** 默认 `minimal` */
  responseMode?: AIStudioResponseMode;
  /** 讨论角色；真实 API 时写入 system prompt */
  discussionRole?: DiscussionRole;
  /** 侧栏可编辑的角色配置；缺省用代码内默认 */
  discussionRoleConfigs?: DiscussionRoleConfig[];
};

function discussionRoleSnapshots(
  ctx: ReflectionContext,
  role: DiscussionRole,
): Pick<AIReflection, "discussionRoleLabelSnapshot" | "discussionRoleRulesSnapshot"> {
  const list = ctx.discussionRoleConfigs ?? DEFAULT_DISCUSSION_ROLE_CONFIGS;
  const row = list.find((c) => c.id === role);
  if (!row) return {};
  return {
    discussionRoleLabelSnapshot: row.label,
    discussionRoleRulesSnapshot: row.rules,
  };
}

const KEYWORD_DOC_HINTS: { keys: string[]; docIds: StudioDocId[] }[] = [
  { keys: ["愿景", "vision", "存在", "不是什么"], docIds: ["01-vision"] },
  { keys: ["用户", "心理", "手机", "现代人"], docIds: ["02-user-psychology"] },
  { keys: ["原则", "宪法", "不可"], docIds: ["03-principles"] },
  { keys: ["体验", "ux", "气质", "节奏"], docIds: ["04-ux-philosophy"] },
  { keys: ["安静", "陪伴", "情绪", "停留"], docIds: ["05-emotional-design"] },
  { keys: ["journey", "旅程", "回来"], docIds: ["06-journey-system"] },
  { keys: ["内容", "ai 味", "说教", "克制"], docIds: ["07-content-rules"] },
  { keys: ["mvp", "范围", "不做", "第一阶段"], docIds: ["08-mvp-scope"] },
  { keys: ["危险", "跑偏", "工具", "百科", "蔓延"], docIds: ["09-dangerous-directions"] },
  { keys: ["以后", "停车场", "想法", "暂不"], docIds: ["10-parking-lot"] },
];

function pickRelatedDocIds(input: string, currentDocId: StudioDocId): StudioDocId[] {
  const lower = input.toLowerCase();
  const set = new Set<StudioDocId>();
  set.add(currentDocId);
  for (const row of KEYWORD_DOC_HINTS) {
    if (row.keys.some((k) => lower.includes(k.toLowerCase()))) {
      row.docIds.forEach((id) => set.add(id));
    }
  }
  const ordered = STUDIO_DOC_ENTRIES.map((e) => e.id).filter((id) => set.has(id));
  return ordered.slice(0, 5);
}

function clip(s: string, max: number): string {
  const t = s.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

/** 人读 partnerReply 安全上限（真实 API 返回异常时兜底）；正常 mock 不触顶。 */
const PARTNER_REPLY_SAFETY_MAX = 28_000;

/** 无 CJK → Product Partner 用英文；中文输入始终走中文分析。 */
function wantsEnglishPartnerVoice(input: string): boolean {
  if (/[\u3000-\u303F\u4e00-\u9fff\u3400-\u4dbf]/.test(input)) return false;
  return /[a-zA-Z]{2,}/.test(input);
}

const ZH_DEEP_PRODUCT_ANCHOR = `
再往深处对齐 Selah.my 的主线：不是在证明自己「懂圣经」或「料多」，而是让一个人更愿意、更安静、更习惯地回到经文本身。任何一个新入口，都要被放到这条轴上量——它是缩短还是拉长了从「打开」到「眼睛落在经文上」的路径？会不会把用户的心流从「读」悄悄换成「逛」「收藏」「看懂整个叙事」？

还有一层容易被低估的代价：心理预算。界面每多一个「看起来像目的地」的东西，用户就要多花一次决策成本；这笔账在首页最亏，因为你付不起他们第二次犹豫。宁可把野心拆进停车场或二级实验，也别在主叙事里用「万一有人要」站稳脚跟。

若你愿意把它当成严肃产品讨论，可以把验证拆成三条可观察的标准：主入口十秒内视线先落在哪；离开前最后一步是不是在为「明天继续」铺路；如果把这功能关掉，核心体验是否几乎不变甚至更轻松——第三条若成立，它就更该留在边缘或停车场，而不是舍不得砍的「特色」。
`.trim();

const ZH_DEEP_GATEKEEPER_ANCHOR = `
把关时我会反复对照「危险方向」那条线：工具化、百科感、游戏化、Dashboard 化、导师腔——不是贴标签，而是看用户的时间最后被谁收割。若一个想法让用户更忙、更想找「下一个更好用的入口」、更不像在安静读经，它就已经在偏移核心。

膨胀往往从「很合理的小功能」开始叠起来。每加一块，单独看都说得通；合在一起就变成认知负荷和身份漂移。硬边界是：砍掉一半之后，「重新进入圣经」这句话还能不能站得住；站不住，就不是微调 UI，而是叙事层级要收回。
`.trim();

const ZH_DEEP_USER_LENS_ANCHOR = `
站在用户一侧，我不先谈愿景，只谈感受：第一眼是放松还是紧？读完这一轮，知不知道下一步该点哪里？关掉 app 之后，明天有没有一个足够轻的理由愿意再开？如果三个里有两个含糊，这个功能再「有教育意义」也只是在消耗信任。

「安静进入感」不是少按钮那么简单，而是用户心里有没有被推销、被考核、被展示的压力。任何像展厅、像任务列表、像成就墙的东西，都会悄悄抬高这种压力——所以要把它当成心流成本，而不只是信息架构问题。
`.trim();

function appendZhDeep(base: string, kind: "product" | "gate" | "user"): string {
  const tail =
    kind === "product"
      ? ZH_DEEP_PRODUCT_ANCHOR
      : kind === "gate"
        ? ZH_DEEP_GATEKEEPER_ANCHOR
        : ZH_DEEP_USER_LENS_ANCHOR;
  return `${base.trim()}\n\n${tail}`;
}

function looksDarkReadingUi(input: string): boolean {
  const dark =
    /黑|暗色|深色|夜间|夜晚|dark|night|oled|背影|背景/i.test(input) ||
    input.toLowerCase().includes("black");
  const reading = /读|阅读|经文|页面|屏|界面|ui|排版/i.test(input);
  return dark && reading;
}

/** Minimal：直接短答，不按固定三段输出。 */
function pickMinimalDirectAnswer(input: string): string {
  const t = input.trim();
  if (!t) return "先写一句具体问题，我再短答。";

  if (/模板|机械|重复|三段|核心洞察|风险|下一步/.test(t)) {
    return "对，那种固定「洞察 / 风险 / 下一步」会像咨询模板。这里已改成：先直接答你问的那件事；只有问题本身适合拆时再用结构。";
  }

  if (/疲劳|过载|太多|啰嗦|冗长|克制|少说|节奏|信息.{0,4}多|教授/.test(t)) {
    if (wantsEnglishPartnerVoice(t)) {
      return (
        "Information overload is a tradeoff problem: fewer generic sentences, more falsifiable claims. " +
        "Do not hide 'we have not talked to users yet' behind longer answers."
      );
    }
    return appendZhDeep(
      "信息节奏问题本质是取舍：少一句泛论，多一句可验证。别用更长回复掩盖「还没去问用户」。当你觉得必须写长，往往是在用叙述密度替代决策——把长文拆成三条可被数据或访谈否定的句子，会痛，但那才是产品合伙人的工作方式。",
      "product",
    );
  }

  if (/studio|讨论区|上下文|记忆|分层|thread/i.test(t)) {
    if (wantsEnglishPartnerVoice(t)) {
      return (
        "Studio is a collaboration surface, not the product. Do not let it eat the time you need to validate whether people come back tomorrow. " +
        "Keep the tool convenient; do not let it become another workstation that steals attention from Scripture re-entry."
      );
    }
    return appendZhDeep(
      "Studio 是协作面，不是产品本身。别让它吃掉你验证「用户第二天愿不愿意回来」的时间；工具顺手即可，别堆成另一个工作台。讨论区越聪明，越容易把团队注意力从「读经心流」偷换成「文档心流」——这两件事相关，但不能互换。",
      "product",
    );
  }

  if (
    /博物馆|museum|展览馆|exhibit|gallery|策展|curation/i.test(t) &&
    /圣经|bible|scripture|经文/i.test(t)
  ) {
    if (wantsEnglishPartnerVoice(t)) {
      return (
        "Hard no on letting this own the home story. A Bible museum reads like browsing and exhibition—it competes with quiet re-entry into text. " +
        "If you keep it at all, make it a thin secondary lane and prove it pulls people into Scripture, not around it.\n\n" +
        "Second layer: exhibition defaults train the muscle of scanning, labeling, and finishing a tour. Scripture re-entry trains returning to the same quiet anchor. " +
        "Those muscles fight each other when both claim the home narrative. Keep any museum-like layer optional, slow, and clearly subordinate."
      );
    }
    return appendZhDeep(
      "「圣经博物馆」我先判偏危险：逛展/百科心气会抢掉「今天继续读这里」的默认心流。要上也只能极轻、二级入口；主叙事别交给它，先放进危险方向里过一遍再动。博物馆叙事天然带着「看完、懂完、离开」的闭合感，而读经是「没看完也愿意明天再来」的开放感——两者混在同一入口，用户会不知道自己在哪一种任务里。",
      "product",
    );
  }

  if (
    wantsEnglishPartnerVoice(t) &&
    /what if|should we|why not|can we add|let'?s add|add a new|new module/i.test(t)
  ) {
    return (
      "I will still judge from the product side: new surfaces default off the hero path unless they shorten the path into Scripture. " +
      "Ship one tiny experiment with a next-day revisit signal—do not let it become a new destination first."
    );
  }

  if (/红|朱红|大红|正红|番茄红|crimson|#f{2}0000/i.test(t) && /色|颜色|用|呢|吗|好不好|行|ui|界面|按钮|主色|点缀/i.test(t)) {
    if (wantsEnglishPartnerVoice(t)) {
      return (
        "I would avoid pure red as a primary brand color: high arousal, easy to slide from calm to alarm/promo. " +
        "If you must use red, pick low-saturation clay/rose/wine tones and keep it small; keep large surfaces neutral."
      );
    }
    return appendZhDeep(
      "不建议用正红做主色：刺激度高，容易从「安静」滑向「警报/促销」。若真要红，用低饱和陶土红、干玫瑰或暗酒红，只作小面积强调或细线，大面仍用中性底。颜色不是审美偏好题，是「用户打开时神经系统先收到什么信号」——读经入口最怕被误读成任务、提醒或抢购。",
      "product",
    );
  }

  if (looksDarkReadingUi(t)) {
    if (wantsEnglishPartnerVoice(t)) {
      return (
        "Dark UI can be calm companionship or a cool tool skin—the difference is contrast density and controls. " +
        "If the screen is crowded with entry points, even a dark theme reads like an efficiency product. Reduce elements first, then tune color."
      );
    }
    return appendZhDeep(
      "深色可以做「安静陪伴」，也可以做成「酷工具皮肤」——差别在对比与控件密度。若一眼全是入口和标签，再深的色也像效率产品；先减元素，再谈配色。深色若用来藏复杂度，只会把「安静」做成「看不见」——用户仍然累，只是累得更不明显。",
      "product",
    );
  }

  if (/安静|陪伴|温和|停留|calm/i.test(t)) {
    if (wantsEnglishPartnerVoice(t)) {
      return (
        "Calm has to be perceptible: within ten seconds of opening, does the user want to keep reading or dismiss notifications? " +
        "Do not substitute more adjectives for one real trial."
      );
    }
    return appendZhDeep(
      "「安静」要落到可感知：打开后十秒内，用户是更想读下去，还是更想关掉通知。别用更多形容词替代一次真实试用。安静不是「少说话」，而是用户心里有没有被催促、被评价、被展示的压力——这压力常常来自结构，而不是来自文案长短。",
      "product",
    );
  }

  if (/journey|旅程|回来|回访/i.test(t)) {
    if (wantsEnglishPartnerVoice(t)) {
      return (
        "Journey value is willingness to return, not finishing a tour in one sitting. Validate one minimal loop: same entry, do they want to open it again the next day?"
      );
    }
    return appendZhDeep(
      "Journey 的价值在「愿意再来」，不在一次逛完。先验证一个最小闭环：同一入口、第二天是否还想点开。若旅程设计在鼓励「打卡完成」，它就已经在和「慢慢读、反复来」抢同一套动机——你要非常清楚自己到底在奖励哪一种行为。",
      "product",
    );
  }

  if (/api|实现|代码|next|react|部署|数据库|接口|bug|性能/i.test(t)) {
    if (wantsEnglishPartnerVoice(t)) {
      return (
        "Implementation first needs boundaries: sync vs async, failure degradation, where data lives. Avoid abstract layers early; one route + one storage beats three parallel stacks."
      );
    }
    return appendZhDeep(
      "实现上先定边界：同步还是异步、失败怎么降级、数据存在哪。别一上来扩抽象层；能用一个路由 + 一种存储就别拆三套。工程上的「优雅」若让用户路径变长或故障面变大，就不算优雅——Selah.my 这类产品尤其怕隐性复杂度，因为它最终都会变成界面上的犹豫。",
      "product",
    );
  }

  if (/文案|标题|语气|这句话|怎么说|改写|压缩|说教/i.test(t)) {
    if (wantsEnglishPartnerVoice(t)) {
      return (
        "Good copy is deletion: remove half the adjectives, then half the clauses. If it sounds like an internal report out loud, cut again; if it sounds like one sentence to a friend, you are close."
      );
    }
    return appendZhDeep(
      "好文案先删：删掉一半形容词，再删一半从句。读出声如果像内部汇报，就再砍；像对朋友一句提醒，多半就对了。在 Selah.my 语境里，还要多问一句：这句话是在帮用户把注意力放回经文，还是在帮团队把产品说得更体面——两者经常长得像，但目的相反。",
      "product",
    );
  }

  if (
    /原则|mvp|范围|不做|愿景|方向|功能|产品|用户|需求/i.test(t) ||
    (wantsEnglishPartnerVoice(t) &&
      /product|feature|mvp|user|users|vision|scope|direction|principle|roadmap/i.test(t))
  ) {
    if (wantsEnglishPartnerVoice(t)) {
      return (
        "Debate direction all you want—my gate is still simple: does it get someone into Scripture faster and with less UI noise? " +
        "If yes, try small; if no, parking lot—not another positioning deck.\n\n" +
        "Second pass: direction arguments often smuggle scope expansion as 'alignment'. Make the tradeoff explicit: what you will not ship this quarter, not only what you might ship."
      );
    }
    return appendZhDeep(
      "方向可以吵，但别用「再对齐愿景」逃避拍板：默认关卡是「会不会让人更快、更安静地回到经文」。会就小范围试，不会就停车场，别先用 ppt 自我说服。讨论方向时最容易丢的是「不做什么」——不做什么才是产品性格，做什么往往只是资源堆叠。",
      "product",
    );
  }

  if (t.length <= 14 && /呢|吗|？|好不好|行|ok|可以不/i.test(t)) {
    return "可以，但把约束说清楚（给谁、在哪一屏、失败时怎样），否则我只能猜。";
  }

  const hint = clip(t, 800);
  if (wantsEnglishPartnerVoice(t)) {
    return (
      `On "${hint}": default stance is still off the main path. ` +
      "Selah.my wins on quiet re-entry into Scripture—anything that feels like a new browsing layer stays small until one metric proves it deepens reading, not sightseeing.\n\n" +
      "If this is a real proposal, write one falsifiable user-behavior sentence (what they do in the first 30 seconds). If you cannot, it is not yet a product decision—only a mood."
    );
  }
  return appendZhDeep(
    `就「${hint}」我先表态：主线是安静回到经文，不是堆新栏目。细节未清之前，默认仍「别上主路径」；要试就用最小入口 + 次日回访这一类硬指标，别用展陈心流换读经心流。你不需要先把所有场景写全我才能判断——真正缺的不是信息，而是你愿意为哪一条用户行为负责。`,
    "product",
  );
}

function resolveDiscussionRole(ctx: ReflectionContext): DiscussionRole {
  return ctx.discussionRole ?? "product_partner";
}

function wantsMapOnLanding(input: string): boolean {
  const t = input.trim();
  return (
    /地图|map/i.test(t) &&
    /首页|主页|首屏|第一屏|landing|home\s*page/i.test(t)
  );
}

function pickGatekeeperMinimal(input: string): string {
  const t = input.trim();
  if (wantsMapOnLanding(t)) {
    return appendZhDeep(
      "危险。首页主放地图会把 Selah.my 推向工具化与探索平台：多看多找、少一句「今天继续读经」。认知负荷一上来，入口就被稀释。地图可以存在，但不该替用户回答「我今天从哪里开始」——那句话只能来自接续与经文本身，而不是来自「我在哪、附近有什么」。",
      "gate",
    );
  }
  if (/红|朱红|正红/i.test(t) && /色|颜色|用|ui/i.test(t)) {
    return appendZhDeep(
      "把关：正红做主色容易把「安静入口」做成促销感。对照 Principles：若坚持红，只接受低饱和、小面积；否则算核心偏移。颜色一旦触发「警报/优惠/未完成」联想，就会悄悄抬高用户防御心——这和读经需要的放松是反方向。",
      "gate",
    );
  }
  if (/游戏|积分|排行榜|勋章|成就|看板|dashboard|后台/i.test(t)) {
    return appendZhDeep(
      "把关：游戏化、Dashboard、后台叙事都在危险方向里。先问一句：这是用户真需要，还是团队觉得酷。奖励回路一旦接上，产品就会开始优化「被看见」而不是「被安静陪伴」——这条线很难走回头。",
      "gate",
    );
  }
  if (/百科|平台|工具化|功能膨胀|叠加/.test(t)) {
    return appendZhDeep(
      "把关：你在靠近平台/百科/工具箱。停一下：砍掉一半后，「重新进入圣经」这句话还成立吗？不成立就不是加功能的问题，是叙事被换掉了——换叙事比加功能更隐蔽，也更难察觉。",
      "gate",
    );
  }
  return appendZhDeep(
    `把关：对照 Vision 与 Dangerous Directions，「${clip(t, 400)}」是否在抬认知负荷或引向工具化？需要更硬的边界。若你一时说不清它属于哪一类危险，就把它当成「默认拒绝，除非能用用户行为证明例外」——证明不了就先写进停车场，而不是先占位。`,
    "gate",
  );
}

function pickUserLensMinimal(input: string): string {
  const t = input.trim();
  if (wantsMapOnLanding(t)) {
    return appendZhDeep(
      "用户第一眼可能不知道下一步点哪里。更想要一句「今天继续这里」的承接，而不是要先读懂的一张图。地图把「我在世界中的位置」推到台前时，「我在经文中的位置」就会被挤到后面——用户会觉得自己在找路，而不是在读经。",
      "user",
    );
  }
  if (/红|朱红/i.test(t) && /色|颜色/i.test(t)) {
    return appendZhDeep(
      "我会先问：打开时眼睛是放松还是紧？高饱和红容易「被推销」；若你想安静，我会偏向更哑的强调色。用户不会用设计术语描述这种紧，他们只会说「有点吵」或「不想开」——你要听的是这种粗糙信号。",
      "user",
    );
  }
  return appendZhDeep(
    `我会用三问压它：第一眼累不累？知不知道下一步？明天还愿不愿意打开——「${clip(t, 400)}」经得住再问一句。这三问不是为了打分，是为了避免我们把「教育用户」当成产品成就；用户很累的时候，不会感激你教得多，只会离开。`,
    "user",
  );
}

/** Minimal：按角色输出；中文 mock 下为长分析 + 共用深度段落。 */
function pickMinimalReplyForRole(input: string, role: DiscussionRole): string {
  if (wantsMapOnLanding(input)) {
    if (role === "product_partner") {
      return appendZhDeep(
        "可以放地图，但不要作为首页主入口。地图适合做探索层或配套线索，不适合承担第一眼「从哪里开始读经」。首页一旦变成「看世界」，用户的心流就很难再回到「看经文」——不是不能看，而是顺序错了会把产品性格写死。",
        "product",
      );
    }
    if (role === "gatekeeper") {
      return pickGatekeeperMinimal(input);
    }
    return pickUserLensMinimal(input);
  }
  if (role === "product_partner") {
    return pickMinimalDirectAnswer(input);
  }
  if (role === "gatekeeper") {
    return pickGatekeeperMinimal(input);
  }
  return pickUserLensMinimal(input);
}

function buildReflectivePartnerReply(
  input: string,
  ctx: ReflectionContext,
): string {
  const role = resolveDiscussionRole(ctx);
  const excerpt = clip(input.trim(), 800);
  const judgmentBlock = pickMinimalReplyForRole(input, role);

  if (role === "product_partner") {
    const reason = [
      "「原因」这层我会把它理解成张力来源：不是信息不足，而是优先级还没被写出来。用户在付的成本常常是连续的——每一次额外的入口、解释、图标，都在预支他们的注意力和信任。",
      `围绕你在问的「${excerpt}」，关键张力通常是：它到底是在服务「回到经文」，还是在服务「让产品看起来更完整、更有教育意义」。这两条价值观可以短期共存，但在首页和首屏层级上迟早要互相淘汰一个。`,
      "另一个容易低估的来源是团队叙事：当一个人已经投入精力去推动某个想法，讨论会慢慢从「是否值得」漂移成「怎么把它讲圆」。这时候需要的是合伙人的硬表态，而不是再补一轮背景材料——背景补得越多，表态越晚，产品就越贵。",
    ].join("\n\n");

    const advice = [
      "把它收成三件事写在 Studio 里（不要只在口头对齐）：① 默认首屏优先级怎么排；② 你愿意牺牲掉的下一个功能是什么——真的牺牲，不是口头牺牲；③ 用哪一个具体用户动作定义成败（例如「继续读昨天的进度」占比、「在经文页停留」占比）。",
      "如果三件事写完仍觉得心不定，这通常不是分析不够，而是你在回避一个更难的问题：我们是否愿意为了守卫读经入口，而拒绝一类看起来很合理的内容形态。愿意，就向 principles 靠；不愿意，就把它写进危险方向，至少别自欺欺人。",
    ].join("\n\n");

    return `**判断**\n${judgmentBlock}\n\n**原因**\n${reason}\n\n**建议**\n${advice}`;
  }

  if (role === "gatekeeper") {
    const reason = [
      "这里说的「原因」不是替用户猜需求，而是把你 proposal 里隐性携带的产品身份写出来：它更像工具、百科、游戏化系统，还是更像安静的读经入口。身份问题不会自己消失，只会被 UI 的细节一次次确认。",
      `对「${excerpt}」这一类讨论，我特别在意它有没有偷偷把成功指标换成「停留时长」「使用频次」「地图点击」这一类容易被团队庆祝、却不等于在读经的指标。`,
      "危险方向的意义，在于提前承认：有些东西在其他产品里可能是标配，但在 Selah.my 里可能是质地改变。把关不是扫兴，而是避免你们在第三年才意识到「这艘船早就不是去同一个港口」。",
    ].join("\n\n");

    const advice = [
      "建议你立刻做两步纸面动作：一是用一句话写清「我们明确不做的三件事」；二是把这条想法映射到危险方向里最接近的一条，写出「如果要做，必须满足的硬条件」。写不出来，就不具备上会资格。",
      "若团队已经很兴奋，把关者要把兴奋从「上线的快感」扭回「验收的冷静」：先小流量、先可回滚、先可关——任何不能关的功能，都不应该在早期同时承担创新实验与主叙事。",
    ].join("\n\n");

    return `**判断**\n${judgmentBlock}\n\n**原因**\n${reason}\n\n**建议**\n${advice}`;
  }

  const reason = [
    "用户视角的「原因」往往都不在功能列表里，而在连续几天的主观体验里：累不累、羞不羞、像不像在被安排、明天还想不想开。很多产品问题在讨论里会像「功能不够」，在用户那边其实只是「我不想被这软件看见」。",
    `把「${excerpt}」翻译成一个普通用户的一周：他们在什么时候会想起你？那一刻他们更需要陪伴，还是需要完成任务？如果需要完成任务，他们会不会其实已经去用更高效的工具了？`,
    "「安静进入感」经常被误读为视觉安静；更难的是关系安静——像不像一位熟悉的朋友在场，而不是一位急于展示专业的导师在场。进入感一绷，读经就会变成 performance，而不是 rest。",
  ].join("\n\n");

  const advice = [
    "找三条真实用户的原话（哪怕是聊天记录）来贴在这条想法旁边：有没有出现「不知道点哪」「算了明天再说」「我觉得有点复杂」这一类句子。若没有，你的用户视角还停留在想象层。",
    "若你已经能描述清楚下一个具体动作，把它做到极简：让用户在十秒内完成回到经文的路径，并把一切可能打断它的东西列成清单——那不是优化列表，那是你产品的良心清单。",
  ].join("\n\n");

  return `**判断**\n${judgmentBlock}\n\n**原因**\n${reason}\n\n**建议**\n${advice}`;
}

/** Deep：分层上下文 + 对照；「先回答」段随角色走完整 mock 分析。 */
function buildDeepPartnerReply(input: string, ctx: ReflectionContext): string {
  const topicHint =
    ctx.detectedTopics && ctx.detectedTopics.length > 0
      ? `（线索：${ctx.detectedTopics.slice(0, 4).join(" · ")}）`
      : "";

  const bridge = ctx.assembledPrompt?.trim()
    ? [
        "### 分层上下文（Deep）",
        topicHint,
        "",
        clip(ctx.assembledPrompt.trim(), 14_000),
        "",
        "---",
        "",
      ].join("\n")
    : ctx.recentDiscussion?.trim()
      ? [
          "### 上文摘录",
          "",
          clip(ctx.recentDiscussion.trim(), 10_000),
          "",
          "---",
          "",
        ].join("\n")
      : "";

  const direct = pickMinimalReplyForRole(input, resolveDiscussionRole(ctx));
  const snippet = clip(input, 2_000);

  if (/红|朱红|正红|番茄红/i.test(input) && /色|颜色|用|ui|界面/i.test(input)) {
    return (
      bridge +
      [
        "### 先回答你的问题",
        "",
        direct,
        "",
        "### 若你在定整套色板",
        "",
        "- 主色：低饱和中性 + 一种克制强调色即可。",
        "- 对比：阅读长文时对比宁低勿高。",
        "- 验收：打开后十秒，眼睛是放松还是紧张。",
      ].join("\n")
    );
  }

  if (looksDarkReadingUi(input)) {
    return (
      bridge +
      [
        "### 先回答",
        "",
        direct,
        "",
        "### 对照（别堆哲学，只问验收）",
        "",
        "- 控件是否一屏极少？",
        "- 深色是在服务阅读，还是在卖「酷」？",
        "- 若砍掉一半入口，体验是否仍成立？",
      ].join("\n")
    );
  }

  const docClip = clip(ctx.currentDocBody, 12_000);
  return (
    bridge +
    [
      "### 先回答",
      "",
      direct,
      "",
      "### 把你的话压成可验证句",
      "",
      snippet
        ? `你写的是：「${snippet}」——用一句可观察行为说清：打开后用户更接近经文，还是更接近逛功能。`
        : "先给默认立场，再选一个最小试验去验，而不是先扩场景清单。",
      "",
      "### 与当前文档对一下（只取一句）",
      "",
      docClip ? `> ${docClip.replace(/\n/g, " ")}` : "（当前文档正文较短，可对撞材料有限。）",
    ].join("\n")
  );
}

function buildDeepStructured(input: string, ctx: ReflectionContext): Omit<
  AIReflection,
  "partnerReply" | "responseMode"
> {
  const relatedDocIds = pickRelatedDocIds(input, ctx.currentDocId);
  const threadNote =
    ctx.relatedThreadSlugs && ctx.relatedThreadSlugs.length > 0
      ? ` 线程：${ctx.relatedThreadSlugs.slice(0, 6).join(", ")}。`
      : "";

  return {
    clarifiedIntent:
      "Deep：允许展开；仍由你做最终决定。若回复变泛，把问题收窄到「一个场景、一个动作」。",
    coreInsight: pickMinimalReplyForRole(input, resolveDiscussionRole(ctx)),
    relatedDocIds,
    tensionRisk: `对照工具化、百科感、打卡叙事、导师腔——任一苗头就停手改小试验。${threadNote}`.trim(),
    suggestedNextStep:
      "把上一条判断落成可验证假设；要么写进 Principles（经得起质疑），要么 Parking Lot；别用更长回复代替去验证。若你已经进入 Deep，就把「可关、可回滚、可观察」写进同一段文字里，避免讨论停在情绪层。",
  };
}

function resolveMode(ctx: ReflectionContext): AIStudioResponseMode {
  return ctx.responseMode ?? "minimal";
}

function buildMinimalReflection(input: string, ctx: ReflectionContext): AIReflection {
  const role = resolveDiscussionRole(ctx);
  const raw = pickMinimalReplyForRole(input, role);
  const partnerReply =
    raw.length > PARTNER_REPLY_SAFETY_MAX
      ? clip(raw, PARTNER_REPLY_SAFETY_MAX)
      : raw;
  const relatedDocIds = pickRelatedDocIds(input, ctx.currentDocId);
  const parts = partnerReply.split(/(?<=[。！？])\s*/).filter(Boolean);
  return {
    responseMode: "minimal",
    discussionRole: role,
    partnerReply,
    clarifiedIntent:
      "（折叠）本轮为 Minimal：mock 下可对中文输入给出较长分析；接入真实 API 后由模型与你在 Studio 里约定的 system prompt 控制篇幅。",
    coreInsight: parts[0] ?? partnerReply,
    tensionRisk: parts[1] ?? "",
    suggestedNextStep: parts[2] ?? "",
    relatedDocIds,
    ...discussionRoleSnapshots(ctx, role),
  };
}

function buildReflectiveReflection(input: string, ctx: ReflectionContext): AIReflection {
  const partnerReply = buildReflectivePartnerReply(input, ctx);
  const role = resolveDiscussionRole(ctx);
  const relatedDocIds = pickRelatedDocIds(input, ctx.currentDocId);
  const judgment = partnerReply.split(/\*\*原因\*\*/)[0]?.replace(/\*\*判断\*\*\s*/, "").trim() ?? partnerReply;
  const rest = partnerReply.split(/\*\*原因\*\*/)[1] ?? "";
  const reason = rest.split(/\*\*建议\*\*/)[0]?.trim() ?? "";
  const advice = rest.split(/\*\*建议\*\*/)[1]?.trim() ?? "";
  return {
    responseMode: "reflective",
    discussionRole: role,
    partnerReply,
    clarifiedIntent:
      "（折叠）Reflective：判断 / 原因 / 建议三段各自展开；mock 下篇幅较长，接入 API 后可再收紧。",
    coreInsight: judgment,
    tensionRisk: reason,
    suggestedNextStep: advice,
    relatedDocIds,
    ...discussionRoleSnapshots(ctx, role),
  };
}

/**
 * 模拟 AI：按回应模式返回；默认 Minimal（短答，非模板）。
 */
export async function generateAIReflection(
  input: string,
  ctx: ReflectionContext,
): Promise<AIReflection> {
  await new Promise((r) => window.setTimeout(r, 380));
  const mode = resolveMode(ctx);

  if (mode === "minimal") {
    return buildMinimalReflection(input, ctx);
  }
  if (mode === "reflective") {
    return buildReflectiveReflection(input, ctx);
  }

  const partnerReply = buildDeepPartnerReply(input, ctx);
  const rest = buildDeepStructured(input, ctx);
  const role = resolveDiscussionRole(ctx);
  return {
    responseMode: "deep",
    discussionRole: role,
    partnerReply,
    ...rest,
    ...discussionRoleSnapshots(ctx, role),
  };
}

/**
 * 「改写更短」：压成 1–2 句，不保留三段式标签。
 */
export function mockRewriteShorter(reflection: AIReflection): string {
  const raw = reflection.partnerReply
    .replace(/\*\*判断\*\*|\*\*原因\*\*|\*\*建议\*\*/g, "")
    .replace(/#{1,6}\s+/g, "")
    .replace(/\n+/g, " ")
    .trim();
  return clip(raw, 140);
}
