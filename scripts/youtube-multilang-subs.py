#!/usr/bin/env python3
"""YouTube 金句视频（英文版 epNN-en-dual）的 17 种外语字幕轨（D-35）。
经文逐节取各语言的正式圣经译本，不机器翻译；时间轴和英文字幕同一套（youtube-golden-verses.py --en --music）。

用法：
  python3 scripts/youtube-multilang-subs.py fetch        # 下载 17 本译本并解析（00/youtube/bible-foreign/，已有的跳过）
  python3 scripts/youtube-multilang-subs.py check        # 9 集要用的每一节：各译本有没有、章节号是否对得上
  python3 scripts/youtube-multilang-subs.py subs 1       # 出第 1 集 17 个 SRT：00/youtube/en-ep01/subs-ep01-<lang>.srt
  python3 scripts/youtube-multilang-subs.py upload 1     # 传第 1 集还没传过的字幕轨（每条 400 额度），进度记 series-state.json
  python3 scripts/youtube-multilang-subs.py upload all   # 9 集依次传，额度用完就停，下次接着传

译本出处 / 授权见 docs/授权登记.md；CC BY-SA 的要在视频说明栏注明（LANGS 里 credit 不为空的）。
"""
import importlib.util, io, json, re, sys, urllib.request, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
Y = ROOT / "00/youtube"
SRC = Y / "bible-foreign"
BOOKS = ("GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL "
         "AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS "
         "1PE 2PE 1JN 2JN 3JN JUD REV").split()

# YouTube 语言代码: (来源, 译本 id, 书卷名从哪本 eBible USFM 取, 说明栏署名——公有领域的留空)
# 来源 ebible = ebible.org/Scriptures/<id>_usfm.zip；getbible = api.getbible.net/v2/<id>.json（书卷名是英文，另取）
LANGS = {
    "es": ("ebible", "spaRV1909", None, ""),
    "pt": ("ebible", "porbr2018", None, "Português: Bíblia Livre (BLIVRE) © Diego Santos, Mario Sérgio, Marco Teles, CC BY 4.0"),
    "fr": ("getbible", "ls1910", "fraLSG", ""),
    "de": ("ebible", "deu1912", None, ""),
    "ru": ("getbible", "synodal", "russyn", ""),
    "it": ("ebible", "ita1927", None, ""),
    "ar": ("ebible", "arb-vd", None, ""),
    "vi": ("ebible", "vie1934", None, ""),
    "fil": ("getbible", "tagalog", "tglulb", ""),
    "hi": ("ebible", "hin2017", None, "Hindi: Indian Revised Version (IRV) © 2017–2019 Bridge Connectivity Solutions, CC BY-SA 4.0"),
    "sw": ("ebible", "swhulb", None, "Kiswahili: Unlocked Literal Bible © 2019 Door43 World Missions Community, CC BY-SA 4.0"),
    "ko": ("getbible", "korean", "kor", ""),
    "ja": ("getbible", "japkougo", "jpnm", ""),
    "id": ("ebible", "indayt", None, "Bahasa Indonesia: Alkitab Yang Terbuka (AYT) © 2011–2024 YLSA, CC BY-ND 4.0"),
    "uk": ("ebible", "ukr1871", None, ""),
    "pl": ("ebible", "polubg", None, "Polski: Uwspółcześniona Biblia Gdańska © 2018 Fundacja Wrota Nadziei, CC BY-ND 4.0"),
    "ro": ("getbible", "cornilescu", None, ""),
}
# 自动判定分节判错的卷，手工指定（2026-10-05 用乌克兰文逐节比对定的：诗 116、但 6 是 rsc 才对）
SCHEME_FIX = {"ru": {"PSA": "rsc", "DAN": "rsc"}}
# 标准分节表里没有的挪动：(书, 英文章, 起节, 止节, 译本章, 节号加减)
SHIFT = {"fr": [("ECC", 11, 9, 10, 12, -8), ("ECC", 12, 1, 14, 12, 2)]}  # LSG 传道书 12 章从「少年人哪」（英 11:9）开始
# 章内节数和分节表对不上的章（译本自己合并 / 拆分了节，后面整体错位），用一本已校准的近亲语言逐节找正确位置
ORACLE = {"uk": "ru", "pl": "ru", "fr": "es", "es": "pt"}  # 西语 RV1909 有 18 处空节（约拿 1:17 空着、2 章整体后移）
# 罗马尼亚语：eBible 只有西里尔字母版，书卷名照 Cornilescu 1924 手写
RO_NAMES = ("Geneza|Exodul|Leviticul|Numeri|Deuteronomul|Iosua|Judecători|Rut|1 Samuel|2 Samuel|1 Împăraţi|2 Împăraţi|1 Cronici|"
            "2 Cronici|Ezra|Neemia|Estera|Iov|Psalmii|Proverbe|Eclesiastul|Cântarea cântărilor|Isaia|Ieremia|Plângerile lui Ieremia|"
            "Ezechiel|Daniel|Osea|Ioel|Amos|Obadia|Iona|Mica|Naum|Habacuc|Ţefania|Hagai|Zaharia|Maleahi|Matei|Marcu|Luca|Ioan|"
            "Faptele apostolilor|Romani|1 Corinteni|2 Corinteni|Galateni|Efeseni|Filipeni|Coloseni|1 Tesaloniceni|2 Tesaloniceni|"
            "1 Timotei|2 Timotei|Tit|Filimon|Evrei|Iacov|1 Petru|2 Petru|1 Ioan|2 Ioan|3 Ioan|Iuda|Apocalipsa").split("|")


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    return urllib.request.urlopen(req, timeout=120).read()


