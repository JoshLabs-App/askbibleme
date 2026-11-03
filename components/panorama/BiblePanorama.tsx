"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import data from "@/data/bible/panorama.json";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";
import { getScriptureBookDisplayName } from "@/lib/bible/scripture-book-display-name";
import { readLastReadPosition, type ReadLastPosition } from "@/lib/read/read-last-position";
import "./panorama.css";

const stateKey = "askbible-panorama-expanded-v1";
export function panoramaLocation(book: string, chapter: number) {
  for (const [index, act] of data.acts.entries()) {
    const section = act.sections.find(s => s.spans.some(p => p.bookId === book && chapter >= p.first && chapter <= p.last));
    if (section) return { index, act, section };
  }
  return null;
}
function Sketch({ index }: { index: number }) {
  const drawings = [
    "M8 62Q30 48 72 62M40 54V25M40 38Q15 40 19 19Q35 8 40 26Q46 8 63 20Q67 40 40 38M8 69H72",
    "M8 63H72M40 57V22M40 36Q20 41 19 22Q24 9 40 24Q56 9 62 23Q62 40 40 36M33 63L44 71L37 78",
    "M7 65L27 30L47 65ZM27 30V65M39 65L57 39L75 65ZM7 70H75M55 15H69M62 8V22",
    "M40 12V60M23 29H57M9 72Q39 52 71 72M20 72V59Q25 43 39 52M55 72V58",
    "M10 62Q40 35 70 62M40 39V67M10 62V74Q25 66 40 78Q55 66 70 74V62M22 28L31 34M49 34L58 28M40 15V28",
    "M7 66H73M17 66V37H63V66M17 38L27 27L37 38L47 27L63 38M32 66V52Q40 40 48 52V66M6 75Q40 68 74 75M40 8V20M28 14L32 20M52 14L48 20",
  ];
  return <svg viewBox="0 0 80 85" aria-hidden="true" className="panorama-sketch"><path d={drawings[index]} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
export function BiblePanorama() {
  const { locale } = useLocale();
  const t = (zh: string, en: string) => locale === "en" ? en : locale === "zh-TW" ? toZhTwText(zh) : zh;
  const [expanded, setExpanded] = useState<string[]>([]);
  const [position, setPosition] = useState<ReadLastPosition | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { const value = JSON.parse(sessionStorage.getItem(stateKey) || "[]"); if (Array.isArray(value)) setExpanded(value.filter(x=>typeof x === "string")); } catch {}
    setPosition(readLastReadPosition()); setReady(true);
  }, []);
  useEffect(() => { if (ready) { try { sessionStorage.setItem(stateKey, JSON.stringify(expanded)); } catch {} } }, [expanded, ready]);
  const toggle = (id: string) => setExpanded(old => old.includes(id) ? old.filter(x=>x!==id) : [...old,id]);
  const current = position && panoramaLocation(position.bookId,position.chapter);
  const locate = () => {
    if (!current) return;
    setExpanded(old => [...new Set([...old, `act-${current.index}`, current.section.id])]);
    requestAnimationFrame(()=>document.getElementById(`act-${current.index}`)?.scrollIntoView({block:"start",behavior:"smooth"}));
  };
  useEffect(() => { if (ready && new URLSearchParams(location.search).has("locate")) locate(); }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps
  const name = (book: string) => getScriptureBookDisplayName(book,locale);
  return <main className="panorama" data-shell-swipe-nav-exclude>
    <h1>{t("圣经全景","Bible panorama")}</h1>
    <p className="panorama-lead">{t("从创造走向新创造，认识经文的整体脉络。","From creation to new creation, discover Scripture’s unfolding context.")}</p>
    {position && <div className="panorama-resume"><Link href={`/read/${position.bookId}/${position.chapter}`}>{t("继续阅读","Resume reading")} · {name(position.bookId)} {position.chapter}</Link><button onClick={locate}>{t("定位","Locate")}</button></div>}
    <div className="panorama-timeline">{data.acts.map((act,index) => {
      const actKey=`act-${index}`, open=expanded.includes(actKey);
      return <section id={actKey} className="panorama-act" key={actKey}>
        <span className="panorama-number" aria-hidden="true">{index+1}</span>
        <button className="panorama-act-heading" aria-expanded={open} onClick={()=>toggle(actKey)}>
          <Sketch index={index}/><span><strong>{t(act.zh,act.en)}</strong><span className="panorama-subtitle">{t(act.subtitleZh,act.subtitleEn)}</span>{current?.index===index && <small>{t("你正在这里","You are here")}</small>}</span><span aria-hidden="true">{open?"−":"+"}</span>
        </button>
        {open && act.sections.map(section=>{
          const sectionOpen=act.sections.length<=2 || expanded.includes(section.id);
          const note=data.notes[section.id as keyof typeof data.notes];
          return <div className="panorama-section" key={section.id}>
            {act.sections.length>2 && <button className="panorama-section-heading" aria-expanded={sectionOpen} onClick={()=>toggle(section.id)}><strong>{t(section.zh,section.en)}</strong><span aria-hidden="true">{sectionOpen?"−":"+"}</span></button>}
            {sectionOpen && <div className="panorama-context"><p>{t(section.summaryZh,section.summaryEn)}</p>{note && <><h3>{t("经文脉络","Scripture in context")}</h3><p>{t(note.zh,note.en)}</p>{note.links.map((link,i)=><Link className="panorama-connection" key={i} href={`/read/${link.bookId}/${link.chapter}`}><strong>{t(link.kindZh,link.kindEn)} · {name(link.bookId)} {link.chapter}{link.verses?`:${link.verses}`:""}</strong><span>{t(link.reasonZh,link.reasonEn)}</span><small>{t("阅读所在章 ›","Read this chapter ›")}</small></Link>)}</>}</div>}
            {section.spans.map(span=>{
              const key=`${section.id}:${span.bookId}:${span.first}`, bookOpen=expanded.includes(key), intro=data.introductions[span.bookId as keyof typeof data.introductions];
              return <article className="panorama-book" key={key}>
                <button className="panorama-book-heading" aria-expanded={bookOpen} onClick={()=>toggle(key)}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 5Q7 1 2 4V19Q7 16 12 20Q17 16 22 19V4Q17 1 12 5V20" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg><strong>{name(span.bookId)}</strong><span aria-hidden="true">{bookOpen?"−":"+"}</span></button>
                <p>{t(intro.zh,intro.en)}</p><small>{t("章节","Chapters")} {span.first}{span.first!==span.last?`–${span.last}`:""}</small>
                {bookOpen && <div className="panorama-book-expanded"><h3>{t("在经文中的位置","Its place in Scripture")}</h3><p>{t(section.summaryZh,section.summaryEn)}</p><p>{t("阅读线索","Reading pointers")} · {intro.references}</p><div className="panorama-chapters">{Array.from({length:span.last-span.first+1},(_,i)=>i+span.first).map(ch=><Link key={ch} href={`/read/${span.bookId}/${ch}`} aria-label={`${name(span.bookId)} ${ch}`} aria-current={position?.bookId===span.bookId && position.chapter===ch?"page":undefined}>{ch}</Link>)}</div><button onClick={()=>toggle(key)}>{t("收起书卷","Collapse book")}</button></div>}
              </article>;
            })}
          </div>;
        })}
      </section>;
    })}</div>
    <p className="panorama-footnote">{t("六幕是阅读导览，不是圣经原有的分卷。书卷可跨越多个阶段；诗歌、智慧与先知书按处境和主题连接。","The six acts are a reading guide, not the Bible’s own divisions. Books can span stages; poetry, wisdom, and prophecy connect through context and themes.")}</p>
  </main>;
}
export function PanoramaChapterLink({bookId,chapter}:{bookId:string;chapter:number}) {
  const {locale}=useLocale(); const current=panoramaLocation(bookId,chapter);
  const text=locale==="en"?"Locate in the Bible panorama":locale==="zh-TW"?"在聖經全景中定位":"在圣经全景中定位";
  return <Link className="panorama-chapter-link" href="/panorama?locate=1">{text}{current?` · ${locale==="en"?current.act.en:locale==="zh-TW"?toZhTwText(current.act.zh):current.act.zh}`:""} ›</Link>;
}
