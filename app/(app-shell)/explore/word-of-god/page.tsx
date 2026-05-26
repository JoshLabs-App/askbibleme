import Link from "next/link";
import { ShellTemplateChromeLayout } from "@/components/shell/ShellTemplateChromeLayout";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

type ScriptureItem = {
  reference: string;
  excerpt: string;
};

type ScriptureCategory = {
  title: string;
  items: ScriptureItem[];
};

const WORD_OF_GOD_CATEGORIES: ScriptureCategory[] = [
  {
    title: "1. 神的话从神而来",
    items: [
      { reference: "提后 3:16-17", excerpt: "圣经都是神所默示的……都是有益的。" },
      { reference: "彼后 1:20-21", excerpt: "人被圣灵感动，说出神的话来。" },
      { reference: "帖前 2:13", excerpt: "你们领受神的道，不以为是人的道。" },
    ],
  },
  {
    title: "2. 神的话是真理",
    items: [
      { reference: "约 17:17", excerpt: "求你用真理使他们成圣；你的道就是真理。" },
      { reference: "诗 119:160", excerpt: "你话的总纲是真实。" },
      { reference: "约 10:35", excerpt: "经上的话是不能废的。" },
    ],
  },
  {
    title: "3. 神的话永远长存",
    items: [
      { reference: "赛 40:8", excerpt: "草必枯干，花必凋残；惟有我们神的话必永远立定。" },
      { reference: "太 24:35", excerpt: "天地要废去，我的话却不能废去。" },
      { reference: "彼前 1:24-25", excerpt: "惟有主的道是永存的。" },
    ],
  },
  {
    title: "4. 神的话创造万有",
    items: [
      { reference: "创 1:3", excerpt: "神说：要有光，就有了光。" },
      { reference: "诗 33:9", excerpt: "因为他说有，就有；命立，就立。" },
      { reference: "来 11:3", excerpt: "诸世界是借神话造成的。" },
    ],
  },
  {
    title: "5. 神的话有能力",
    items: [
      { reference: "来 4:12", excerpt: "神的道是活泼的，是有功效的。" },
      { reference: "耶 23:29", excerpt: "我的话岂不像火，又像能打碎磐石的大锤吗？" },
      { reference: "赛 55:11", excerpt: "我口所出的话决不徒然返回。" },
    ],
  },
  {
    title: "6. 神的话赐生命",
    items: [
      { reference: "约 6:63", excerpt: "我对你们所说的话就是灵，就是生命。" },
      { reference: "太 4:4", excerpt: "人活着……乃是靠神口里所出的一切话。" },
      { reference: "彼前 1:23", excerpt: "你们蒙了重生，是借着神活泼常存的道。" },
    ],
  },
  {
    title: "7. 神的话使人得救",
    items: [
      { reference: "罗 10:17", excerpt: "信道是从听道来的。" },
      { reference: "雅 1:21", excerpt: "领受那所栽种的道，就是能救你们灵魂的道。" },
      { reference: "提后 3:15", excerpt: "这圣经能使你……有得救的智慧。" },
    ],
  },
  {
    title: "8. 神的话使人成圣",
    items: [
      { reference: "约 17:17", excerpt: "求你用真理使他们成圣；你的道就是真理。" },
      { reference: "约 15:3", excerpt: "你们因我讲给你们的道，已经干净了。" },
      { reference: "弗 5:26", excerpt: "要用水借着道把教会洗净，成为圣洁。" },
    ],
  },
  {
    title: "9. 神的话光照引导",
    items: [
      { reference: "诗 119:105", excerpt: "你的话是我脚前的灯，是我路上的光。" },
      { reference: "诗 119:130", excerpt: "你的言语一解开，就发出亮光。" },
      { reference: "箴 6:23", excerpt: "诫命是灯，法则是光。" },
    ],
  },
  {
    title: "10. 神的话赐智慧",
    items: [
      { reference: "诗 19:7", excerpt: "耶和华的法度确定，能使愚人有智慧。" },
      { reference: "诗 119:98-100", excerpt: "你的命令……使我有智慧。" },
      { reference: "箴 2:6", excerpt: "耶和华赐人智慧。" },
    ],
  },
  {
    title: "11. 神的话责备归正",
    items: [
      { reference: "提后 3:16", excerpt: "于教训、督责、使人归正、教导人学义都是有益的。" },
      { reference: "诗 19:7", excerpt: "耶和华的律法全备，能苏醒人心。" },
      { reference: "诗 119:11", excerpt: "我将你的话藏在心里，免得我得罪你。" },
    ],
  },
  {
    title: "12. 神的话成为粮食",
    items: [
      { reference: "太 4:4", excerpt: "人活着……乃是靠神口里所出的一切话。" },
      { reference: "耶 15:16", excerpt: "我得着你的言语就当食物吃了。" },
      { reference: "彼前 2:2", excerpt: "要爱慕那纯净的灵奶。" },
    ],
  },
  {
    title: "13. 神的话成为兵器",
    items: [
      { reference: "弗 6:17", excerpt: "拿着圣灵的宝剑，就是神的道。" },
      { reference: "来 4:12", excerpt: "神的道比一切两刃的剑更快。" },
      { reference: "太 4:4,7,10", excerpt: "耶稣三次说：经上记着说。" },
    ],
  },
  {
    title: "14. 神的话带来盼望",
    items: [
      { reference: "罗 15:4", excerpt: "叫我们因圣经所生的忍耐和安慰，可以得着盼望。" },
      { reference: "诗 119:49-50", excerpt: "这话将我救活了；我在患难中因此得安慰。" },
      { reference: "诗 119:81", excerpt: "我心渴想你的救恩，仰望你的应许。" },
    ],
  },
  {
    title: "15. 神的话带来喜乐",
    items: [
      { reference: "诗 119:103", excerpt: "你的言语……比蜜更甜。" },
      { reference: "耶 15:16", excerpt: "你的言语是我心中的欢喜快乐。" },
      { reference: "诗 19:8", excerpt: "耶和华的训词正直，能快活人的心。" },
    ],
  },
  {
    title: "16. 神的话纯净完全",
    items: [
      { reference: "诗 12:6", excerpt: "耶和华的言语是纯净的言语。" },
      { reference: "诗 19:7", excerpt: "耶和华的律法全备。" },
      { reference: "箴 30:5", excerpt: "神的言语句句都是炼净的。" },
    ],
  },
  {
    title: "17. 神的话不可增减",
    items: [
      { reference: "申 4:2", excerpt: "你们不可加添，也不可删减。" },
      { reference: "箴 30:6", excerpt: "祂的言语，你不可加添。" },
      { reference: "启 22:18-19", excerpt: "若有人加添或删去，必受严厉警戒。" },
    ],
  },
  {
    title: "18. 神的话要藏在心里",
    items: [
      { reference: "诗 119:11", excerpt: "我将你的话藏在心里。" },
      { reference: "申 6:6-7", excerpt: "我今日所吩咐你的话都要记在心上。" },
      { reference: "西 3:16", excerpt: "当把基督的道理丰丰富富地存在心里。" },
    ],
  },
  {
    title: "19. 神的话要昼夜思想",
    items: [
      { reference: "书 1:8", excerpt: "这律法书不可离开你的口，总要昼夜思想。" },
      { reference: "诗 1:2", excerpt: "惟喜爱耶和华的律法，昼夜思想。" },
      { reference: "诗 119:97", excerpt: "我何等爱慕你的律法，终日不住地思想。" },
    ],
  },
  {
    title: "20. 神的话要听见并遵行",
    items: [
      { reference: "雅 1:22", excerpt: "要行道，不要单单听道。" },
      { reference: "路 11:28", excerpt: "听神之道而遵守的人有福。" },
      { reference: "太 7:24", excerpt: "凡听见我这话就去行的，好比聪明人。" },
    ],
  },
  {
    title: "21. 神的话要被传扬",
    items: [
      { reference: "提后 4:2", excerpt: "务要传道，无论得时不得时，总要专心。" },
      { reference: "可 16:15", excerpt: "你们往普天下去，传福音给万民听。" },
      { reference: "罗 10:14-15", excerpt: "没有传道的，怎能听见呢？" },
    ],
  },
  {
    title: "22. 神的话不能被捆绑",
    items: [
      { reference: "提后 2:9", excerpt: "神的道却不被捆绑。" },
      { reference: "徒 19:20", excerpt: "主的道大大兴旺，而且得胜。" },
      { reference: "徒 13:49", excerpt: "主的道传遍了那一带地方。" },
    ],
  },
  {
    title: "23. 神的话审判人",
    items: [
      { reference: "约 12:48", excerpt: "我所讲的道在末日要审判他。" },
      { reference: "来 4:12-13", excerpt: "神的道能辨明人心中的思念和主意。" },
      { reference: "启 20:12", excerpt: "死人都照他们所行的受审判。" },
    ],
  },
  {
    title: "24. 神的话见证基督",
    items: [
      { reference: "约 5:39", excerpt: "给我作见证的就是这经。" },
      { reference: "路 24:27", excerpt: "凡经上所指着自己的话，都给他们讲解明白了。" },
      { reference: "约 1:14", excerpt: "道成了肉身，住在我们中间。" },
    ],
  },
  {
    title: "25. 神的话必定应验",
    items: [
      { reference: "书 21:45", excerpt: "耶和华应许的话一句也没有落空。" },
      { reference: "太 5:18", excerpt: "律法的一点一画也不能废去，都要成全。" },
      { reference: "路 21:33", excerpt: "天地要废去，我的话却不能废去。" },
    ],
  },
  {
    title: "26. 神的话使人自由",
    items: [
      { reference: "约 8:31-32", excerpt: "你们必晓得真理，真理必叫你们得以自由。" },
      { reference: "雅 1:25", excerpt: "那全备、使人自由之律法。" },
      { reference: "诗 119:45", excerpt: "我要自由而行，因我素来考究你的训词。" },
    ],
  },
  {
    title: "27. 神的话建立人",
    items: [
      { reference: "徒 20:32", excerpt: "神恩惠的道能建立你们。" },
      { reference: "犹 1:20", excerpt: "在至圣的真道上造就自己。" },
      { reference: "西 2:6-7", excerpt: "在祂里面生根建造，信心坚固。" },
    ],
  },
  {
    title: "28. 神的话带来信心",
    items: [
      { reference: "罗 10:17", excerpt: "信道是从听道来的，听道是从基督的话来的。" },
      { reference: "约 4:41", excerpt: "因耶稣的话，信的人就更多了。" },
      { reference: "徒 4:4", excerpt: "听道之人有许多信的。" },
    ],
  },
  {
    title: "29. 神的话揭露人心",
    items: [
      { reference: "来 4:12", excerpt: "连心中的思念和主意都能辨明。" },
      { reference: "徒 2:37", excerpt: "众人听见这话，觉得扎心。" },
      { reference: "林前 14:24-25", excerpt: "他心里的隐情显露出来。" },
    ],
  },
  {
    title: "30. 特别推荐：诗篇 119",
    items: [
      { reference: "诗 119:11", excerpt: "我将你的话藏在心里，免得我得罪你。" },
      { reference: "诗 119:89", excerpt: "你的话安定在天，直到永远。" },
      { reference: "诗 119:103", excerpt: "你的言语在我口中比蜜更甜。" },
      { reference: "诗 119:105", excerpt: "你的话是我脚前的灯，是我路上的光。" },
      { reference: "诗 119:160", excerpt: "你话的总纲是真实。" },
    ],
  },
];

