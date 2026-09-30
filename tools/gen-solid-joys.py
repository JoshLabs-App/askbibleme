#!/usr/bin/env python3
"""
纯全喜乐（约翰·派博每日灵修，忠信福音事工中文版）：58 个 Word 稿 → 365 天的 JSON。

输入：private/solid-joys-zh/docx/all/*.docx（授权方 OneDrive 给的原稿，不进仓库）
输出：private/solid-joys-zh/solid-joys-zh.json（不进仓库：仓库是公开的，全文只经 R2 发给 App）

每篇在稿子里固定三段：「M月D日 标题」/ 当天经文（出处）/ 正文若干段。
按正文里的日期标题切分，不靠文件名（文件名写法不统一）。
授权与署名见 docs/content-permissions.md，放在哪、怎么呈现见 DECISIONS D-6 / D-7。

用法：
  python3 tools/gen-solid-joys.py
  npx --no-install wrangler r2 object put askbible-media/devotionals/solid-joys-zh.json \
    --file private/solid-joys-zh/solid-joys-zh.json --content-type "application/json; charset=utf-8" \
    --cache-control "public, max-age=3600" --remote
App 读的地址：https://pub-f30fb48025d841f09c37bb9b52df5354.r2.dev/devotionals/solid-joys-zh.json
（App 有缓存就不重下；改了内容要让用户拿到新版，得在 App 里加版本检查，目前没做）
"""
import datetime
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "private/solid-joys-zh/docx/all"
OUT = ROOT / "private/solid-joys-zh/solid-joys-zh.json"
# 日期 → befaithful.net 上的 mp3 地址（从专辑 /node/299 的列表页抓的，365 集文件名都和日期对得上）。
# 音频直接引用他们的地址，不自己托管（DECISIONS D-6）
AUDIO = ROOT / "private/solid-joys-zh/befaithful-audio.json"

# 书卷目录（中文全名 → USFM id），直接读安卓 core 里的 BibleCatalog，免得另抄一份
CATALOG = ROOT / "apps/askbible-android/core/src/main/kotlin/me/askbible/native_/data/BibleCatalog.kt"
# 稿子里出现过的缩写
ABBR = {"来": "HEB", "林前": "1CO", "林后": "2CO", "罗": "ROM", "西": "COL", "徒": "ACT"}


def book_ids():
    ids = {m.group(2): m.group(1) for m in re.finditer(r'BookRef\(\d+,\s*"(\w+)",\s*"([^"]+)"', CATALOG.read_text(encoding="utf-8"))}
    ids.update(ABBR)
    return ids


def resolve_ref(ref: str, ids):
    """出处 → (书卷 id, 章)，给「点出处进那一章」用；认不出返回 (None, None)"""
    m = re.match(r"\s*([^\d\s:：]+?)\s*(\d+)", ref)
    if not m:
        return None, None
    name = m.group(1).replace("《", "").replace("》", "")
    return ids.get(name), int(m.group(2))


# Word 稿的笔误，以网站为准：9/25 的标题抄成了前一天的，和当天经文（申32:46-47）对不上
TITLE_FIX = {"09-25": "坚立生命在真理之上"}

# 日期有两种写法：「10月1日」和「一月十五日」
NUM = r"[0-9一二三四五六七八九十]{1,3}"
# 「日」字偶尔漏掉（8 月 15 日那篇写成「8月15 我们为此受造」）
HEADER = re.compile(rf"^\s*({NUM})\s*月\s*({NUM})\s*日?\s+(.*?)\s*$|^\s*({NUM})\s*月\s*({NUM})\s*日\s*(.*?)\s*$")
CN = {c: i for i, c in enumerate("零一二三四五六七八九")}


def to_int(s: str) -> int:
    if s.isdigit():
        return int(s)
    if "十" not in s:
        return CN[s]
    tens, _, ones = s.partition("十")
    return (CN[tens] if tens else 1) * 10 + (CN[ones] if ones else 0)
# 经文行以（出处）收尾，出处里有卷名 + 章:节
# 出处写法：（诗篇37:4）/ （彼得前书4章10节）/ (提摩太后书3：1-2)。 后面可能还跟一个句号
REF_TAIL = re.compile(r"^(.*?)\s*[（(]([^（()）]*\d+\s*(?:[:：]\s*\d+|[章篇]\s*\d+\s*节)[^（()）]*)[)）]\s*[。.]?\s*$")


# 原稿本身就没有单独经文行的日子（直接进正文），照原稿呈现，不补
NO_VERSE_LINE = {"01-11"}


def docx_text(path: Path) -> str:
    return subprocess.run(["textutil", "-convert", "txt", "-stdout", str(path)],
                          capture_output=True, text=True, check=True).stdout


