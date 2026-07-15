#!/usr/bin/env python3
"""Generate WEBP verse timings for the TheAudioPower MP3s used by the app."""

from __future__ import annotations

import argparse
from concurrent.futures import ProcessPoolExecutor, as_completed
import importlib.util
import json
import math
from pathlib import Path
import subprocess
import tempfile
import time
import urllib.parse
import urllib.request


ROOT = Path(__file__).resolve().parent.parent
SCRIPTURE_PATH = ROOT / "data" / "bible" / "uploads" / "web-en.json"
MANIFEST_PATH = ROOT / "data" / "bible" / "web-en-chapter-audio-manifest.json"
OUT_DIR = ROOT / "public" / "verse-timings" / "web-en"
REPORT_PATH = ROOT / "data" / "bible" / "webp-verse-timings-generation-report.json"
ALIGNER_PATH = Path(__file__).resolve().parent / "whisper-verse-align.py"
REMOTE_OT = "https://theaudiopower.org/WEB2/Recordings"
REMOTE_NT = "https://theaudiopower.org/WEB/Recordings"

BOOK_NAMES = {
    "GEN": "Genesis", "EXO": "Exodus", "LEV": "Leviticus", "NUM": "Numbers",
    "DEU": "Deuteronomy", "JOS": "Joshua", "JDG": "Judges", "RUT": "Ruth",
    "1SA": "1 Samuel", "2SA": "2 Samuel", "1KI": "1 Kings", "2KI": "2 Kings",
    "1CH": "1 Chronicles", "2CH": "2 Chronicles", "EZR": "Ezra", "NEH": "Nehemiah",
    "EST": "Esther", "JOB": "Job", "PSA": "Psalms", "PRO": "Proverbs",
    "ECC": "Ecclesiastes", "SNG": "Song of Solomon", "ISA": "Isaiah", "JER": "Jeremiah",
    "LAM": "Lamentations", "EZK": "Ezekiel", "DAN": "Daniel", "HOS": "Hosea",
    "JOL": "Joel", "AMO": "Amos", "OBA": "Obadiah", "JON": "Jonah",
    "MIC": "Micah", "NAM": "Nahum", "HAB": "Habakkuk", "ZEP": "Zephaniah",
    "HAG": "Haggai", "ZEC": "Zechariah", "MAL": "Malachi", "MAT": "Matthew",
    "MRK": "Mark", "LUK": "Luke", "JHN": "John", "ACT": "Acts", "ROM": "Romans",
    "1CO": "1 Corinthians", "2CO": "2 Corinthians", "GAL": "Galatians",
    "EPH": "Ephesians", "PHP": "Philippians", "COL": "Colossians",
    "1TH": "1 Thessalonians", "2TH": "2 Thessalonians", "1TI": "1 Timothy",
    "2TI": "2 Timothy", "TIT": "Titus", "PHM": "Philemon", "HEB": "Hebrews",
    "JAS": "James", "1PE": "1 Peter", "2PE": "2 Peter", "1JN": "1 John",
    "2JN": "2 John", "3JN": "3 John", "JUD": "Jude", "REV": "Revelation",
}
BOOK_ORDER = list(BOOK_NAMES)
_ALIGNER = None


def load_aligner():
    global _ALIGNER
    if _ALIGNER is not None:
        return _ALIGNER
    spec = importlib.util.spec_from_file_location("askbible_webp_aligner", ALIGNER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load {ALIGNER_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    _ALIGNER = module
    return module


def audio_url(book_id: str, chapter: int) -> str:
    base = REMOTE_OT if BOOK_ORDER.index(book_id) < 39 else REMOTE_NT
    stem = BOOK_NAMES[book_id] if book_id in {"OBA", "PHM", "2JN", "3JN", "JUD"} else f"{BOOK_NAMES[book_id]} {chapter}"
    return f"{base}/{urllib.parse.quote(f'{stem}.mp3')}"


def download(url: str, target: Path) -> None:
    request = urllib.request.Request(url, headers={"User-Agent": "AskBible.me WEBP timing generator"})
    with urllib.request.urlopen(request, timeout=60) as response, target.open("wb") as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)
    if target.stat().st_size < 10_000:
        raise ValueError(f"downloaded audio is too small: {target.stat().st_size}")


def duration_sec(path: Path) -> float:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)],
        check=True, capture_output=True, text=True,
    )
    return float(result.stdout.strip())