export const metadata = {
  title: sitePageTitle("话语之光"),
  description: "圣经不只是一本书，而是神向人说话的启示。",
};

export default function ExploreWordOfGodPage() {
  return (
    <ShellTemplateChromeLayout contentClassName="gap-0">
      <div className="mx-auto w-full max-w-3xl flex-1 px-5 pb-24 pt-6 text-ink md:px-8">
        <header className="text-center">
          <h1 className="font-serif text-[clamp(1.8rem,4.8vw,2.35rem)] font-medium leading-[1.24] tracking-[-0.015em] text-ink/92">
            话语之光
          </h1>
          <p className="mt-3 text-[15px] font-medium leading-relaxed tracking-[0.01em] text-ink/70">圣经如何描述神的话语</p>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-[1.95] text-ink/76">
            圣经不只是一本书，而是神向人说话的启示。
          </p>
          <div className="mt-5">
            <Link
              href="/explore"
              className="text-[13px] font-medium text-ink/80 underline decoration-ink/25 underline-offset-[0.2em]"
            >
              返回探索
            </Link>
          </div>
        </header>

        <section className="mt-10 space-y-4">
          {WORD_OF_GOD_CATEGORIES.map((category) => (
            <article key={category.title} className="rounded-2xl border border-ink/10 bg-canvas/55 px-5 py-4 sm:px-6">
              <h2 className="font-serif text-[1.03rem] font-medium text-ink/90">{category.title}</h2>
              <ul className="mt-3 space-y-2">
                {category.items.map((item) => (
                  <li key={`${category.title}-${item.reference}`} className="text-[14px] leading-relaxed text-ink/80">
                    <span className="font-medium text-ink/88">{item.reference}</span>
                    <span className="text-ink/70"> {" · "} </span>
                    <span>{item.excerpt}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>
      </div>
    </ShellTemplateChromeLayout>
  );
}
