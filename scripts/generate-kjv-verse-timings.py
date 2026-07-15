#!/usr/bin/env python3
"""Generate KJV verse timings from AudioTreasure chapter MP3 files.

The audio is downloaded into a temporary directory and discarded after alignment.
Only compact JSON timing files are written to public/verse-timings/kjv/.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import urllib.request


REPO_ROOT = Path(__file__).resolve().parent.parent
KJV_JSON = REPO_ROOT / "data" / "bible" / "uploads" / "kjv.json"
OUT_DIR = REPO_ROOT / "public" / "verse-timings" / "kjv"
REPORT_PATH = REPO_ROOT / "data" / "bible" / "kjv-verse-timings-generation-report.json"
ALIGNER_PATH = Path(__file__).resolve().parent / "whisper-verse-align.py"
REMOTE_BASE = "https://www.audiotreasure.com/content/KJV_AT"

BOOKS = [
    ("GEN", "Genesis", 50), ("EXO", "Exodus", 40), ("LEV", "Leviticus", 27),
    ("NUM", "Numbers", 36), ("DEU", "Deuteronomy", 34), ("JOS", "Joshua", 24),
    ("JDG", "Judges", 21), ("RUT", "Ruth", 4), ("1SA", "1Samuel", 31),
    ("2SA", "2Samuel", 24), ("1KI", "1Kings", 22), ("2KI", "2Kings", 25),
    ("1CH", "1Chronicles", 29), ("2CH", "2Chronicles", 36), ("EZR", "Ezra", 10),
    ("NEH", "Nehemiah", 13), ("EST", "Esther", 10), ("JOB", "Job", 42),
    ("PSA", "Psalms", 150), ("PRO", "Proverbs", 31), ("ECC", "Ecclesiastes", 12),
    ("SNG", "SongofSolomon", 8), ("ISA", "Isaiah", 66), ("JER", "Jeremiah", 52),
    ("LAM", "Lamentations", 5), ("EZK", "Ezekiel", 48), ("DAN", "Daniel", 12),
    ("HOS", "Hosea", 14), ("JOL", "Joel", 3), ("AMO", "Amos", 9),
    ("OBA", "Obadiah", 1), ("JON", "Jonah", 4), ("MIC", "Micah", 7),
    ("NAM", "Nahum", 3), ("HAB", "Habakkuk", 3), ("ZEP", "Zephaniah", 3),
    ("HAG", "Haggai", 2), ("ZEC", "Zechariah", 14), ("MAL", "Malachi", 4),
    ("MAT", "Matthew", 28), ("MRK", "Mark", 16), ("LUK", "Luke", 24),
    ("JHN", "John", 21), ("ACT", "Acts", 28), ("ROM", "Romans", 16),
    ("1CO", "1Corinthians", 16), ("2CO", "2Corinthians", 13), ("GAL", "Galatians", 6),
    ("EPH", "Ephesians", 6), ("PHP", "Philippians", 4), ("COL", "Colossians", 4),
    ("1TH", "1Thessalonians", 5), ("2TH", "2Thessalonians", 3),
    ("1TI", "1Timothy", 6), ("2TI", "2Timothy", 4), ("TIT", "Titus", 3),
    ("PHM", "Philemon", 1), ("HEB", "Hebrews", 13), ("JAS", "James", 5),
    ("1PE", "1Peter", 5), ("2PE", "2Peter", 3), ("1JN", "1John", 5),
    ("2JN", "2John", 1), ("3JN", "3John", 1), ("JUD", "Jude", 1),
    ("REV", "Revelation", 22),
]

BOOK_META = {book_id: (i + 1, stem, chapters) for i, (book_id, stem, chapters) in enumerate(BOOKS)}
SAMPLE_BOOKS = {"GEN", "PSA", "MAT", "JHN"}


def load_aligner():
    spec = importlib.util.spec_from_file_location("askbible_whisper_verse_align", ALIGNER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load {ALIGNER_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def audio_url(book_id: str, chapter: int) -> str:
    ordinal, stem, _ = BOOK_META[book_id]
    if chapter == 1 and book_id in {"PHM", "2JN", "3JN", "JUD"}:
        return f"{REMOTE_BASE}/{ordinal:02d}_{stem}.mp3"
    if book_id == "JOB":
        prefix = "18_Job"
    elif book_id == "SNG":
        # AudioTreasure's published filename contains this historical misspelling.
        prefix = "22_Song_of_Soloman"
    else:
        prefix = f"{ordinal:02d}_{stem}"
    return f"{REMOTE_BASE}/{prefix}{chapter:03d}.mp3"


def audio_duration(path: Path) -> float:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(result.stdout.strip())


def validate_timings(
    timings: list[dict], verses: list[dict], duration: float, minimum_coverage: float = 0.7
) -> None:
    if len(timings) != len(verses):
        raise ValueError(f"timing count {len(timings)} != verse count {len(verses)}")
    previous_start = -1.0
    for expected, row in zip(verses, timings):
        verse = int(row.get("verse", 0))
        start = float(row.get("start", -1))
        end = float(row.get("end", -1))
        if verse != expected["verse"]:
            raise ValueError(f"expected verse {expected['verse']}, got {verse}")
        if not math.isfinite(start) or not math.isfinite(end) or start < 0 or end < start:
            raise ValueError(f"invalid timing for verse {verse}: {start}..{end}")
        if start < previous_start:
            raise ValueError(f"non-monotonic timing at verse {verse}")
        if end > duration + 2.0:
            raise ValueError(f"verse {verse} exceeds audio duration: {end} > {duration}")
        previous_start = start
    if timings and float(timings[-1]["end"]) < duration * minimum_coverage:
        raise ValueError(f"alignment ends too early: {timings[-1]['end']} / {duration}")


def download(url: str, target: Path) -> None:
    last_error = None
    for attempt in range(1, 4):
        try:
            target.unlink(missing_ok=True)
            request = urllib.request.Request(url, headers={"User-Agent": "AskBible.me KJV timing generator"})
            with urllib.request.urlopen(request, timeout=30) as response, target.open("wb") as out:
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    out.write(chunk)
            if target.stat().st_size < 10_000:
                raise ValueError(f"downloaded audio is too small: {target.stat().st_size}")
            return
        except Exception as exc:
            last_error = exc
            if attempt < 3:
                time.sleep(attempt)
    raise RuntimeError(f"download failed after 3 attempts: {last_error}")


def chapter_jobs(args) -> list[tuple[str, int]]:
    selected_books = {b.strip().upper() for b in (args.books or "").split(",") if b.strip()}
    if args.sample:
        selected_books = SAMPLE_BOOKS
    if args.book:
        selected_books = {args.book.strip().upper()}
    if not args.all and not args.sample and not selected_books:
        raise ValueError("Choose --sample, --all, --book ID, or --books ID,ID")
    jobs = []
    for book_id, _stem, chapters in BOOKS:
        if selected_books and book_id not in selected_books:
            continue
        chapter_numbers = [args.chapter] if args.chapter is not None and book_id in selected_books else range(1, chapters + 1)
        for chapter in chapter_numbers:
            if chapter < 1 or chapter > chapters:
                raise ValueError(f"Invalid chapter {book_id} {chapter}")
            jobs.append((book_id, chapter))
    if args.shard_count < 1 or args.shard_index < 0 or args.shard_index >= args.shard_count:
        raise ValueError("--shard-index must be between 0 and --shard-count - 1")
    return jobs[args.shard_index :: args.shard_count]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sample", action="store_true", help="Generate GEN, PSA, MAT, and JHN")
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--book")
    parser.add_argument("--books", help="Comma-separated book IDs")
    parser.add_argument("--chapter", type=int)
    parser.add_argument(
        "--model",
        default="small",
        choices=["tiny", "tiny.en", "base", "base.en", "small", "small.en", "medium", "medium.en", "large"],
    )
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--continue-on-error", action="store_true")
    parser.add_argument("--shard-count", type=int, default=1)
    parser.add_argument("--shard-index", type=int, default=0)
    args = parser.parse_args()

    jobs = chapter_jobs(args)
    scripture = json.loads(KJV_JSON.read_text(encoding="utf-8"))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    aligner = load_aligner()
    completed = 0
    skipped = 0
    failed = []
    started = time.monotonic()

    with tempfile.TemporaryDirectory(prefix="askbible-kjv-timings-") as tmp:
        tmp_dir = Path(tmp)
        for index, (book_id, chapter) in enumerate(jobs, start=1):
            out_path = OUT_DIR / f"{book_id}-{chapter}.json"
            if out_path.exists() and not args.force:
                skipped += 1
                print(f"[{index}/{len(jobs)}] skip {book_id} {chapter}", flush=True)
                continue
            try:
                chapter_rows = scripture["books"][book_id][str(chapter)]
                verses = [
                    {"verse": int(verse), "text": " ".join(str(text).split())}
                    for verse, text in sorted(chapter_rows.items(), key=lambda item: int(item[0]))
                    if str(text).strip()
                ]
                audio_path = tmp_dir / f"{book_id}-{chapter}.mp3"
                print(f"[{index}/{len(jobs)}] {book_id} {chapter}: download", flush=True)
                download(audio_url(book_id, chapter), audio_path)
                duration = audio_duration(audio_path)
                print(f"[{index}/{len(jobs)}] {book_id} {chapter}: align {len(verses)} verses ({duration:.1f}s)", flush=True)
                timings = aligner.align_verses(str(audio_path), verses, args.model, "en")
                # AudioTreasure's Psalms 145 file appends the opening of Psalm 146;
                # the verified Psalm 145 boundary is therefore around 69% of the file.
                minimum_coverage = 0.6 if (book_id, chapter) == ("PSA", 145) else 0.7
                validate_timings(timings, verses, duration, minimum_coverage)
                out_path.write_text(json.dumps(timings, indent=2) + "\n", encoding="utf-8")
                audio_path.unlink(missing_ok=True)
                completed += 1
            except Exception as exc:
                failed.append({"bookId": book_id, "chapter": chapter, "error": str(exc)})
                print(f"[{index}/{len(jobs)}] ERROR {book_id} {chapter}: {exc}", file=sys.stderr, flush=True)
                if not args.continue_on_error:
                    break

    elapsed = time.monotonic() - started
    report = {
        "requested": len(jobs),
        "completed": completed,
        "skipped": skipped,
        "failed": failed,
        "elapsedSec": round(elapsed, 1),
        "model": args.model,
        "shardIndex": args.shard_index,
        "shardCount": args.shard_count,
    }
    report_path = (
        REPORT_PATH
        if args.shard_count == 1
        else REPORT_PATH.with_name(
            f"kjv-verse-timings-generation-report-shard-{args.shard_index}-of-{args.shard_count}.json"
        )
    )
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2), flush=True)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
