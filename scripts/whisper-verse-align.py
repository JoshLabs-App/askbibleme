#!/usr/bin/env python3
"""
Whisper / stable-ts forced alignment: map CUV verse text to chapter MP3 timestamps.

Used for Mandarin CUV (AskBible) and Teochew NT (screen text stays CUV; audio is Teochew).

Usage:
  python3 scripts/whisper-verse-align.py <audio_file> <verse_texts_json> [--model small]
"""

import sys
import json
import argparse
import os
from difflib import SequenceMatcher


def _duration_from_words(words: list) -> float:
    if not words:
        return 1.0
    return float(words[-1]["end"])


def _fallback_proportional(verses: list, duration: float) -> list:
    total_chars = sum(max(1, len(v["text"])) for v in verses)
    timings = []
    acc = 0
    for v in verses:
        chars = max(1, len(v["text"]))
        start = (acc / total_chars) * duration
        end = ((acc + chars) / total_chars) * duration
        timings.append({"verse": v["verse"], "start": round(start, 2), "end": round(end, 2)})
        acc += chars
    return timings


def _flatten_aligned_words(result) -> list:
    words = []
    for seg in result.segments or []:
        for w in seg.words or []:
            words.append({"word": w.word, "start": float(w.start), "end": float(w.end)})
    return words


def _ref_index_to_recon_index(ref_pos: int, full_ref: str, recon: str) -> int:
    if ref_pos <= 0:
        return 0
    if ref_pos >= len(full_ref):
        return len(recon)

    if full_ref == recon:
        return ref_pos

    sm = SequenceMatcher(a=full_ref, b=recon, autojunk=False)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            if i1 <= ref_pos < i2:
                return j1 + (ref_pos - i1)
            if ref_pos == i2:
                return j2
        elif tag == "replace":
            if i1 <= ref_pos < i2:
                span = max(1, i2 - i1)
                span_b = max(1, j2 - j1)
                return j1 + int((ref_pos - i1) * span_b / span)
            if ref_pos == i2:
                return j2
        elif tag == "delete":
            if i1 <= ref_pos <= i2:
                return j1
        elif tag == "insert":
            if ref_pos == i1:
                return j1
    return len(recon)


def _time_at_recon_char(words: list, recon: str, recon_pos: int, total_duration: float) -> float:
    if not words:
        return 0.0
    if recon_pos <= 0:
        return float(words[0]["start"])
    if recon_pos >= len(recon):
        return float(words[-1]["end"])

    ci = 0
    for w in words:
        wtext = w["word"]
        wlen = len(wtext)
        if ci + wlen > recon_pos:
            offset = recon_pos - ci
            frac = offset / max(1, wlen)
            return float(w["start"]) + frac * (float(w["end"]) - float(w["start"]))
        ci += wlen
    return float(words[-1]["end"])


def align_verses(audio_path: str, verses: list, model_name: str = "small") -> list:
    import stable_whisper

    full_ref = "".join(v["text"] for v in verses)
    if not full_ref.strip():
        return []

    model = stable_whisper.load_model(model_name)
    result = model.align(
        audio_path,
        full_ref,
        language="zh",
        token_step=200,
        fast_mode=True,
    )

    if result is None:
        return _fallback_proportional(verses, 1.0)

    words = _flatten_aligned_words(result)
    if not words:
        return _fallback_proportional(verses, 1.0)

    recon = "".join(w["word"] for w in words)
    total_duration = _duration_from_words(words)

    timings = []
    char_pos = 0
    for v in verses:
        vlen = len(v["text"])
        start_ref = char_pos
        end_ref = char_pos + vlen

        r0 = _ref_index_to_recon_index(start_ref, full_ref, recon)
        r1 = _ref_index_to_recon_index(end_ref, full_ref, recon)

        start_time = _time_at_recon_char(words, recon, r0, total_duration)
        end_time = _time_at_recon_char(words, recon, r1, total_duration)
        if end_time < start_time:
            end_time = start_time

        timings.append({
            "verse": v["verse"],
            "start": round(start_time, 2),
            "end": round(end_time, 2),
        })
        char_pos = end_ref

    for i in range(len(timings) - 1):
        if timings[i]["end"] > timings[i + 1]["start"]:
            mid = round((timings[i]["end"] + timings[i + 1]["start"]) / 2, 2)
            timings[i]["end"] = mid
            timings[i + 1]["start"] = mid

    return timings


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("audio", help="Path to MP3/audio file")
    parser.add_argument("verses_json", help="Path to JSON file with verse texts")
    parser.add_argument("--model", default="small", choices=["tiny", "base", "small", "medium", "large"])
    args = parser.parse_args()

    if not os.path.exists(args.audio):
        print(json.dumps({"error": f"Audio file not found: {args.audio}"}))
        sys.exit(1)

    with open(args.verses_json, "r", encoding="utf-8") as f:
        verses = json.load(f)

    timings = align_verses(args.audio, verses, args.model)
    print(json.dumps(timings, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