def validate(timings: list[dict], verses: list[dict], duration: float) -> None:
    if len(timings) != len(verses):
        raise ValueError(f"timing count {len(timings)} != verse count {len(verses)}")
    previous = -1.0
    for expected, row in zip(verses, timings):
        verse, start, end = int(row["verse"]), float(row["start"]), float(row["end"])
        if verse != expected["verse"]:
            raise ValueError(f"expected verse {expected['verse']}, got {verse}")
        if not math.isfinite(start) or not math.isfinite(end) or start < previous or end < start:
            raise ValueError(f"invalid timing for verse {verse}: {start}..{end}")
        if end > duration + 2:
            raise ValueError(f"verse {verse} exceeds audio duration: {end} > {duration}")
        previous = start
    if timings and float(timings[-1]["end"]) < duration * 0.9:
        raise ValueError(f"alignment ends too early: {timings[-1]['end']} / {duration}")


def align_job(job: tuple[str, int, list[dict], str, bool]) -> dict:
    book_id, chapter, verses, model, force = job
    out_path = OUT_DIR / f"{book_id}-{chapter}.json"
    if out_path.exists() and not force:
        return {"bookId": book_id, "chapter": chapter, "status": "skipped"}
    with tempfile.TemporaryDirectory(prefix=f"askbible-webp-{book_id}-{chapter}-") as temp:
        audio_path = Path(temp) / f"{book_id}-{chapter}.mp3"
        download(audio_url(book_id, chapter), audio_path)
        duration = duration_sec(audio_path)
        aligner = load_aligner()
        timings = aligner.align_verses(str(audio_path), verses, model, "en")
        try:
            validate(timings, verses, duration)
        except ValueError:
            timings = aligner.transcribe_verses(str(audio_path), verses, model, "en")
            validate(timings, verses, duration)
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(timings, indent=2) + "\n", encoding="utf-8")
    return {"bookId": book_id, "chapter": chapter, "status": "completed", "durationSec": round(duration, 2), "verses": len(timings)}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--book")
    parser.add_argument("--chapter", type=int)
    parser.add_argument("--model", default="small", choices=["tiny", "base", "small", "medium", "large"])
    parser.add_argument("--workers", type=int, default=1)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--continue-on-error", action="store_true")
    parser.add_argument(
        "--reference",
        type=Path,
        default=SCRIPTURE_PATH,
        help="Scripture JSON whose wording matches the recording; verse numbers remain the binding key.",
    )
    args = parser.parse_args()
    if not args.all and not args.book:
        parser.error("choose --all or --book ID [--chapter N]")

    scripture = json.loads(args.reference.read_text(encoding="utf-8"))
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    wanted_book = args.book.strip().upper() if args.book else None
    jobs = []
    for entry in manifest["entries"]:
        book_id, chapter = entry["bookId"], int(entry["chapter"])
        if wanted_book and book_id != wanted_book:
            continue
        if args.chapter is not None and chapter != args.chapter:
            continue
        chapter_rows = scripture["books"][book_id][str(chapter)]
        verses = [
            {"verse": int(number), "text": " ".join(str(text).split())}
            for number, text in sorted(chapter_rows.items(), key=lambda item: int(item[0]))
            if str(text).strip()
        ]
        jobs.append((book_id, chapter, verses, args.model, args.force))

    started, results, failed = time.monotonic(), [], []
    with ProcessPoolExecutor(max_workers=max(1, args.workers)) as pool:
        futures = {pool.submit(align_job, job): (job[0], job[1]) for job in jobs}
        for index, future in enumerate(as_completed(futures), start=1):
            book_id, chapter = futures[future]
            try:
                result = future.result()
                results.append(result)
                print(f"[{index}/{len(jobs)}] {book_id} {chapter}: {result['status']}", flush=True)
            except Exception as error:
                failed.append({"bookId": book_id, "chapter": chapter, "error": str(error)})
                print(f"[{index}/{len(jobs)}] {book_id} {chapter}: ERROR {error}", flush=True)
                if not args.continue_on_error:
                    for pending in futures:
                        pending.cancel()
                    break

    report = {
        "requested": len(jobs),
        "completed": sum(row["status"] == "completed" for row in results),
        "skipped": sum(row["status"] == "skipped" for row in results),
        "failed": failed,
        "elapsedSec": round(time.monotonic() - started, 1),
        "model": args.model,
        "audioSource": "theaudiopower.org WEB/WEB2 MP3",
        "reference": str(args.reference.resolve().relative_to(ROOT))
        if args.reference.resolve().is_relative_to(ROOT)
        else str(args.reference),
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2), flush=True)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
