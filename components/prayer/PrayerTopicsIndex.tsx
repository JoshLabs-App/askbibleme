import Link from "next/link";
import type { ReactNode } from "react";
import type { TopicPrayerCategory } from "@/lib/prayer/topic-prayer-types";

export const CATEGORY_DESC: Record<string, string> = {
  self: "在你的内心光景中，带着真实的需要来到神面前。",
  children: "把孩子的成长、道路与信仰交托给神。",
  marriage: "让关系在神的话语中被修复、扶持与更新。",
  family: "为家的平安、次序、关系与属灵氛围祷告。",
  work: "把工作中的压力、决定与方向带到神面前。",
  health: "在软弱与病患中，寻求神的医治与安慰。",
  parents: "将年迈父母的健康、信仰与晚年交托在神手中。",
  relationships: "在关系中寻求神的饶恕、和解与爱。",
  finance: "把经济的压力、智慧与需要交给供应万物的神。",
  future: "在人生的十字路口，寻求神的引导与勇气。",
};

function TopicLink({ catId, topicId, title }: { catId: string; topicId: string; title: string }) {
  return (
    <Link
      href={`/prayer/${catId}/${topicId}`}
      className="prayer-link font-medium"
    >
      {title}
    </Link>
  );
}

const CATEGORY_PROSE: Record<
  string,
  (topics: { id: string; title: string }[], catId: string, T: (id: string, catId: string, title: string) => ReactNode) => ReactNode