SKIP = re.compile(r"^\\(id|ide|h|toc\d?|mt\d?|mte\d?|ms\d?|mr|s\d?|sr|r|d|sp|cl|rem|sts|usfm|is\d?|ip|ili\d?|imt\d?|io\d?|iot)\b.*$", re.M)
TOKEN = re.compile(r"\\c\s+(\d+)|\\v\s+(\d+)(?:-(\d+))?\S*\s*")


def clean(t):
    t = re.sub(r"\|[^\\]*?(?=\\w\*)", "", t)       # \w word|strong="H123"\w* → word
    t = re.sub(r"\\\+?[a-z]+\d*\*?", " ", t)        # 其余标记去掉，内容留下（\add \nd \wj \q1 \p …）
    t = t.replace("¶", "")
    return re.sub(r"\s+", " ", t).strip()


NAME_FIELD = {"vi": "toc1", "pl": "toc1", "ru": "toc3"}  # 默认 toc2；越南 toc2 是缩写（Thi / Gi），波兰 toc2 是属格（Psalmów）
RU_ORD = {"Первое": "1", "Второе": "2", "Третье": "3"}


def book_name(lang, fields):
    n = fields.get(NAME_FIELD.get(lang, "toc2")) or fields.get("toc2") or fields["h"]
    if lang == "ru":  # 「Первое послание к Коринфянам」→「1 Коринфянам」，「Послание Иакова」→「Иакова」
        n = re.sub(r"^(Первое|Второе|Третье) (соборное )?послание (к |апостола )?", lambda m: RU_ORD[m.group(1)] + " ", n)
        n = re.sub(r"^(Соборное )?[Пп]ослание (к |апостола )?", "", n).replace("Притчи Соломона", "Притчи")
    if n.isupper():
        n = n.title()  # 他加禄 ULB 有几卷是全大写（JUAN）
    return n


def parse_usfm(z, lang=None):
    """eBible USFM zip → ({book: 书卷名}, {"BOOK c:v": 文字})"""
    names, verses = {}, {}
    for n in sorted(z.namelist()):
        if not n.endswith(".usfm"):
            continue
        s = z.read(n).decode("utf-8-sig")
        book = re.search(r"^\\id\s+(\w{3})", s, re.M).group(1)
        if book not in BOOKS:
            continue
        names[book] = book_name(lang, {k: v.strip() for k, v in re.findall(r"^\\(h|toc\d)\s+(.+)$", s, re.M)})
        s = re.sub(r"\\f\s.*?\\f\*|\\fe\s.*?\\fe\*|\\x\s.*?\\x\*", "", s, flags=re.S)
        s = SKIP.sub("", s)
        ch, key, pos = 0, None, None
        toks = list(TOKEN.finditer(s)) + [None]
        for a, b in zip(toks, toks[1:]):
            end = b.start() if b else len(s)
            if a.group(1):
                ch = int(a.group(1))
                continue
            v1, v2 = int(a.group(2)), int(a.group(3) or a.group(2))
            text = clean(s[a.end():end])
            for v in range(v1, v2 + 1):  # 合并节（如 \v 1-2）：每节都给整段，check 会报出来
                verses[f"{book} {ch}:{v}"] = text
    return names, verses


