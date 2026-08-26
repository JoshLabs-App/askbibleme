#!/usr/bin/env python3
"""
Whisper / stable-ts forced alignment: map CUV verse text to chapter MP3 timestamps.

Used for Mandarin CUV (AskBible) and Teochew NT (screen text stays CUV; audio is Teochew).

Usage:
  python3 scripts/whisper-verse-align.py <audio_file> <verse_texts_json> [--model small] [--language zh]
"""

import sys
import json
import argparse
import os
from difflib import SequenceMatcher


_MODEL_CACHE = {}


def _load_model_once(model_name: str):
    import stable_whisper

    model = _MODEL_CACHE.get(model_name)
    if model is None:
        model = stable_whisper.load_model(model_name)
        _MODEL_CACHE[model_name] = model
    return model


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


def _build_ref_to_recon_map(full_ref: str, recon: str) -> list[int]:
    if full_ref == recon:
        return list(range(len(full_ref) + 1))
    mapped: list[int | None] = [None] * (len(full_ref) + 1)
    sm = SequenceMatcher(a=full_ref, b=recon, autojunk=False)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            for ref_pos in range(i1, i2 + 1):
                if mapped[ref_pos] is None:
                    mapped[ref_pos] = j1 + (ref_pos - i1)
        elif tag == "replace":
            span = max(1, i2 - i1)
            span_b = max(1, j2 - j1)
            for ref_pos in range(i1, i2 + 1):
                if mapped[ref_pos] is None:
                    mapped[ref_pos] = j1 + int((ref_pos - i1) * span_b / span)
        elif tag == "delete":
            for ref_pos in range(i1, i2 + 1):
                if mapped[ref_pos] is None:
                    mapped[ref_pos] = j1
        elif tag == "insert":
            if mapped[i1] is None:
                mapped[i1] = j1
    last = 0
    for i, value in enumerate(mapped):
        if value is None:
            mapped[i] = last
        else:
            last = value
    mapped[0] = 0
    mapped[-1] = len(recon)
    return [int(value) for value in mapped]


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


def align_verses(audio_path: str, verses: list, model_name: str = "small", language: str = "zh") -> list:
    full_ref = "".join(v["text"] for v in verses)
    if not full_ref.strip():
        return []

    model = _load_model_once(model_name)
    result = model.align(
        audio_path,
        full_ref,
        language=language,
        token_step=200,
        fast_mode=True,
        verbose=None,
    )

    if result is None:
        return _fallback_proportional(verses, 1.0)

    words = _flatten_aligned_words(result)
    if not words:
        return _fallback_proportional(verses, 1.0)

    recon = "".join(w["word"] for w in words)
    total_duration = _duration_from_words(words)
    ref_to_recon = _build_ref_to_recon_map(full_ref, recon)

    timings = []
    char_pos = 0
    for v in verses:
        vlen = len(v["text"])
        start_ref = char_pos
        end_ref = char_pos + vlen

        r0 = ref_to_recon[start_ref]
        r1 = ref_to_recon[end_ref]

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


def transcribe_verses(audio_path: str, verses: list, model_name: str = "small", language: str = "zh") -> list:
    """Fallback for recordings whose wording differs enough for forced alignment to stop early."""
    full_ref = "".join(v["text"] for v in verses)
    if not full_ref.strip():
        return []
    model = _load_model_once(model_name)
    result = model.transcribe(audio_path, language=language, word_timestamps=True)
    words = _flatten_aligned_words(result)
    if not words:
        return _fallback_proportional(verses, 1.0)

    recon = "".join(w["word"] for w in words)
    duration = _duration_from_words(words)
    ref_to_recon = _build_ref_to_recon_map(full_ref, recon)
    timings = []
    char_pos = 0
    for verse in verses:
        end_ref = char_pos + len(verse["text"])
        start_time = _time_at_recon_char(
            words, recon, ref_to_recon[char_pos], duration
        )
        end_time = _time_at_recon_char(
            words, recon, ref_to_recon[end_ref], duration
        )
        timings.append({
            "verse": verse["verse"],
            "start": round(start_time, 2),
            "end": round(max(start_time, end_time), 2),
        })
        char_pos = end_ref

    for index in range(len(timings) - 1):
        boundary = round((timings[index]["end"] + timings[index + 1]["start"]) / 2, 2)
        timings[index]["end"] = boundary
        timings[index + 1]["start"] = boundary
    return timings


def _align_one(audio_path: str, verses_path: str, out_path: str, model_name: str, language: str) -> int:
    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"Audio file not found: {audio_path}")
    with open(verses_path, "r", encoding="utf-8") as f:
        verses = json.load(f)
    timings = align_verses(audio_path, verses, model_name, language)
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(f"{json.dumps(timings, ensure_ascii=False, indent=2)}\n")
    return len(timings)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("audio", nargs="?", help="Path to MP3/audio file")
    parser.add_argument("verses_json", nargs="?", help="Path to JSON file with verse texts")
    parser.add_argument("--model", default="small", choices=["tiny", "base", "small", "medium", "large"])
    parser.add_argument("--language", default="zh")
    parser.add_argument("--jobs", help="JSON list of {audio, verses, out} — loads the model once")
    parser.add_argument("--continue-on-error", action="store_true")
    args = parser.parse_args()

    if args.jobs:
        with open(args.jobs, "r", encoding="utf-8") as f:
            jobs = json.load(f)
        if not isinstance(jobs, list) or not jobs:
            print(json.dumps({"ok": 0, "failed": 0}))
            return
        ok = 0
        fail = 0
        for i, job in enumerate(jobs, 1):
            audio = str(job.get("audio") or "")
            verses = str(job.get("verses") or "")
            out = str(job.get("out") or "")
            label = str(job.get("label") or os.path.basename(out) or audio)
            print(f"[{i}/{len(jobs)}] {label}", file=sys.stderr, flush=True)
            try:
                n = _align_one(audio, verses, out, args.model, args.language)
                ok += 1
                print(f"  [done] {out} ({n} verses)", file=sys.stderr, flush=True)
            except Exception as exc:
                fail += 1
                print(f"  [error] {exc}", file=sys.stderr, flush=True)
                if not args.continue_on_error:
                    print(json.dumps({"ok": ok, "failed": fail}))
                    sys.exit(1)
        print(json.dumps({"ok": ok, "failed": fail}))
        if fail > 0:
            sys.exit(1)
        return

    if not args.audio or not args.verses_json:
        parser.error("audio and verses_json are required unless --jobs is set")
    if not os.path.exists(args.audio):
        print(json.dumps({"error": f"Audio file not found: {args.audio}"}))
        sys.exit(1)

    with open(args.verses_json, "r", encoding="utf-8") as f:
        verses = json.load(f)

    timings = align_verses(args.audio, verses, args.model, args.language)
    print(json.dumps(timings, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
