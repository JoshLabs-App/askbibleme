import type { CSSProperties } from "react";
import styles from "./TvScriptureDisplay.module.css";

/** TovCore TV's centered lyric typography, shared by verses and today's reading. */
export function TvScriptureDisplay({ text, nextText, reference, scale, label }: {
  text: string;
  nextText?: string;
  reference: string;
  scale: number;
  label: string;
}) {
  // Scripture can be longer than a lyric. Keep all words reachable at every text size.
  const lengthScale = text.length > 240 ? 0.72 : text.length > 120 ? 0.86 : 1;
  return (
    <section className={styles.display} aria-label={label} style={{ "--lyric-scale": scale * lengthScale } as CSSProperties}>
      <div key={`${reference}:${text}`} className={styles.lines}>
        <p className={styles.current} tabIndex={0}>{text}</p>
        {nextText ? <p className={styles.next} tabIndex={0}>{nextText}</p> : null}
        <p className={styles.reference}>{reference}</p>
      </div>
    </section>
  );
}
