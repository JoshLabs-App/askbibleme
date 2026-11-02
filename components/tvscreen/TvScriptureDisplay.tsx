import { useEffect, useRef, type CSSProperties } from "react";
import styles from "./TvScriptureDisplay.module.css";

/** TovCore typography for centered golden verses and stable reading paragraphs. */
export function TvScriptureDisplay({ text, passage, reference, scale, label, controlsVisible, parchment }: {
  text: string;
  passage?: { verses: string[]; start: number; current: number };
  reference: string;
  scale: number;
  label: string;
  controlsVisible?: boolean;
  parchment?: boolean;
}) {
  const paragraphRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!parchment) return;
    const paragraph = paragraphRef.current;
    const current = paragraph?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!paragraph || !current) return;
    const containerRect = paragraph.getBoundingClientRect();
    const verseRect = current.getBoundingClientRect();
    paragraph.scrollTop += verseRect.top - containerRect.top - paragraph.clientHeight * 0.35;
  }, [parchment, passage?.current, reference]);
  const content = passage ? passage.verses.join(" ") : text;
  const lengthScale = parchment ? 1 : content.length > 240 ? 0.72 : content.length > 120 ? 0.86 : 1;
  return (
    <section
      data-tv-scripture
      className={`${styles.display} ${passage && controlsVisible ? styles.withControls : ""} ${parchment ? styles.parchment : ""}`}
      aria-label={label}
      style={{ "--lyric-scale": scale * lengthScale, "--reference-scale": scale } as CSSProperties}
    >
      {/* Keep the paragraph mounted as narration advances within the same page. */}
      <div key={`${reference}:${content}`} className={styles.lines}>
        {passage ? (
          <p ref={paragraphRef} className={`${styles.current} ${styles.paragraph}`} tabIndex={0}>
            {passage.verses.map((verse, index) => (
              <span key={passage.start + index} aria-current={passage.start + index === passage.current ? "true" : undefined}>
                <sup className={styles.number}>{passage.start + index + 1}</sup>{verse}{" "}
              </span>
            ))}
          </p>
        ) : <p className={styles.current} tabIndex={0}>{text}</p>}
      </div>
      <p className={styles.reference}>{reference}</p>
    </section>
  );
}