def fetch():
    SRC.mkdir(parents=True, exist_ok=True)
    for lang, (kind, tid, names_from, _) in LANGS.items():
        out = SRC / f"{lang}.json"
        if out.exists():
            continue
        if kind == "ebible":
            names, verses = parse_usfm(zipfile.ZipFile(io.BytesIO(get(f"https://ebible.org/Scriptures/{tid}_usfm.zip"))), lang)
        else:
            d = json.loads(get(f"https://api.getbible.net/v2/{tid}.json"))
            books = [b for b in d["books"] if b["nr"] <= 66]  # 俄文 synodal 带次经（nr 67 以后），不要
            assert len(books) == 66 and books[18]["chapters"][149]["chapter"] == 150, (tid, len(books))
            verses = {f"{BOOKS[b['nr'] - 1]} {c['chapter']}:{v['verse']}": clean(v["text"])
                      for b in books for c in b["chapters"] for v in c["verses"]}
            if names_from:
                names = parse_usfm(zipfile.ZipFile(io.BytesIO(get(f"https://ebible.org/Scriptures/{names_from}_usfm.zip"))), lang)[0]
            else:
                names = dict(zip(BOOKS, RO_NAMES))
        out.write_text(json.dumps({"source": kind, "id": tid, "names": names, "verses": verses}, ensure_ascii=False))
        print(f"{lang} {tid}: {len(verses)} 节，{len(names)} 卷", flush=True)


def golden():
    """英文版的分集（和视频同一套参数），返回 9 集 × 每节 dict。"""
    sys.argv[1:] = ["plan", "--en", "--music"]
    spec = importlib.util.spec_from_file_location("g", ROOT / "scripts/youtube-golden-verses.py")
    g = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(g)
    return g, g.plan(g.load_verses())


def load(lang):
    return json.loads((SRC / f"{lang}.json").read_text())


VRS = ROOT / "scripts/versification"
SCHEMES = ("eng", "org", "rso", "rsc", "vul", "lxx")


def ref(r):
    b, cv = r.split(" ")
    c, v = cv.split(":")
    return b, int(c), int(v)


def read_vrs(name):
    """→ (每章节数 {(书, 章): 最大节}, 本分节 → 原文分节 {(书,章,节): (书,章,节)})"""
    sizes, to_org = {}, {}
    for line in (VRS / f"{name}.vrs.txt").read_text(encoding="utf-8-sig").splitlines():
        line = line.split("#")[0].strip().lstrip("&")
        if not line:
            continue
        if "=" in line:
            if re.search(r"\d[a-z]", line):  # 半节对应（如 1a）不处理，按整节算
                line = re.sub(r"(\d)[a-z]", r"\1", line)
            left, right = (x.strip() for x in line.split("="))
            (lb, lc, lv), (rb, rc, rv) = ref(left.split("-")[0]), ref(right.split("-")[0])
            le = int(left.split("-")[1]) if "-" in left.split(":")[1] else lv
            for i in range(le - lv + 1):
                to_org.setdefault((lb, lc, lv + i), (rb, rc, rv + i))
        elif line[:3] in BOOKS:
            b, *chs = line.split()
            for x in chs:
                if ":" in x:
                    c, v = x.split(":")
                    sizes[(b, int(c))] = int(v)
    return sizes, to_org


_VRS = {}


def vrs(name):
    if name not in _VRS:
        _VRS[name] = read_vrs(name)
    return _VRS[name]


def detect(verses):
    """逐卷判定这本译本用哪套分节：章节数和哪套最吻合就用哪套（法文 LSG 诗篇用原文分节、其余用英文分节这种混合也能认出来）。"""
    have = chapter_sizes(verses)
    out = {}
    for b in BOOKS:
        mine = {k: n for k, n in have.items() if k[0] == b}
        score = {s: sum(vrs(s)[0].get(k) == n for k, n in mine.items()) - abs(len(mine) - sum(k[0] == b for k in vrs(s)[0]))
                 for s in SCHEMES}
        best = max(SCHEMES, key=lambda s: score[s])
        out[b] = best if score[best] >= score["eng"] + 2 else "eng"  # 只差一章（如启 12:18 拆分）不算换分节
    return out


