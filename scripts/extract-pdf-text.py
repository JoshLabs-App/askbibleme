#!/usr/bin/env python3
"""Extract plain text from a PDF file. Requires: pip install pypdf"""
import sys

try:
    from pypdf import PdfReader
except ImportError as exc:
    raise SystemExit(
        "pypdf is required: pip install --break-system-packages pypdf"
    ) from exc


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit(f"Usage: {sys.argv[0]} <input.pdf> <output.txt>")
    reader = PdfReader(sys.argv[1])
    text = "\n".join((page.extract_text() or "") for page in reader.pages)
    with open(sys.argv[2], "w", encoding="utf-8") as out:
        out.write(text)


if __name__ == "__main__":
    main()
