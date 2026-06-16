export type AboutPrinciple = {
  title: string;
  body: string;
};

export type AboutHighlight = {
  eyebrow: string;
  title: string;
  body: string;
};

export type AboutPageCopy = {
  eyebrow: string;
  tagline: string;
  lead: string;
  coreValuesHeading: string;
  coreValuesIntro: string;
  principlesHeading: string;
  principles: AboutPrinciple[];
  highlightsHeading: string;
  highlights: AboutHighlight[];
  notHeading: string;
  notIntro: string;
  notItems: string[];
  closing: string;
  ctaEnter: string;
  ctaInstall: string;
  footerFeedback: string;
  footerPrivacy: string;
  footerInstall: string;
  footerHome: string;
};

export const ABOUT_PAGE_COPY: Record<"zh-CN" | "en", AboutPageCopy> = {
  "zh-CN": {
    eyebrow: "关于 AskBible.me",
    tagline: "一个让人重新进入圣经的安静入口",
    lead:
      "不靠压力，不靠打卡。我们用音乐灵修与经文陪伴，帮助你在留白里温和地回到神话语——不是功能堆叠的 Bible App，也不是厚重的查经工具。",
    coreValuesHeading: "核心价值",
    coreValuesIntro: "这里与众不同——与首次打开 App 时看到的相同：",
    principlesHeading: "我们坚持的原则",
    principles: [
      {
        title: "进入优先于完成",
        body: "先能坐下来、能读下去，比今天读多少章更重要。",
      },
      {
        title: "陪伴优先于指导",
        body: "像同行，不像老师打分；工具退后，经文在前。",
      },
      {
        title: "留白优先于填充",
        body: "单屏聚焦、缓慢展开，不做信息轰炸。",
      },
      {
        title: "节奏优先于打卡",
        body: "允许中断、允许退出；回来是因为愿意继续，不是欠账。",
      },
    ],
    highlightsHeading: "这会如何陪伴你",
    highlights: [
      {
        eyebrow: "安静",
        title: "在主面前休息，而非世俗式「放空」",
        body:
          "自然画面与安静音乐里呈现圣经经文——帮助你在放松里重新听见神的话，回到主面前重新得力。",
      },
      {
        eyebrow: "读懂",
        title: "陪伴探索，深度按需展开",
        body:
          "读完后可按需打开发现版或讲解版：问题引导你自己思考，或克制的背景资料供参考。经文始终第一位。",
      },
      {
        eyebrow: "计划",
        title: "不怕中断的读经循环",
        body:
          "新旧约与智慧书三条独立循环，不按日历补读。播放章音频可连播当日计划；愿意回来，终会在循环中读完整本。",
      },
    ],
    notHeading: "我们不是什么",
    notIntro: "这些边界帮助我们保持核心——防止慢慢变成「又一个 Bible App」：",
    notItems: [
      "不是 Bible 工具箱或资料百科",
      "不是打卡、KPI 或厚重研经工具",
      "不是讲章平台或信息轰炸",
    ],
    closing: "你若喜欢这样的安静，就继续走。首页的自然与经文、圣经里的阅读与计划，都在这儿等你回来。",
    ctaEnter: "进入 AskBible.me",
    ctaInstall: "安装 App 测试版",
    footerFeedback: "意见反馈",
    footerPrivacy: "隐私政策",
    footerInstall: "安装说明",
    footerHome: "返回首页",
  },
  en: {
    eyebrow: "About AskBible.me",
    tagline: "A quiet entry back into Scripture",
    lead:
      "No pressure, no streaks. Devotional music and Scripture companionship help you return gently—with room to breathe—not another feature-heavy Bible app or burdensome study tool.",
    coreValuesHeading: "Core values",
    coreValuesIntro: "What makes us different—the same three promises you see when you first open the app:",
    principlesHeading: "Principles we keep",
    principles: [
      {
        title: "Entry before completion",
        body: "Showing up and staying with a passage matters more than how many chapters you finish today.",
      },
      {
        title: "Companion before coaching",
        body: "We walk alongside you; tools stay in the background and Scripture stays first.",
      },
      {
        title: "Whitespace before filling",
        body: "One focus per screen, slow unfolding—never an information dump.",
      },
      {
        title: "Rhythm before routine",
        body: "Pauses are allowed. You return because you want to continue—not because a checklist says so.",
      },
    ],
    highlightsHeading: "How we walk with you",
    highlights: [
      {
        eyebrow: "Quiet",
        title: "Rest before God, not empty mindfulness",
        body:
          "Quiet nature and music carry Scripture—space to hear God's word again and be renewed in his presence.",
      },
      {
        eyebrow: "Understand",
        title: "Companion reading, depth on demand",
        body:
          "After reading, open Discovery or Reference editions when you choose: guided questions or concise notes. Scripture stays first.",
      },
      {
        eyebrow: "Plan",
        title: "A reading loop that survives interruption",
        body:
          "Three independent tracks—Old Testament, New Testament, Wisdom—without calendar catch-up. Chapter audio can play through today's queue; keep returning and you'll finish the whole Bible in the loop.",
      },
    ],
    notHeading: "What we are not",
    notIntro: "These boundaries keep the product from drifting into \"just another Bible app\":",
    notItems: [
      "Not a Bible toolbox or encyclopedia",
      "Not streaks, KPIs, or heavy study tools",
      "Not a sermon platform or information dump",
    ],
    closing:
      "If this kind of quiet fits you, keep walking. Nature and verses on the home screen, reading and plans in Scripture—they wait whenever you return.",
    ctaEnter: "Enter AskBible.me",
    ctaInstall: "Install the beta app",
    footerFeedback: "Feedback",
    footerPrivacy: "Privacy",
    footerInstall: "Install guide",
    footerHome: "Back to home",
  },
};