def mapper(verses, fix=None):
    """英文（WEB = eng 分节）的 (书,章,节) → 这本译本里的 "书 章:节"。"""
    scheme = {**detect(verses), **(fix or {})}
    eng_to_org = vrs("eng")[1]
    inv = {s: {} for s in SCHEMES}
    for s in SCHEMES:
        for k, o in vrs(s)[1].items():
            if o not in inv[s] or inv[s][o][2] == 0:  # 「标题 = 第 0 节」和正文同时对到一节时取正文那条
                inv[s][o] = k

    def f(b, c, v):
        if scheme[b] == "eng":
            return f"{b} {c}:{v}"
        o = eng_to_org.get((b, c, v), (b, c, v))
        t = inv[scheme[b]].get(o, o)
        return f"{t[0]} {t[1]}:{t[2]}"
    return f, scheme


def chapter_sizes(verses):
    n = {}
    for k in verses:
        b, cv = k.split(" ")
        c, v = map(int, cv.split(":"))
        n[(b, c)] = max(n.get((b, c), 0), v)
    return n


def grams(t):
    t = re.sub(r"[\W\d_]+", "", t.lower())
    return {t[i:i + 3] for i in range(len(t) - 2)}


def sim(a, b):
    a, b = grams(a), grams(b)
    return len(a & b) / max(1, len(a | b))


def tidy(lang, t):
    t = re.sub(r"\s*\([^()]*\d+[:.]\d+[^()]*\)", "", t)  # 印地 IRV 正文里夹的交叉引用「(यशा. 40:11)」
    t = re.sub(r"\s+([,.)\]»”’])" if lang == "fr" else r"\s+([,.;:!?)\]»”’])", r"\1", t)  # 法语 ; : ! ? 前本来就空格
    return re.sub(r"\s+", " ", t).strip()


_RES = {}


def resolve(lang, need):
    """英文的每一节 (书,章,节) → (这本译本的文字, 它自己的 "书 章:节")；缺的不在结果里。"""
    if lang in _RES:
        return _RES[lang]
    d = load(lang)
    vs = d["verses"]
    f, scheme = mapper(vs, SCHEME_FIX.get(lang))
    have = chapter_sizes(vs)
    bad = {k for k, n in have.items() if vrs(scheme[k[0]])[0].get(k) != n}
    for k, t in vs.items():  # 有空节 = 节被挪到别处了（多半挪进下一章开头），这章和下一章都要逐节找
        if not t.strip():
            b, c, _ = ref(k)
            bad |= {(b, c), (b, c + 1)}
    oracle = resolve(ORACLE[lang], need) if lang in ORACLE else {}
    out, fixed = {}, []
    for x in need:
        b, c, v = ref(f(*x))
        for sb, sc_, v1, v2, nc, dv in SHIFT.get(lang, []):
            if (x[0], x[1]) == (sb, sc_) and v1 <= x[2] <= v2:
                c, v = nc, x[2] + dv
        if (b, c) in bad and x in oracle:
            o = oracle[x][0]
            sc = {k: sim(vs.get(f"{b} {c}:{v + k}", ""), o) for k in range(-2, 3)}
            k = max(sc, key=sc.get)
            if k and sc[k] >= 0.08 and sc[k] - sc[0] >= 0.05:
                fixed.append((x, f"{b} {c}:{v}", f"{b} {c}:{v + k}"))
                v += k
        t = tidy(lang, vs.get(f"{b} {c}:{v}", ""))
        if t:
            out[x] = (t, f"{d['names'][b]} {c}:{v}")
    _RES[lang] = out
    out_fixed[lang] = fixed
    return out


out_fixed = {}


def need_verses():
    _, eps = golden()
    return [(v["book"], v["ch"], v["v"]) for ep in eps for v in ep]


def check():
    need = need_verses()
    for lang in LANGS:
        r = resolve(lang, need)
        miss = [f"{b} {c}:{v}" for b, c, v in need if (b, c, v) not in r]
        moved = sum(r[x][1].split(" ")[-1] != f"{x[1]}:{x[2]}" for x in r)
        print(f"{lang}: 缺 {len(miss)} {miss[:5]}  节号和英文不同 {moved} 节  逐节纠偏 {len(out_fixed.get(lang, []))} 节 "
              f"{out_fixed.get(lang, [])[:4]}")