def parse_file(path: Path):
    days, cur = [], None
    for raw in docx_text(path).splitlines():
        line = raw.replace("　", " ").strip()
        m = HEADER.match(line)
        # 标题行短；正文里偶尔也会以「X月X日」开头，限制长度挡掉
        g = m and ((m.group(1), m.group(2), m.group(3)) if m.group(1) else (m.group(4), m.group(5), m.group(6)))
        if g and len(line) <= 40 and 1 <= to_int(g[0]) <= 12:
            cur = {"month": to_int(g[0]), "day": to_int(g[1]), "title": g[2], "lines": [], "file": path.name}
            days.append(cur)
            continue
        if cur is not None and line:
            cur["lines"].append(line)
    return days


def build(entry):
    lines = list(entry["lines"])
    # 经文出处折行：「……（彼得前书」+「4:10）」接回一行
    if len(lines) > 1 and "（" in lines[0] and "）" not in lines[0] and len(lines[1]) <= 20:
        lines[0:2] = [lines[0] + lines[1]]
    verse, ref, body = "", "", lines
    if lines:
        m = REF_TAIL.match(lines[0])
        if m:
            verse, ref, body = m.group(1).strip(), m.group(2).strip(), lines[1:]
    return {
        "md": f"{entry['month']:02d}-{entry['day']:02d}",
        "title": entry["title"],
        "verse": verse,
        "ref": ref,
        "paragraphs": body,
        "audio": None,
    }


def main():
    files = sorted(SRC.glob("*.docx"))
    if not files:
        sys.exit(f"找不到原稿：{SRC}")
    raw = [d for f in files for d in parse_file(f)]

    by_md, problems = {}, []
    for e in raw:
        d = build(e)
        if d["md"] in by_md:
            old = by_md[d["md"]]
            # 同一天出现两次：内容一样就忽略；不一样时「最终版」优先于「修改」稿，两份都是最终版才要人看
            if old["paragraphs"] != d["paragraphs"]:
                new_final, old_final = "最终" in e["file"], "最终" in old["_file"]
                if new_final and not old_final:
                    d["_file"] = e["file"]; by_md[d["md"]] = d
                elif new_final == old_final:
                    problems.append(f"{d['md']} 两份稿内容不同：{old['_file']} / {e['file']}")
            continue
        d["_file"] = e["file"]
        if not d["ref"] and d["md"] not in NO_VERSE_LINE:
            problems.append(f"{d['md']} 没认出经文出处：{e['file']} 首行「{(e['lines'] or [''])[0][:30]}」")
        if len(d["paragraphs"]) < 2:
            problems.append(f"{d['md']} 正文太短（{len(d['paragraphs'])} 段）：{e['file']}")
        by_md[d["md"]] = d

    missing = []
    day = datetime.date(2023, 1, 1)  # 非闰年：2 月 29 日本来就没有
    while day.year == 2023:
        md = day.strftime("%m-%d")
        if md not in by_md:
            missing.append(md)
        day += datetime.timedelta(1)

    audio = json.loads(AUDIO.read_text(encoding="utf-8")) if AUDIO.exists() else {}
    ids = book_ids()
    for md, d in by_md.items():
        d["refBook"], d["refChapter"] = resolve_ref(d["ref"], ids) if d["ref"] else (None, None)
        if d["ref"] and not d["refBook"]:
            problems.append(f"{md} 出处认不出书卷：{d['ref']}")
        d["title"] = TITLE_FIX.get(md, d["title"])
        d["audio"] = (audio.get(md) or {}).get("mp3")
    no_audio = [md for md in sorted(by_md) if not by_md[md]["audio"]]
    if audio and no_audio:
        problems.append(f"没有音频的日子：{' '.join(no_audio)}")
    days = [{k: v for k, v in by_md[md].items() if k != "_file"} for md in sorted(by_md)]
    OUT.write_text(json.dumps({
        "version": 1,
        "title": "约翰·派博每日灵修",
        "credit": {
            "author": "John Piper / Desiring God",
            "translation": "忠信福音事工",
            "link": "https://www.befaithful.net",
        },
        "days": days,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    chars = sum(len("".join(d["paragraphs"])) for d in days)
    print(f"{len(files)} 个文件 → {len(days)} 天，正文约 {chars} 字，{OUT.stat().st_size // 1024} KB → {OUT.relative_to(ROOT)}")
    if missing:
        print("缺的日子：", " ".join(missing))
    for p in problems:
        print("⚠️ ", p)
    if missing or problems:
        sys.exit(1)


if __name__ == "__main__":
    main()