> = {
  self: (_topics, catId, T) => (
    <p className="prayer-lead">
      当你感到{T("anxious-heart", catId, "焦虑不安")}、{T("fear-and-worry", catId, "害怕担忧")}时， 也可以来到神面前寻求{T("inner-peace", catId, "内心平安")}与
      {T("faith-and-strength", catId, "信心与得力")}； 在不确定中{T("wisdom-and-direction", catId, "求智慧与引导")}，在漫长等候里{T("waiting-on-god", catId, "等候神")}； 在软弱中
      {T("repentance-and-renewal", catId, "悔改与更新")}，在恩典里{T("thanksgiving-and-praise", catId, "感恩赞美")}。
    </p>
  ),
  children: (_topics, catId, T) => (
    <p className="prayer-lead">
      为孩子的{T("child-protection", catId, "平安保护")}祷告， 在{T("child-growth", catId, "成长学习")}中求神带领； 愿他们在{T("child-faith", catId, "信仰扎根")}中被建立， 在
      {T("child-friendship", catId, "交友环境")}中被保守； 在{T("child-future", catId, "未来道路")}上有方向， 在{T("child-character", catId, "品格顺服")}中学习回应神。
    </p>
  ),
  marriage: (_topics, catId, T) => (
    <p className="prayer-lead">
      愿夫妻在{T("marriage-love", catId, "彼此相爱")}中被坚固， 在{T("marriage-repair", catId, "关系修复")}中学习饶恕； 在{T("marriage-faithfulness", catId, "忠诚圣洁")}中彼此守约， 在
      {T("marriage-unity", catId, "合一同行")}中同心前行； 在{T("marriage-roles", catId, "夫妻角色")}中彼此成全， 在{T("marriage-prayer", catId, "一同亲近神")}中建立家庭祭坛。
    </p>
  ),
  family: (_topics, catId, T) => (
    <p className="prayer-lead">
      求神赐下{T("family-peace", catId, "家庭平安")}， 使家中充满{T("family-love-and-forgiveness", catId, "爱与饶恕")}； 在{T("family-worship", catId, "一同祷告")}中重新归向神， 在
      {T("family-unity", catId, "家庭合一")}中同心事奉； 在{T("family-parents-children", catId, "亲子关系")}中有智慧， 在{T("family-guidance", catId, "家庭方向")}上仰望主。
    </p>
  ),
  work: (_topics, catId, T) => (
    <p className="prayer-lead">
      在{T("work-pressure", catId, "工作压力")}中寻求平静， 在{T("work-wisdom", catId, "智慧与决定")}中仰望神； 为{T("work-provision", catId, "供应与机会")}感恩信靠， 在
      {T("work-relationships", catId, "职场关系")}中活出见证； 在{T("work-faithfulness", catId, "忠心正直")}中荣耀神， 在{T("work-direction", catId, "方向与呼召")}上聆听祂引领。
    </p>
  ),
  health: (_topics, catId, T) => (
    <p className="prayer-lead">
      在{T("physical-healing", catId, "身体医治")}中信靠全能者， 在{T("sickness-and-recovery", catId, "病中依靠")}中经历祂同在； 在{T("sleep-and-rest", catId, "疲惫与失眠")}中得安息， 在
      {T("emotional-lowness", catId, "情绪低落")}时来到祂面前； 在{T("renewed-strength", catId, "重新得力")}中站立， 在{T("inner-comfort", catId, "内心安慰")}中被抚慰。
    </p>
  ),
  parents: (_topics, catId, T) => (
    <p className="prayer-lead">
      为父母的{T("parent-health", catId, "身体健康")}恳切祷告， 求神{T("parent-protection", catId, "平安蒙保守")}； 愿他们{T("parent-faith", catId, "信主得救")}， 在
      {T("parent-relationship", catId, "关系修复")}中重新连结； 在晚年有{T("parent-support", catId, "陪伴与扶持")}， 在{T("parent-future", catId, "晚年盼望")}中仰望永恒。
    </p>
  ),
  relationships: (_topics, catId, T) => (
    <p className="prayer-lead">
      在神的恩典里{T("forgiving-others", catId, "饶恕别人")}， 在{T("conflict-repair", catId, "修复冲突")}中寻求和好； 在{T("love-and-peace", catId, "爱人与和睦")}中彼此建立， 在
      {T("friendship-support", catId, "友情扶持")}中同行； 在{T("boundaries-and-self-control", catId, "界限与节制")}中有智慧， 在{T("unity-and-reconciliation", catId, "合一与和解")}中见证神的能力。
    </p>
  ),
  finance: (_topics, catId, T) => (
    <p className="prayer-lead">
      相信神供应{T("daily-provision", catId, "日常供应")}， 在{T("debt-pressure", catId, "债务压力")}中仰望祂； 求神赐下{T("financial-wisdom", catId, "财务智慧")}， 在
      {T("contentment-and-generosity", catId, "知足与慷慨")}中经历满足； 为{T("work-and-income", catId, "工作与收入")}感恩， 在{T("future-preparation", catId, "未来预备")}上交托神手。
    </p>
  ),
  future: (_topics, catId, T) => (
    <p className="prayer-lead">
      在{T("major-decisions", catId, "重大决定")}前俯伏寻求， 在{T("waiting-in-faith", catId, "等候中的信心")}里不动摇； 愿神成就你的{T("calling-and-purpose", catId, "呼召与使命")}， 在
      {T("unknown-future", catId, "未知中的平安")}里被神托住； 在{T("next-step-guidance", catId, "下一步引导")}中聆听， 在{T("courage-to-move", catId, "勇敢前行")}中踏出信心的步伐。
    </p>
  ),
};

export function PrayerTopicsCategoryList({ categories }: { categories: TopicPrayerCategory[] }) {
  const T = (topicId: string, catId: string, title: string) => <TopicLink key={topicId} catId={catId} topicId={topicId} title={title} />;

  return (
    <div className="prayer-divide-y">
      {categories.map((cat) => {
        const proseFn = CATEGORY_PROSE[cat.id];
        return (
          <section key={cat.id} id={cat.id} className="scroll-mt-20 py-12 first:pt-14">
            <header className="max-w-prose">
              <h2 className="prayer-heading-sm">{cat.title}</h2>
              {CATEGORY_DESC[cat.id] ? <p className="prayer-muted mt-2 text-[0.88em] leading-relaxed">{CATEGORY_DESC[cat.id]}</p> : null}
              <p className="mt-3">
                <Link href={`/prayer/${cat.id}`} className="prayer-link text-[0.82em] font-medium">
                  进入「{cat.title}」下的全部主题 →
                </Link>
              </p>
            </header>
            <div className="mt-8 max-w-prose">
              {proseFn ? (
                proseFn(cat.topics, cat.id, T)
              ) : (
                <p className="prayer-lead">
                  {cat.topics.map((t, ti) => (
                    <span key={t.id}>
                      {ti > 0 ? "、" : null}
                      <TopicLink catId={cat.id} topicId={t.id} title={t.title} />
                    </span>
                  ))}
                  。
                </p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
