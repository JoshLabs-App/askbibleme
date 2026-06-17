#!/usr/bin/env python3
"""Capture frames during home↔read tab switches; report mean pixel delta spikes (flicker)."""
from __future__ import annotations

import subprocess
import time
from pathlib import Path

try:
    from PIL import Image
    import numpy as np
except ImportError:
    raise SystemExit("pip install pillow numpy required")

OUT = Path("/tmp/askbible-tab-flicker")
OUT.mkdir(exist_ok=True)


def shot(name: str) -> Path:
    path = OUT / f"{name}.png"
    subprocess.run(
        ["xcrun", "simctl", "io", "booted", "screenshot", str(path)],
        check=True,
        capture_output=True,
    )
    return path


def open_url(url: str) -> None:
    subprocess.run(["xcrun", "simctl", "openurl", "booted", url], check=True, capture_output=True)


def mean_abs_diff(a: Path, b: Path) -> float:
    ia = np.asarray(Image.open(a).convert("RGB"), dtype=np.int16)
    ib = np.asarray(Image.open(b).convert("RGB"), dtype=np.int16)
    h = min(ia.shape[0], ib.shape[0])
    w = min(ia.shape[1], ib.shape[1])
    return float(np.abs(ia[:h, :w] - ib[:h, :w]).mean())


def capture_transition(label: str, url: str, frames: int = 12, interval: float = 0.04) -> list[float]:
    open_url(url)
    paths: list[Path] = []
    for i in range(frames):
        paths.append(shot(f"{label}-{i:02d}"))
        time.sleep(interval)
    deltas = [mean_abs_diff(paths[i - 1], paths[i]) for i in range(1, len(paths))]
    return deltas


def main() -> None:
    print("Warm up: home")
    open_url("askbible://")
    time.sleep(2)
    shot("warm-home")
    open_url("askbible://read")
    time.sleep(2)
    shot("warm-read")

    print("\n=== to-read transition ===")
    open_url("askbible://")
    time.sleep(1.2)
    to_read = capture_transition("to-read", "askbible://read")
    print("frame deltas:", [round(d, 2) for d in to_read])
    print("max:", round(max(to_read), 2), "mean:", round(sum(to_read) / len(to_read), 2))

    time.sleep(1)
    print("\n=== to-home transition ===")
    open_url("askbible://read")
    time.sleep(1.2)
    to_home = capture_transition("to-home", "askbible://")
    print("frame deltas:", [round(d, 2) for d in to_home])
    print("max:", round(max(to_home), 2), "mean:", round(sum(to_home) / len(to_home), 2))

    print("\n=== stability: read held ===")
    open_url("askbible://read")
    time.sleep(1.5)
    stable_read = capture_transition("stable-read", "askbible://read")
    print("max:", round(max(stable_read), 2))

    print("\n=== stability: home held ===")
    open_url("askbible://")
    time.sleep(1.5)
    stable_home = capture_transition("stable-home", "askbible://")
    print("max:", round(max(stable_home), 2))

    # Heuristic thresholds (0-255 scale per channel mean abs diff)
    FLICKER_MAX = 18.0
    STABLE_MAX = 4.0
    bad = []
    if max(to_read) > FLICKER_MAX:
        bad.append(f"to-read max {max(to_read):.1f} > {FLICKER_MAX}")
    if max(to_home) > FLICKER_MAX:
        bad.append(f"to-home max {max(to_home):.1f} > {FLICKER_MAX}")
    if max(stable_read) > STABLE_MAX:
        bad.append(f"stable-read max {max(stable_read):.1f} > {STABLE_MAX}")
    if max(stable_home) > STABLE_MAX:
        bad.append(f"stable-home max {max(stable_home):.1f} > {STABLE_MAX}")

    if bad:
        print("\nFAIL:", "; ".join(bad))
        raise SystemExit(1)
    print("\nPASS: tab transitions within flicker thresholds")


if __name__ == "__main__":
    main()
