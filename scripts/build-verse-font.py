#!/usr/bin/env python3
"""
金句字体 AskBibleSong（DECISIONS D-11）：和「听到」大标题、YouTube 封面同款思源宋体
（Noto Serif SC，OFL），取 wght 700 再子集化，给网页版首页的金句用。

字表 = 站内中文译本（public/scripture/<译本>/*.json）里出现的全部汉字和标点 + 国标一级 3755 字 + ASCII。
简体、繁体各出一个文件，浏览器只下当前语言用的那一个：
  public/fonts/AskBibleSong-SC-Bold.woff2   简体译本的字
  public/fonts/AskBibleSong-TC-Bold.woff2   繁体译本的字

新增中文译本、或经文里出现了字体里没有的字（会回落到系统宋体）时重跑。
字体源在 01youtube/tools/fonts/NotoSerifSC-VF.ttf；public/scripture 不进仓库，要在有这份数据的目录里跑。
用法（项目根目录，要 fontTools + brotli，01youtube 的 venv 里有）：
  ~/Desktop/APP/01youtube/.venv/bin/python scripts/build-verse-font.py [scripture 目录]
"""

import glob, re, sys
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

SRC = Path.home() / "Desktop/APP/01youtube/tools/fonts/NotoSerifSC-VF.ttf"
SCRIPTURE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("public/scripture")
OUT = Path("public/fonts")
SETS = {
    "SC": ["cuv-simp", "cbs-zh", "otb-zh-hans", "swcb-zh"],
    "TC": ["cuv-trad", "otb-zh-hant"],
}
CJK = re.compile(r"[　-〿一-鿿㐀-䶿＀-￯·—…“”‘’]")

base = {chr(c) for c in range(0x20, 0x7F)}
gb1 = set()
for b1 in range(0xB0, 0xD8):  # GB2312 一级字（0xB0A1–0xD7F9）：界面文案、书卷名兜底
    for b2 in range(0xA1, 0xFF):
        try:
            gb1.add(bytes([b1, b2]).decode("gb2312"))
        except UnicodeDecodeError:
            pass

OUT.mkdir(parents=True, exist_ok=True)
for tag, translations in SETS.items():
    chars = set(base)
    if tag == "SC":
        chars |= gb1
    for tr in translations:
        files = glob.glob(str(SCRIPTURE / tr / "*.json"))
        if not files:
            sys.exit(f"找不到 {SCRIPTURE / tr}（public/scripture 不进仓库，换到有数据的目录或把路径作为参数传进来）")
        for f in files:
            chars |= set(CJK.findall(Path(f).read_text(encoding="utf-8")))
    font = instantiateVariableFont(TTFont(SRC), {"wght": 700})
    cmap = font.getBestCmap()
    missing = sorted(c for c in chars if ord(c) not in cmap)
    opt = subset.Options()
    opt.layout_features = ["*"]
    opt.name_IDs = ["*"]
    sub = subset.Subsetter(opt)
    sub.populate(text="".join(chars))
    sub.subset(font)
    for rec in font["name"].names:
        if rec.nameID in (1, 4, 16):
            rec.string = f"AskBibleSong {tag}"
        elif rec.nameID == 6:
            rec.string = f"AskBibleSong-{tag}-Bold"
    out = OUT / f"AskBibleSong-{tag}-Bold.woff2"
    font.flavor = "woff2"
    font.save(out)
    print(f"{tag}: {len(chars)} 字 → {out}（{out.stat().st_size // 1024} KB）；源字体里没有的字 {len(missing)} 个 {''.join(missing[:40])}")
