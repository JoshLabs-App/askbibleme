import type { CSSProperties } from "react";
import styles from "./TvScriptureDisplay.module.css";

/** TovCore typography for centered golden verses and stable reading paragraphs. */
export function TvScriptureDisplay({ text, passage, reference, scale, label, controlsVisible }: {
  text: string;
  passage?: { verses: string[]; start: number; current: number };
  reference: string;
  scale: number;
  label: string;
  controlsVisible?: boolean;
}) {
  const content = passage ? passage.verses.join(" ") : text;
  const lengthScale = content.length > 240 ? 0.72 : content.length > 120 ? 0.86 : 1;
  return (
    <section
      data-tv-scripture
      className={`${styles.display} ${passage && controlsVisible ? styles.withControls : ""}`}
      aria-label={label}
      style={{ "--lyric-scale": scale * lengthScale, "--reference-scale": scale } as CSSProperties}
    >
      {/* Keep the paragraph mounted as narration advances within the same page. */}
      <div key={`${reference}:${content}`} className={styles.lines}>
        {passage ? (
          <p className={`${styles.current} ${styles.paragraph}`} tabIndex={0}>
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