def subs(n):
    """第 n 集 17 个 SRT。时间轴照 youtube-golden-verses.py 的 subs()（每节从淡入到淡出），经文换成各译本、书卷名换成当地名。
    有缺节的语言不出（check 先修好）。"""
    g, eps = golden()
    need = [(v["book"], v["ch"], v["v"]) for ep in eps for v in ep]
    cues, pos = [], g.frames(g.INTRO)
    for v in eps[n - 1]:
        nfr = g.seg_frames(v)
        cues.append(((v["book"], v["ch"], v["v"]), pos / g.FPS, (pos + nfr) / g.FPS - g.BLANK))
        pos += nfr

    def ts(t):
        ms = int(round(t * 1000))
        return f"{ms // 3600000:02d}:{ms % 3600000 // 60000:02d}:{ms % 60000 // 1000:02d},{ms % 1000:03d}"
    out = Y / f"en-ep{n:02d}"
    out.mkdir(parents=True, exist_ok=True)
    files = []
    for lang in LANGS:
        r = resolve(lang, need)
        miss = [k for k, _, _ in cues if k not in r]
        if miss:
            print(f"跳过 {lang}：缺 {len(miss)} 节，如 {miss[:3]}")
            continue
        f = out / f"subs-ep{n:02d}-{lang}.srt"
        f.write_text("".join(f"{i}\n{ts(a)} --> {ts(b)}\n{r[k][0]}\n— {r[k][1]}\n\n" for i, (k, a, b) in enumerate(cues, 1)))
        files.append(f)
    print(f"第 {n} 集：{len(cues)} 条 × {len(files)} 种语言")
    for f in files:
        print(f)
    return files


HOLD = {"ja", "ko", "ro"}  # 版权待 Josh 定（docs/OPEN-ITEMS.md），先不传
STATE = Y / "series-state.json"


def upload(eps, wait=False):
    """传字幕轨：每条 400 额度（每天 1 万 ≈ 25 条）。传过的记在 series-state.json 那集的 captions 里，不重复传。
    额度用完：默认停下（下次再跑接着传）；--wait 就睡到美西午夜额度重置后继续。"""
    import datetime, time
    from zoneinfo import ZoneInfo
    from googleapiclient.errors import HttpError
    from googleapiclient.http import MediaFileUpload
    spec = importlib.util.spec_from_file_location("u", ROOT / "scripts/youtube-upload.py")
    u = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(u)
    y = u.yt("still")
    for n in eps:
        k = f"ep{n:02d}-en-dual"
        for lang in LANGS:
            if lang in HOLD or lang in json.loads(STATE.read_text())[k].get("captions", []):
                continue
            f = Y / f"en-ep{n:02d}/subs-ep{n:02d}-{lang}.srt"
            if not f.exists():
                print(f"{k} {lang}：没有 SRT，先跑 subs {n}", flush=True)
                continue
            while True:
                try:
                    y.captions().insert(part="snippet", body={"snippet": {"videoId": json.loads(STATE.read_text())[k]["video_id"],
                                                                          "language": lang, "name": ""}},
                                        media_body=MediaFileUpload(str(f), mimetype="application/octet-stream")).execute()
                    break
                except HttpError as e:
                    if "quota" not in str(e).lower():
                        raise
                    if not wait:
                        print(f"{datetime.datetime.now():%m-%d %H:%M} 今天额度用完，停在 {k} {lang}；明天再跑 upload 接着传", flush=True)
                        return
                    now = datetime.datetime.now(ZoneInfo("America/Los_Angeles"))
                    nxt = (now + datetime.timedelta(days=1)).replace(hour=0, minute=10, second=0, microsecond=0)
                    print(f"{datetime.datetime.now():%m-%d %H:%M} 额度用完，等 {(nxt - now).total_seconds() / 3600:.1f} 小时", flush=True)
                    time.sleep((nxt - now).total_seconds())
            st = json.loads(STATE.read_text())  # 别的进程也在写这个文件：现读现改，只动这一项
            st[k].setdefault("captions", []).append(lang)
            STATE.write_text(json.dumps(st, ensure_ascii=False, indent=2))
            print(f"{datetime.datetime.now():%m-%d %H:%M} {k}：字幕轨 {lang} 已上传", flush=True)
    print("全部传完", flush=True)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "fetch":
        fetch()
    elif cmd == "check":
        check()
    elif cmd == "subs":
        for n in (range(1, 10) if sys.argv[2] == "all" else [int(sys.argv[2])]):
            subs(n)
    elif cmd == "upload":
        upload(range(1, 10) if sys.argv[2] == "all" else [int(sys.argv[2])], wait="--wait" in sys.argv)
    else:
        sys.exit(__doc__)
