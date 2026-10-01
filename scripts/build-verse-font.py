#!/usr/bin/env python3
"""
金句字体 AskBibleSong（DECISIONS D-11）：和「听到」大标题、YouTube 封面同款思源宋体
（Noto Serif SC，OFL），取 wght 700 再子集化，给网页版首页的金句用。

字表 = 站内中文译本（public/scripture/<译本>/*.json）里出现的全部汉字和标点 + 国标一级 3755 字 + ASCII。
简体、繁体各出一个文件，浏览器只下当前语言用的那一个：
  public/fonts/AskBibleSong-SC-Bold.woff2   简体译本的字
  public/fonts/AskBibleSong-TC-Bold.woff2   繁体译本的字

原生 App（DECISIONS D-19）用同一份字表另出一个简繁合并的 TTF（原生不认 woff2，两端又都要能随时切简繁，合一份比两份小），
同一个文件放两处：
  apps/askbible-android/app/src/main/assets/fonts/AskBibleSong-Bold.ttf
  apps/askbible-ios/AskBible/Resources/Fonts/AskBibleSong-Bold.ttf

新增中文译本、或经文里出现了字体里没有的字（会回落到系统宋体）时重跑。
字体源在 01youtube/tools/fonts/NotoSerifSC-VF.ttf；public/scripture 不进仓库，要在有这份数据的目录里跑。
用法（项目根目录，要 fontTools + brotli，01youtube 的 venv 里有）：
  ~/Desktop/APP/01youtube/.venv/bin/python scripts/build-verse-font.py [scripture 目录]
"""

import glob, re, shutil, sys
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

SRC = Path.home() / "Desktop/APP/01youtube/tools/fonts/NotoSerifSC-VF.ttf"
SCRIPTURE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("public/scripture")
OUT = Path("public/fonts")
NATIVE_OUT = [
    Path("apps/askbible-android/app/src/main/assets/fonts/AskBibleSong-Bold.ttf"),
    Path("apps/askbible-ios/AskBible/Resources/Fonts/AskBibleSong-Bold.ttf"),
]
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


def build(chars, family, postscript, out, flavor=None):
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
            rec.string = family
        elif rec.nameID == 6:
            rec.string = postscript
    # 明确标成粗体：安卓 / iOS 按这几个标志认字重，认成常规体会再合成一次加粗，笔画发糊
    font["OS/2"].usWeightClass = 700
    font["OS/2"].fsSelection = (font["OS/2"].fsSelection & ~0x40) | 0x20
    font["head"].macStyle |= 0x01
    for rec in font["name"].names:
        if rec.nameID in (2, 17):
            rec.string = "Bold"
    font.flavor = flavor
    font.save(out)
    print(f"{family}: {len(chars)} 字 → {out}（{out.stat().st_size // 1024} KB）；源字体里没有的字 {len(missing)} 个 {''.join(missing[:40])}")


OUT.mkdir(parents=True, exist_ok=True)
union = set()
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
    union |= chars
    build(chars, f"AskBibleSong {tag}", f"AskBibleSong-{tag}-Bold", OUT / f"AskBibleSong-{tag}-Bold.woff2", "woff2")

# 原生：简繁合并 + Latin-1（夹在中文里的外文）。不含假名和别的文字——原生端只给含汉字、不含假名的金句用这个字体
union |= {chr(c) for c in range(0xA0, 0x100)}
build(union, "AskBibleSong", "AskBibleSong-Bold", NATIVE_OUT[0])
shutil.copyfile(NATIVE_OUT[0], NATIVE_OUT[1])
