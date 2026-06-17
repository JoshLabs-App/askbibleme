import { GOSPEL_BOOKS, type DivineSpeechInferContext, type DivineSpeechSpan } from "./divineSpeechTypes";
import { enSpanAfterSpeechCue, zhSpanAfterSpeechCue } from "./divineSpeechQuoteParsing";

const ZH_DIVINE_SPEECH_TRIGGER_RE =
  /(?:神吩咐这一切的话说|耶和华如此说|耶和華如此說|万军之耶和华说|萬軍之耶和華說|主耶和华说|主耶和華说|耶和华说|耶和華说|神晓谕|神曉諭|神吩咐|神说|神說|神就说|神就說|神(?:就)?(?:称|稱)[^。！？「」\n]{0,20}?(?:为|為)|从天上有声音说|從天上有聲音說|有声音从天上说|有聲音從天上說|有声音从天上来[，,]?说|有聲音從天上來[，,]?說|有声音从云里出来说|有聲音從雲裡出來說|有声音从云彩里出来说|有聲音從雲彩裡出來說|有声音从云里出来[，,]?说|有聲音從雲裡出來[，,]?說|有声音从云彩里出来[，,]?说|有聲音從雲彩裡出來[，,]?說|耶穌回答說|耶稣回答说|耶穌對他們說|耶稣对他们说|耶穌就對他們說|耶稣就对他们说|耶穌說|耶稣说|(?:耶和华|耶和華|万军之耶和华|萬軍之耶和華|主耶和华|主耶和華|神)(?:[^。！？；;：「」『』\n]{0,14}?)(?:说|說|吩咐|晓谕|曉諭)|(?:耶穌|耶稣)(?:就|又|便)?(?:回答說|回答说|說|说|對[^。！？；;：「」『』\n]{0,8}說|对[^。！？；;：「」『』\n]{0,8}说))/g;
const ZH_GOSPEL_JESUS_PRONOUN_TRIGGER_RE =
  /(?:他用比喻对他们讲许多道理，说|他用比喻對他們講許多道理，說)/g;

const EN_TRIGGER_SOURCE =
  [
    "God spoke all these words, saying",
    "Thus saith the LORD",
    "Thus says the LORD",
    "Thus says Yahweh",
    "The word of the LORD came to",
    "The word of Yahweh came to",
    "Jesus answered him",
    "Jesus answered",
    "Jesus said to him",
    "Jesus said to them",
    "Jesus said",
    "God said",
    "God spoke",
    "The LORD said",
    "Yahweh said",
  ]
    .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");

function zhShouldSkipDivineCue(text: string, cueStart: number, cue: string): boolean {
  if (
    /(?:求他说|求他說|对他说|對他說|问他说|問他說|向他说|向他說)$/.test(cue)
  ) {
    return true;
  }
  if (!/(?:耶稣说|耶穌說)$/.test(cue)) return false;
  const left = text.slice(Math.max(0, cueStart - 8), cueStart);
  return /(?:问|問|对|對|求)\s*$/.test(left);
}

export function zhSpansFromSpeechTriggers(text: string, ctx: DivineSpeechInferContext): DivineSpeechSpan[] {
  const spans: DivineSpeechSpan[] = [];
  const re = ZH_DIVINE_SPEECH_TRIGGER_RE;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (zhShouldSkipDivineCue(text, m.index, m[0])) continue;
    const after = m.index + m[0].length;
    const span = zhSpanAfterSpeechCue(text, after);
    if (span) spans.push(span);
  }
  if (GOSPEL_BOOKS.has(ctx.bookId)) {
    const pronounRe = ZH_GOSPEL_JESUS_PRONOUN_TRIGGER_RE;
    let pm: RegExpExecArray | null;
    while ((pm = pronounRe.exec(text)) !== null) {
      const after = pm.index + pm[0].length;
      const span = zhSpanAfterSpeechCue(text, after);
      if (span) spans.push(span);
    }
  }
  return spans;
}

export function enSpansFromSpeechTriggers(text: string): DivineSpeechSpan[] {
  const spans: DivineSpeechSpan[] = [];
  const re = new RegExp(EN_TRIGGER_SOURCE, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const after = m.index + m[0].length;
    const span = enSpanAfterSpeechCue(text, after);
    if (span) spans.push(span);
  }
  return spans;
}
