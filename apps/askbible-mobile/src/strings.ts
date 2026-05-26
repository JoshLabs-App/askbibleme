/**
 * 与网站 `locales/zh-CN.json` 中主导航、占位页、放松等文案对齐（原生端暂内置中文）。
 * 日后可接 i18n 或远程配置。
 */
export const strings = {
  nav: {
    home: "首页",
    journey: "旅程",
    read: "圣经",
    explore: "探索",
    music: "音乐",
    relax: "放松",
  },
  home: {
    title: "首页",
    lead: "全屏自然影像与经文轮播。",
    body: "此处为原生壳：画面与曲库将逐步与线上 AskBible.me 对齐。若你已在网站后台配置自然影片，后续版本会在此直接呈现；当前先保留安静占位。",
    loadError: "无法加载自然配置。请确认本机已运行网站（默认端口 3450）或已设置 EXPO_PUBLIC_ASKBIBLE_BASE_URL。",
    retry: "重试",
    loading: "加载中…",
    apiHint: `当前站点：开发模式见代码内默认地址；生产请配置 EXPO_PUBLIC_ASKBIBLE_BASE_URL。`,
  },
  nature: {
    emptyTitle: "仍未配置背景影片",
    emptyHint: "请在网站后台「音乐 → 自然」上传或选择影片；并确保手机能访问同一站点。",
    scenes: "场景",
  },
  music: {
    title: "音乐",
    lead: "安静回到经文的入口 — 正在成型。",
    body: "壳层播放与曲库将请求你已部署的站点 API，与网页版同源配置。当前版本不播放真实音频，仅保留导航结构。",
    openRelax: "打开放松",
  },
  journey: {
    title: "旅程",
    lead: "你若喜欢这样的安静，就继续走。",
    body: "这条路上会有更轻的同行感——不赶进度、不设清单，只占心里很小的一角。走着走着，你会陆续看见它；首页的自然与经文轮播，也一直在这儿陪你。",
  },
  read: {
    title: "圣经",
    lead: "读，可以很安静。",
    body: "这里留给「回到文字里」的那一截路：少一点嘈杂，多一点空白。你若愿意一路走下来，它会与你在首页已经遇见的那几句经文悄悄接上。",
    catalogLead: "和合本（简体）已内置，可离线阅读。选卷、选章即可开始。",
    oldTestament: "旧约",
    newTestament: "新约",
    pickChapter: "选择章节",
    closePicker: "关闭",
    resume: "继续阅读",
    backToCatalog: "书目",
    loadingChapter: "加载本章…",
    chapterLoadError: "无法读取本章。若首次安装，请重新构建应用。",
    invalidChapter: "无效的经文章节。",
    retry: "重试",
    prevChapter: "上一章",
    nextChapter: "下一章",
  },
  explore: {
    title: "探索",
    lead: "有些光，要慢慢才会亮起来。",
    body: "这里会有经得起闲逛的发现——不替你讲课，也不堆百科。你若喜欢慢慢走，转角处自然会有新的东西向你招手；音乐和放松页，也随时欢迎你。",
  },
  relax: {
    title: "放松",
    lead: "慢下来的一小段时间。",
    body: "静音画面与独立音乐层，与网站「放松」同一路线。此处为占位；后续可接同一套 relax 配置与曲目。",
  },
  chrome: {
    backHome: "返回首页",
  },
  playback: {
    noTrack: "暂无可播放曲目",
    playMusic: "播放音乐",
    pauseMusic: "暂停音乐",
  },
} as const;
