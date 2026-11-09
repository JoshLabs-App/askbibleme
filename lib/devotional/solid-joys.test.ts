import assert from "node:assert/strict";
import {
  devotionalAvailable,
  devotionalKey,
  shouldHandoffDevotional,
  devotionalAudioUrl,
} from "./solid-joys";
assert.equal(devotionalAvailable("zh-CN", true), true);
assert.equal(devotionalAvailable("en", true), false);
assert.equal(devotionalAvailable("zh-CN", false), false);
assert.equal(devotionalKey(new Date(2024, 1, 29)), "02-28");
assert.equal(
  shouldHandoffDevotional(
    [
      { bookId: "GEN", chapter: 1 },
      { bookId: "GEN", chapter: 2 },
    ],
    { bookId: "GEN", chapter: 1 },
  ),
  false,
);
assert.equal(
  shouldHandoffDevotional([{ bookId: "GEN", chapter: 1 }], {
    bookId: "GEN",
    chapter: 1,
  }),
  true,
);
assert.equal(shouldHandoffDevotional([], { bookId: "GEN", chapter: 1 }), false);
assert.equal(
  devotionalAudioUrl({
    md: "11-09",
    title: "",
    verse: "",
    ref: "",
    paragraphs: [],
    audio: "javascript:alert(1)",
  }),
  null,
);
console.log("PASS: devotional access, date, queue and audio URL checks");
