import { useEffect, useState } from "react";
import type {
  BibleChapterPayload,
  BibleSearchHit,
  BibleTranslationInfo,
} from "../bridge/contracts";
import { bibleRepo, platformBridge } from "../bridge/platform-adapter";
import { findBook, SCRIPTURE_BOOKS } from "../data/books";

export interface ReaderPageProps {
  bookId: string;
  chapter: number;
  translationId: string;
  onChangeChapter: (bookId: string, chapter: number, translationId?: string) => void;
}

export default function ReaderPage({
  bookId,
  chapter,
  translationId,
  onChangeChapter,
}: ReaderPageProps) {
  const [payload, setPayload] = useState<BibleChapterPayload | null>(null);
  const [translations, setTranslations] = useState<BibleTranslationInfo[]>([]);
  const [highlighted, setHighlighted] = useState<Set<number>>(() => new Set());
  const [searchOpen, setSearchOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [hits, setHits] = useState<BibleSearchHit[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedMsg, setCopiedMsg] = useState("");

  const currentBook = findBook(bookId);

  useEffect(() => {
    bibleRepo.getTranslations().then(setTranslations).catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    bibleRepo
      .getChapter(translationId, currentBook.bookId, chapter)
      .then((res) => {
        if (active) {
          setPayload(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [translationId, currentBook.bookId, chapter]);

  function toggleHighlight(verseNum: number) {
    void platformBridge.call("shell.haptic", { style: "light" });
    setHighlighted((prev) => {
      const next = new Set(prev);
      if (next.has(verseNum)) next.delete(verseNum);
      else next.add(verseNum);
      return next;
    });
  }

  async function runSearch() {
    const res = await bibleRepo.search(translationId, keyword, 30);
    setHits(res);
  }

  async function playChapterAudio() {
    await platformBridge.call("shell.haptic", { style: "medium" });
    await platformBridge.call("audio.intent", {
      stream: "scripture",
      action: "play",
      payload: {
        title: `${currentBook.bookName} 第 ${chapter} 章`,
        bookId: currentBook.bookId,
        chapter,
        translationId,
      },
      origin: "kernel-reader-play",
    });
  }

  async function copySelected() {
    if (!payload || highlighted.size === 0) return;
    const text = payload.verses
      .filter((v) => highlighted.has(v.verse))
      .map((v) => `${currentBook.bookName} ${chapter}:${v.verse} ${v.text}`)
      .join("\n");
    await platformBridge.call("sys.shareImage", { text });
    await platformBridge.call("shell.haptic", { style: "success" });
    setCopiedMsg("已复制选中经文");
    window.setTimeout(() => setCopiedMsg(""), 2000);
  }

  function stepChapter(delta: number) {
    void platformBridge.call("shell.haptic", { style: "light" });
    const next = chapter + delta;
    if (next >= 1 && next <= currentBook.chapters) {
      onChangeChapter(currentBook.bookId, next);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const idx = SCRIPTURE_BOOKS.findIndex((b) => b.bookId === currentBook.bookId);
    const neighbor = SCRIPTURE_BOOKS[idx + delta];
    if (neighbor) {
      onChangeChapter(neighbor.bookId, delta > 0 ? 1 : neighbor.chapters);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <div className="ab-stack">
      <div className="ab-card">
        <div className="ab-grid-2" style={{ marginBottom: 10 }}>
          <select
            aria-label="选择书卷"
            className="ab-select"
            value={currentBook.bookId}
            onChange={(e) => onChangeChapter(e.target.value, 1)}
          >
            {SCRIPTURE_BOOKS.map((b) => (
              <option key={b.bookId} value={b.bookId}>
                {b.bookName}（{b.bookId}）
              </option>
            ))}
          </select>

          <div className="ab-row" style={{ flexWrap: "nowrap" }}>
            <select
              aria-label="选择章数"
              className="ab-select"
              value={chapter}
              onChange={(e) => onChangeChapter(currentBook.bookId, Number(e.target.value))}
            >
              {Array.from({ length: currentBook.chapters }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  第 {n} 章
                </option>
              ))}
            </select>

            <select
              aria-label="选择译本"
              className="ab-select"
              value={translationId}
              onChange={(e) => onChangeChapter(currentBook.bookId, chapter, e.target.value)}
            >
              {(translations.length ? translations : [{ id: "cuv-simp", shortName: "和合本" }]).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.shortName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="ab-row-between">
          <div className="ab-row">
            <button type="button" className="ab-btn ab-btn-primary" onClick={playChapterAudio}>
              朗读本章
            </button>
            <button type="button" className="ab-btn" onClick={() => setSearchOpen((v) => !v)}>
              {searchOpen ? "关闭搜索" : "经文搜索"}
            </button>
            {highlighted.size > 0 && (
              <button type="button" className="ab-btn ab-btn-ok" onClick={copySelected}>
                复制已选 ({highlighted.size})
              </button>
            )}
          </div>
          {payload && (
            <span className="ab-card-meta">数据源：{payload.source}</span>
          )}
        </div>

        {copiedMsg && (
          <div className="ab-pill ab-pill-ok" style={{ marginTop: 8 }}>{copiedMsg}</div>
        )}
      </div>

      {searchOpen && (
        <section className="ab-card-elevated">
          <div className="ab-row" style={{ flexWrap: "nowrap", marginBottom: 10 }}>
            <input
              type="search"
              className="ab-input"
              placeholder="输入关键词搜索经文（如：光、牧者、爱）"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void runSearch();
              }}
            />
            <button type="button" className="ab-btn ab-btn-primary" onClick={runSearch}>
              搜索
            </button>
          </div>
          {hits.length > 0 ? (
            <div className="ab-stack">
              {hits.map((h) => (
                <button
                  key={`${h.bookId}-${h.chapter}-${h.verse}`}
                  type="button"
                  className="ab-btn-ghost"
                  style={{ textAlign: "left", padding: "6px 8px" }}
                  onClick={() => {
                    onChangeChapter(h.bookId, h.chapter);
                    setSearchOpen(false);
                  }}
                >
                  <strong>{h.bookId} {h.chapter}:{h.verse}</strong> · {h.text}
                </button>
              ))}
            </div>
          ) : (
            <div className="ab-muted">输入关键词后按回车，将检索本地经文库或已缓存章节。</div>
          )}
        </section>
      )}

      <article className="ab-card" style={{ backgroundColor: "var(--ab-read-open-book-paper)" }}>
        <div className="ab-row-between" style={{ marginBottom: 12 }}>
          <h1 className="ab-page-title" style={{ fontSize: 22 }}>
            {currentBook.bookName} 第 {chapter} 章
          </h1>
          <span className="ab-card-meta">{currentBook.bookNameEn} {chapter}</span>
        </div>

        {loading ? (
          <div className="ab-loading">正在翻开经卷…</div>
        ) : (
          <div className="ab-verse-list">
            {(payload?.verses ?? []).map((v) => {
              const isSelected = highlighted.has(v.verse);
              return (
                <div
                  key={v.verse}
                  role="button"
                  tabIndex={0}
                  className={
                    isSelected ? "ab-verse-item ab-verse-item--highlighted" : "ab-verse-item"
                  }
                  onClick={() => toggleHighlight(v.verse)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleHighlight(v.verse);
                    }
                  }}
                >
                  <span className="ab-verse-num">{v.verse}</span>
                  <span>{v.text}</span>
                </div>
              );
            })}
          </div>
        )}

        <hr className="ab-divider" />
        <div className="ab-row-between">
          <button type="button" className="ab-btn" onClick={() => stepChapter(-1)}>
            上一章
          </button>
          <button type="button" className="ab-btn ab-btn-primary" onClick={() => stepChapter(1)}>
            下一章
          </button>
        </div>
      </article>
    </div>
  );
}
