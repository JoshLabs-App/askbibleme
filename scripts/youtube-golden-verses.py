#!/usr/bin/env python3
"""YouTube 金句朗读长视频（4K 横版）。按常用程度排序、每集 490 节（70×7）；分集见 docs/DECISIONS.md D-5，
版面（字体、位置、阴影、淡入淡出、封面）见 docs/youtube-visual-spec.md。

用法：
  python3 scripts/youtube-golden-verses.py plan          # 只看分集，不渲染
  python3 scripts/youtube-golden-verses.py render 1      # 渲染第 1 集（加 --keep 保留分段，方便只重做片头片尾）
  python3 scripts/youtube-golden-verses.py render 1 --limit 20   # 试跑：只做前 20 节
  python3 scripts/youtube-golden-verses.py cover 1       # 出第 1 集朗读版 + 纯音乐版封面
  python3 scripts/youtube-golden-verses.py still 1       # 出一张片内样帧（不渲染视频）

产物在 00/youtube/ep01/（00/ 不进 git）。中间文件（分段视频、PCM）渲染完自动删除。
"""
import json, os, re, subprocess, sys, shutil
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
AUDIO_DIR = ROOT / "public/audio/golden-verses"
VIDEO_DIR = ROOT / "00/nature-video-not-720"
OUT_ROOT = ROOT / "00/youtube"
CACHE = OUT_ROOT / "durations.json"

TW = "--tw" in sys.argv  # 繁体版：和合本繁体（cuv-trad，1919 公有领域），朗读音频和简体共用
TW_BOOKS = dict(zip("GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV".split(),
    "創世記 出埃及記 利未記 民數記 申命記 約書亞記 士師記 路得記 撒母耳記上 撒母耳記下 列王紀上 列王紀下 歷代志上 歷代志下 以斯拉記 尼希米記 以斯帖記 約伯記 詩篇 箴言 傳道書 雅歌 以賽亞書 耶利米書 耶利米哀歌 以西結書 但以理書 何西阿書 約珥書 阿摩司書 俄巴底亞書 約拿書 彌迦書 那鴻書 哈巴谷書 西番雅書 哈該書 撒迦利亞書 瑪拉基書 馬太福音 馬可福音 路加福音 約翰福音 使徒行傳 羅馬書 哥林多前書 哥林多後書 加拉太書 以弗所書 腓立比書 歌羅西書 帖撒羅尼迦前書 帖撒羅尼迦後書 提摩太前書 提摩太後書 提多書 腓利門書 希伯來書 雅各書 彼得前書 彼得後書 約翰一書 約翰二書 約翰三書 猶大書 啟示錄".split()))

EN = "--en" in sys.argv  # 英文版（AskBibleEN 频道）：WEB 译本经文 + 英文朗读音频
if EN:
    AUDIO_DIR = ROOT / "public/audio/golden-verses-web-en"
    CACHE = OUT_ROOT / "durations-en.json"

W, H, FPS = 3840, 2160, 30
SR = 48000
# 每节的时间轴：淡入 → 朗读 → 停留 → 淡出 → 空白。读完到下一节开读 = HOLD+FO+BLANK+FI = 15 秒（D-5，Josh 由 7 秒改为 15 秒）
FI, HOLD, FO, BLANK = 1.5, 11.0, 2.0, 0.5
EP_SIZE = 490        # 每集 490 节 = 70×7（「七十个七次」），按常用程度排序（D-5）
SLOW = 1.0            # 原速，和 App 一样（放慢到 0.75 会每几帧重复一帧，画面发抖，Josh 2026-09-27 发现）
INTRO, OUTRO = 10.0, 12.0
FONT = ROOT / "00/youtube/fonts/NotoSerifSC-VF.ttf"  # 思源宋体同字形（Noto Serif SC 可变字重，OFL）
SANS = Path("/Library/Fonts/NotoSansSC-VariableFont_wght.ttf")  # 思源黑体同字形，出处用（Josh：小字用黑体才看得清）
INK = (255, 253, 248)  # #FFFDF8
TEXT_Y = 0.40          # 文字块中心高度（Josh 定「往上放」）
# 每集一个场景，按集数轮换（D-5）
SCENES = [
    "9a090c2be6a34caa9536861005726781",  # 雪山湖
    "005ff1000c2046e2af6055b0d0d78792",  # 云海
    "3adc833b30b4495fb8c46a48cc11afe9",  # 层峦
    "0b288d8250b2460788fd0f0e2efa828d",  # 晨光
    "3f24c668f5eb4be889950a7874a2464d",  # 雾林
    "d82f4a27a47d43b796abe0c837702963",  # 暮湖
    "a59d8302282b42a28d858a8d92c5ba58",  # 晨读
    "3736d8d552da45de84099a78ad8cc3eb",  # 雨窗（第 8 集，Josh 2026-09-28 选）
    "aaf87b9fcc864378a8b0cd099cb9a5c5",  # 雨夜城（第 9 集）
]
CN_NUM = "零一二三四五六七八九十"


def sh(cmd, **kw):
    return subprocess.run(cmd, check=True, capture_output=True, **kw)


def book_names():
    if TW:
        return TW_BOOKS
    if EN:
        src = (ROOT / "lib/bible/scripture-book-names-en.ts").read_text()
        return dict(re.findall(r'"?(\w{3})"?: "([^"]+)"', src))
    src = (ROOT / "lib/bible/scripture-books.ts").read_text()
    return dict(re.findall(r'bookId: "(\w+)", bookName: "([^"]+)"', src))


def load_verses():
    bible = json.load(open(ROOT / "data/bible/uploads" / ("web-en.json" if EN else "cuv-trad.json" if TW else "cuv-simp.json")))["books"]
    order = {b: i for i, b in enumerate(bible)}
    names = book_names()
    cache = json.load(open(CACHE)) if CACHE.exists() else {}
    files = sorted(AUDIO_DIR.glob("*-32kbps.mp3"))
    missing = [f for f in files if f.name not in cache]
    if missing:
        print(f"测时长 {len(missing)} 个音频…", flush=True)
        def dur(f):
            r = sh(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(f)], text=True)
            return f.name, float(r.stdout)
        with ThreadPoolExecutor(8) as ex:
            cache.update(dict(ex.map(dur, missing)))
        OUT_ROOT.mkdir(parents=True, exist_ok=True)
        json.dump(cache, open(CACHE, "w"))
    verses = []
    for f in files:
        m = re.match(r"(\w{3})-(\d+)-(\d+)-32kbps\.mp3", f.name)
        b, c, v = m.group(1), int(m.group(2)), int(m.group(3))
        text = bible[b][str(c)][str(v)].strip()
        if EN:
            text = text[:1].upper() + text[1:]  # WEB 有些节以小写开头（接上一节），单独显示时首字母大写
        verses.append(dict(book=b, ch=c, v=v, text=text, ref=f"{names[b]} {c}:{v}",
                           audio=str(f), dur=cache[f.name]))
    meta = json.load(open(ROOT / "data/scripture/theme-repeat-ge5-meta.json"))["rows"]
    rc = {(r["bookId"], r["chapter"], r["verse"]): r["repeatCount"] for r in meta}
    for x in verses:
        x["rc"] = rc.get((x["book"], x["ch"], x["v"]), 0)
    verses.sort(key=lambda x: (-x["rc"], order[x["book"]], x["ch"], x["v"]))
    return verses


def frames(sec):
    return int(round(sec * FPS))


# 纯音乐版（--music）：没有朗读，每节淡入 2 秒、停留 12–15 秒（长经文 18–20 秒）、淡出 3 秒（版面规范）
MUSIC = "--music" in sys.argv
M_FI, M_FO = 2.0, 3.0


def music_hold(v):
    n = len(v["text"]) / (2.6 if EN else 1)  # 英文约 2.6 个字母抵一个汉字
    return min(20.0, 18 + (n - 60) / 40) if n > 60 else min(15.0, 12 + n / 20)


def seg_frames(v, music=None):
    if MUSIC if music is None else music:
        return frames(M_FI + music_hold(v) + M_FO + BLANK)
    return frames(FI + v["dur"] + HOLD + FO + BLANK)


def plan(verses):
    return [verses[i:i + EP_SIZE] for i in range(0, len(verses), EP_SIZE)]


def ep_title(n):
    return f"第{CN_NUM[n] if n <= 10 else n}集"


# ---------- 字幕图（参数见 docs/youtube-visual-spec.md） ----------
_fonts = {}


def font(size, wght, path=None):
    k = (size, wght, path)
    if k not in _fonts:
        f = ImageFont.truetype(str(path or FONT), size)
        f.set_variation_by_axes([wght])
        f.wght = wght
        _fonts[k] = f
    return _fonts[k]


def line_w(text, f, sp):
    f.set_variation_by_axes([f.wght])
    return sum(f.getlength(ch) for ch in text) + sp * max(len(text) - 1, 0)


def draw_line(d, x, y, text, f, sp, fill, align="center"):
    # 同一个可变字体文件的多个字重会互相覆盖（最后设的生效），所以每次画之前重设一次
    f.set_variation_by_axes([f.wght])
    if align == "center":
        x -= line_w(text, f, sp) / 2
    for ch in text:
        d.text((x, y), ch, font=f, fill=fill)
        x += f.getlength(ch) + sp


def wrap_en(text, f, maxw, sp):
    lines, cur = [], ""
    for w in text.split():
        t = (cur + " " + w).strip()
        if line_w(t, f, sp) <= maxw or not cur:
            cur = t
        else:
            lines.append(cur); cur = w
    if cur:
        lines.append(cur)
    return lines


NO_START = set("，。；：、！？」』）”’》…—")   # 不能出现在行首
NO_END = set("「『（“‘《")                      # 不能出现在行尾
SOFT_BREAK = set("，。；：、！？」』）”’")       # 在它后面断最自然
WORD_END = set("的了着过是在和与而就都也又所把被将从向为使叫对")  # 句中不得不断时，优先在这些字后面


def wrap(text, f, maxw, sp):
    """中文断行（2026-09-28 Josh：句号不能单独掉到下一行）。整段一起算：
    行数尽量少 → 各行长短尽量接近 → 优先在标点后断；标点、后引号不放行首，前引号不放行尾，最后一行不能太短。"""
    n = len(text)
    w = [f.getlength(ch) + sp for ch in text]
    pre = [0.0]
    for x in w:
        pre.append(pre[-1] + x)
    def width(i, j):
        return pre[j] - pre[i] - sp
    INF = float("inf")
    best = [(INF, None)] * (n + 1)   # best[j] = (cost, i)：前 j 个字排好的最小代价，最后一行从 i 开始
    best[0] = (0.0, None)
    for j in range(1, n + 1):
        if j < n and (text[j] in NO_START or text[j - 1] in NO_END):
            continue  # 不能在这里断
        for i in range(j - 1, -1, -1):
            wd = width(i, j)
            if wd > maxw:
                break
            if best[i][0] == INF:
                continue
            c = 150  # 每多一行的代价（比句中硬断轻：宁可多一行也在标点处断）
            if j < n:
                c += ((maxw - wd) / maxw) ** 2 * 100
                if text[j - 1] not in SOFT_BREAK:
                    # 句子中间硬断；在虚词后面断（通常是词和词之间）轻一些，别把「荣耀」这种词拆开
                    c += 220 if text[j - 1] in WORD_END else 350
            elif i > 0 and wd < maxw * 0.35:
                c += 400  # 最后一行太短
            if best[i][0] + c < best[j][0]:
                best[j] = (best[i][0] + c, i)
    if best[n][0] == INF:  # 放不下（极少见），退回逐字折行
        lines, cur = [], ""
        for ch in text:
            if line_w(cur + ch, f, sp) > maxw and cur and ch not in NO_START:
                lines.append(cur); cur = ch
            else:
                cur += ch
        return lines + ([cur] if cur else [])
    lines, j = [], n
    while j > 0:
        i = best[j][1]
        lines.append(text[i:j]); j = i
    return lines[::-1]


def wrap_old(text, f, maxw, sp):
    # 先按标点切成小句，再把小句装进行里；单个小句太长才按字硬折
    clauses = [c for c in re.findall(r"[^，。；：、！？]*[，。；：、！？]?", text) if c]
    lines, cur = [], ""
    for c in clauses:
        if line_w(cur + c, f, sp) <= maxw:
            cur += c; continue
        if cur:
            lines.append(cur); cur = ""
        while line_w(c, f, sp) > maxw:
            k = len(c)
            while line_w(c[:k], f, sp) > maxw:
                k -= 1
            lines.append(c[:k]); c = c[k:]
        cur = c
    if cur:
        lines.append(cur)
    return lines


def compose(items, shadows, size=(W, H)):
    """items: (x, y, text, font, spacing, rgba, align, group)。shadows: {group: [(dy, blur, alpha), ...]}。
    每组文字先画自己的几层阴影再画字；不用描边、不用底框（V2 规范）。"""
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    for dy, blur, alpha, grp in [(dy, bl, al, g) for g, lst in shadows.items() for dy, bl, al in lst]:
        layer = Image.new("RGBA", size, (0, 0, 0, 0))
        sd = ImageDraw.Draw(layer)
        for x, y, t, f, sp, c, al, g in items:
            if g == grp:
                draw_line(sd, x, y + dy, t, f, sp, (0, 0, 0, alpha), al)
        img = Image.alpha_composite(img, layer.filter(ImageFilter.GaussianBlur(blur / 2)))
    d = ImageDraw.Draw(img)
    for x, y, t, f, sp, c, al, g in items:
        draw_line(d, x, y, t, f, sp, c, al)
    return img


def backdrop(peak):
    """文字后面的局部柔性压暗：椭圆径向渐变，中心 (1920, 864)，半轴 1500×360（V2）。
    peak 是中心不透明度（0–0.14），按场景亮度自适应。和字画在同一张图上，所以一起淡入淡出。"""
    import numpy as np
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.sqrt(((xx - W / 2) / 1500) ** 2 + ((yy - H * TEXT_Y) / 360) ** 2)
    stops_r = [0, 0.42, 0.68, 1.0]
    stops_a = [1.0, 0.08 / 0.14, 0.025 / 0.14, 0.0]
    a = np.interp(r, stops_r, stops_a) * peak * 255
    out = np.zeros((H, W, 4), np.uint8)
    out[..., 3] = a.astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def scene_backdrop_peak(scene):
    """取文字区域平均亮度，按 V2 分档：<0.45 不压暗，<0.60 6%，<0.75 10%，否则 14%。"""
    import numpy as np
    vals = []
    for t in (0.5, 2.5, 4.5):
        a = np.asarray(scene_frame(scene, t).convert("RGB"), np.float32) / 255
        reg = a[int(H * TEXT_Y) - 360:int(H * TEXT_Y) + 360, 540:W - 540]
        vals.append(float((0.2126 * reg[..., 0] + 0.7152 * reg[..., 1] + 0.0722 * reg[..., 2]).mean()))
    L = sum(vals) / len(vals)
    peak = 0 if L < 0.45 else 0.06 if L < 0.60 else 0.10 if L < 0.75 else 0.14
    return L, peak


VERSE_SHADOWS = [(3, 7, 166), (1, 24, 56)]   # 0 3 7 黑65%；0 1 24 黑22%
REF_SHADOWS = [(2, 6, 115)]                  # 0 2 6 黑45%


def verse_card(path, text, ref, peak=0.0):
    sp = 1 if not EN else 0
    for size in (112, 104, 96):
        f = font(size, 600)
        lines = wrap_en(text, f, 2760, sp) if EN else wrap(text, f, min(2760, 22 * (size + sp)), sp)
        if len(lines) <= (5 if EN else 4):
            break
    lh = round(size * 1.48)
    fr = font(80, 600)  # 出处和经文同字体、同颜色、同阴影，只是小一号 80 px（Josh 2026-09-28：跟经文一样、不要太透）
    total = len(lines) * lh + 44 + 80 * 1.4
    y0 = H * TEXT_Y - total / 2
    items = [(W / 2, y0 + i * lh + (lh - size) / 2, l, f, sp, INK + (245,), "center", "v") for i, l in enumerate(lines)]
    items.append((W / 2, y0 + len(lines) * lh + 44, ("— " if EN else "—— ") + ref, fr, 1, INK + (245,), "center", "v"))
    txt = compose(items, {"v": VERSE_SHADOWS, "r": REF_SHADOWS})
    (Image.alpha_composite(backdrop(peak), txt) if peak else txt).save(path)


def brand_card(path, sub=None, peak=0.0):
    items = [(W / 2, H * TEXT_Y - (70 if sub else 40), "AskBible.me", font(64, 800), 2, INK + (204,), "center", "r")]
    if sub:
        items.append((W / 2, H * TEXT_Y + 40, sub, font(40, 800), 2, INK + (204,), "center", "r"))
    txt = compose(items, {"r": REF_SHADOWS})
    (Image.alpha_composite(backdrop(peak), txt) if peak else txt).save(path)


def watermark_png():
    """画面下方正中的「AskBible.me」水印（Josh 2026-09-28）：宋体 600、48 px、不透明度约 55%，带淡阴影。片头片尾不加。"""
    p = OUT_ROOT / "watermark.png"
    if not p.exists():
        items = [(W / 2, H - 150, "AskBible.me", font(48, 600), 2, INK + (140,), "center", "w")]
        compose(items, {"w": [(2, 6, 90)]}).save(p)
    return p


def scene_frame(scene, t=1.0):
    raw = sh(["ffmpeg", "-loglevel", "error", "-ss", str(t), "-i", str(VIDEO_DIR / f"{scene}.master.mp4"),
              "-frames:v", "1", "-vf", f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H}",
              "-f", "image2pipe", "-vcodec", "png", "-"]).stdout
    import io
    return Image.open(io.BytesIO(raw)).convert("RGBA")


def ep_meta(n, music=False):
    ep = plan(load_verses())[n - 1]
    sec = (frames(INTRO) + sum(seg_frames(v, music) for v in ep) + frames(OUTRO)) / FPS
    m = int(round(sec / 60))
    return scene_for(n), (f"{m // 60}h {m % 60:02d}m" if EN else f"{m // 60}小時{m % 60}分" if TW else f"{m // 60}小时{m % 60}分")


def scene_for(n):
    return SCENES[(n - 1) % len(SCENES)]


COVER_TITLE = ("Be Still", "Renew Your Strength") if EN else ("安靜下來", "重新得力") if TW else ("安静下来", "重新得力")
COVER_SIDE = {}  # 自动判断不对时在这里手动指定，如 {3: "left"}（集数: 边）
COVER_VERSE = (("But those who wait for the LORD will renew their strength.", "Isaiah 40:31") if EN
               else ("但那等候耶和華的必從新得力。", "以賽亞書 40:31") if TW
               else ("但那等候耶和华的必从新得力。", "以赛亚书 40:31"))


def emptier_side(img):
    """左右两半比「放白字的难度」：越暗、细节（边缘）越多越重；特别亮的高光（太阳、白云）白字也看不清，一样算重。
    返回较空的一侧 'left' / 'right'。"""
    import numpy as np
    g = np.asarray(img.convert("L").resize((384, 216)), np.float32) / 255
    edge = np.abs(np.diff(g, axis=1))[:-1, :] + np.abs(np.diff(g, axis=0))[:, :-1]
    def weight(sl):
        return (1 - g[:, sl].mean()) + 4 * edge[:, sl].mean() + 0.5 * (g[:, sl] > 0.85).mean()
    return "left" if weight(slice(0, 192)) < weight(slice(192, 383)) else "right"


def cover(n):
    """封面 = 方案 D（主标题 + 一句经文 + 小字），文字放在场景较空的一侧（D-5）。"""
    scene, meta = ep_meta(n)
    bg = scene_frame(scene)
    side = COVER_SIDE.get(n) or emptier_side(bg)
    out = OUT_ROOT / "covers"
    out.mkdir(parents=True, exist_ok=True)
    ink = lambda o: INK + (round(o * 255),)
    x0, x1 = (0, 2200) if side == "left" else (1900, W)
    dark = _grad_layer("rect", x0=x0, x1=x1, y0=230, y1=1930, feather=300, peak=.14)
    tags = ((("read", "Scripture Reading"), ("music", "Piano Only")) if EN
            else (("read", "金句朗讀"), ("music", "純音樂")) if TW else (("read", "金句朗读"), ("music", "纯音乐")))
    ft, fv, fr, fm = font(180 if not EN else 160, 700), font(76 if not EN else 68, 600), font(60, 800), font(56, 800)
    verse_lines = wrap_en(COVER_VERSE[0], fv, 1900, 0) if EN else [COVER_VERSE[0]]
    for variant, tag in tags:
        meta = ep_meta(n, variant == "music")[1]
        rows = [(COVER_TITLE[0], ft, 6 if not EN else 2, 650, 1), (COVER_TITLE[1], ft, 6 if not EN else 2, 910, 1)]
        y = 1330
        for vl in verse_lines:
            rows.append((vl, fv, 2 if not EN else 0, y, .94)); y += 100
        rows.append((("— " if EN else "—— ") + COVER_VERSE[1], fr, 1, y + 30, .95))
        rows.append((f"{tag} · {EP_SIZE} verses · {meta}" if EN else f"{tag} · {EP_SIZE}{'節' if TW else '节'} · {meta}", fm, 2, 1840, .85))
        # 放右侧时按文字块最宽那一行往左收，右边留 480 px，不会溢出画面
        blk = max(line_w(t, f, sp) for t, f, sp, _, _ in rows)
        x = 480 if side == "left" else max(480, W - 480 - blk)
        items = [(x, yy, t, f, sp, ink(o), "left", "t") for t, f, sp, yy, o in rows]
        if side == "right":
            dark = _grad_layer("rect", x0=int(max(0, x - 300)), x1=W, y0=230, y1=1930, feather=300, peak=.14)
        img = Image.alpha_composite(Image.alpha_composite(bg, dark), compose(items, {"t": [(5, 18, 133)]}))
        png = out / f"{'en-' if EN else 'tw-' if TW else ''}ep{n:02d}-{variant}.png"
        img.convert("RGB").save(png)
        img.convert("RGB").resize((1280, 720), Image.LANCZOS).save(png.with_suffix(".jpg"), quality=92)
        print(png.with_suffix(".jpg"), side)


def _grad_layer(kind, **k):
    """封面局部压暗。kind: left（左侧横向渐变）/ ellipse / bottom / rect（羽化矩形）。"""
    import numpy as np
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    if kind == "left":
        a = np.clip(1 - xx / k["x1"], 0, 1)
    elif kind == "ellipse":
        r = np.sqrt(((xx - k["cx"]) / (k["w"] / 2)) ** 2 + ((yy - k["cy"]) / (k["h"] / 2)) ** 2)
        a = np.clip(1 - r, 0, 1) ** 0.8
    elif kind == "bottom":
        a = np.clip((yy - k["y0"]) / (H - k["y0"]), 0, 1)
    else:  # rect
        m = np.zeros((H, W), np.float32); m[k["y0"]:k["y1"], k["x0"]:k["x1"]] = 1
        a = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(k["feather"] / 2)), np.float32) / 255
    out = np.zeros((H, W, 4), np.uint8); out[..., 3] = (a * k["peak"] * 255).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def cover_options(n, variant="read"):
    """GPT 2026-09-27 给的 4 个封面方案（A 左侧大字 / B 中央极简 / C 下方横排 / D 标题+经文），小字按 Josh 定的宋体 800。"""
    scene, meta = ep_meta(n)
    tag = "经文朗读" if variant == "read" else "纯音乐"
    info = f"{EP_SIZE}节 · {meta}"
    bg = scene_frame(scene)
    ink = lambda o: INK + (round(o * 255),)
    out = OUT_ROOT / "covers"
    res = {}
    # A 左侧大字
    items = [(480, 990, "安静下来", font(190, 700), 6, ink(1), "left", "t"),
             (480, 990 + 285, "重新得力", font(190, 700), 6, ink(1), "left", "t"),
             (480, 1500, f"在神的话语中放松 · {tag} · {info}", font(78, 800), 3, ink(.92), "left", "t")]
    res["A"] = (_grad_layer("left", x1=1500, peak=.10), items, {"t": [(5, 16, 140)]}, [])
    # B 中央极简
    items = [(1920, 820, "安静下来", font(180, 700), 6, ink(.96), "center", "t"),
             (1920, 820 + 260, "重新得力", font(180, 700), 6, ink(.96), "center", "t"),
             (1920, 1430, tag, font(62, 800), 3, ink(.88), "center", "t"),
             (1920, 1540, info, font(52, 800), 2, ink(.70), "center", "t")]
    res["B"] = (_grad_layer("ellipse", cx=1920, cy=1000, w=3000, h=1100, peak=.10), items, {"t": [(4, 18, 115)]},
                [(1920 - 60, 1360, 1920 + 60, 1362, .55)])
    # C 下方横排
    items = [(480, 1640, "安静下来 · 重新得力", font(170, 700), 6, ink(.98), "left", "t"),
             (480, 1870, tag, font(64, 800), 3, ink(1), "left", "t"),
             (480, 1970, info, font(58, 800), 2, ink(.78), "left", "t")]
    res["C"] = (_grad_layer("bottom", y0=1450, peak=.18), items, {"t": [(5, 18, 128)]}, [(480, 1810, 580, 1812, .60)])
    # D 标题 + 一句经文
    items = [(480, 650, "安静下来", font(180, 700), 6, ink(1), "left", "t"),
             (480, 650 + 260, "重新得力", font(180, 700), 6, ink(1), "left", "t"),
             (480, 1330, "但那等候耶和华的必从新得力。", font(76, 600), 2, ink(.94), "left", "t"),
             (480, 1460, "—— 以赛亚书 40:31", font(48, 800), 1, ink(.72), "left", "t"),
             (480, 1840, f"{tag} · {info}", font(56, 800), 2, ink(.78), "left", "t")]
    res["D"] = (_grad_layer("rect", x0=0, x1=2200, y0=230, y1=1930, feather=300, peak=.12), items, {"t": [(5, 18, 133)]}, [])
    paths = []
    for key, (dark, items, shadows, lines) in res.items():
        img = Image.alpha_composite(bg, dark)
        if lines:
            ln = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(ln)
            for x0, y0, x1, y1, o in lines:
                d.rectangle([x0, y0, x1, y1], fill=ink(o))
            img = Image.alpha_composite(img, ln)
        img = Image.alpha_composite(img, compose(items, shadows))
        pth = out / f"ep{n:02d}-{variant}-option{key}.jpg"
        img.convert("RGB").resize((1280, 720), Image.LANCZOS).save(pth, quality=92)
        paths.append(pth)
    grid = Image.new("RGB", (2560, 1440))
    for i, pth in enumerate(paths):
        grid.paste(Image.open(pth), ((i % 2) * 1280, (i // 2) * 720))
    grid.save(out / f"ep{n:02d}-{variant}-options.jpg", quality=90)
    print(out / f"ep{n:02d}-{variant}-options.jpg")


def still(n):
    """片内样帧：本集场景 + 第一节经文，用来看版面。"""
    scene = scene_for(n)
    v = plan(load_verses())[n - 1]
    out = OUT_ROOT / "covers"
    out.mkdir(parents=True, exist_ok=True)
    L, peak = scene_backdrop_peak(scene)
    print(f"场景文字区亮度 {L:.2f} → 局部压暗 {peak:.0%}")
    for i in (0, 4):  # 一节短的一节长的
        tmp = out / "_card.png"
        verse_card(tmp, v[i]["text"], v[i]["ref"], peak)
        img = Image.alpha_composite(scene_frame(scene), Image.open(tmp))
        img.convert("RGB").resize((1920, 1080), Image.LANCZOS).save(out / f"ep{n:02d}-still-{i}.jpg", quality=90)
        tmp.unlink()
        print(out / f"ep{n:02d}-still-{i}.jpg")


# ---------- 渲染 ----------
def loop_clip(scene):
    """把一圈风景（原片 180 帧）解码成全 I 帧、无损的 4K 中间文件，缓存在 00/youtube/loops/。
    每段只按帧号截取：不用 -ss 跳转、不用 fps 补帧，帧和原片一一对应，接缝不抖（Josh 2026-09-27 发现抖动）。"""
    out = OUT_ROOT / "loops" / f"{scene}.mkv"
    if not out.exists():
        out.parent.mkdir(parents=True, exist_ok=True)
        tmp = out.with_suffix(".tmp.mkv")
        sh(["ffmpeg", "-y", "-loglevel", "error", "-i", str(VIDEO_DIR / f"{scene}.master.mp4"),
            "-vf", f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},format=yuv420p",
            "-c:v", "libx264", "-qp", "0", "-g", "1", "-preset", "ultrafast", "-an", str(tmp)])
        tmp.rename(out)
    n = int(sh(["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v", "-show_entries",
                "stream=nb_read_frames", "-of", "csv=p=0", str(out)], text=True).stdout.strip())
    return out, n


_loops = {}


def render_segment(scene, png, start_frame, nfr, out, t_in, t_out, black_in=False, black_out=False):
    """t_in / t_out：字幕淡入、淡出的 (开始秒, 时长)。背景从循环片的第 start_frame % N 帧开始，逐帧接上。"""
    if out.exists():
        return
    if scene not in _loops:
        _loops[scene] = loop_clip(scene)
    loop, N = _loops[scene]
    off = start_frame % N
    d = nfr / FPS
    fx = f"fade=in:st={t_in[0]:.3f}:d={t_in[1]}:alpha=1,fade=out:st={t_out[0]:.3f}:d={t_out[1]}:alpha=1"
    bg = f"[0:v]trim=start_frame={off}:end_frame={off + nfr},setpts=N/{FPS}/TB"
    post = ""
    if black_in:
        post += ",fade=in:st=0:d=1.5"
    if black_out:
        post += f",fade=out:st={d - 2.5:.3f}:d=2"
    tmp = out.with_suffix(".tmp.mp4")
    wm = not (black_in or black_out)  # 片头片尾本身就写着 AskBible.me，不再叠水印
    wm_in = ["-i", str(watermark_png())] if wm else []
    wm_f = f"[v0];[2:v]format=yuva420p,loop=loop=-1:size=1,fps={FPS}[w];[v0][w]overlay=format=yuv420:shortest=1" if wm else ""
    sh(["ffmpeg", "-y", "-loglevel", "error",
        "-stream_loop", "-1", "-i", str(loop),
        "-i", str(png), *wm_in,
        "-filter_complex", f"{bg}[b];[1:v]format=yuva420p,loop=loop=-1:size=1,fps={FPS},{fx}[t];"
                           f"[b][t]overlay=format=yuv420:shortest=1{wm_f}{post},format=yuv420p",
        "-frames:v", str(nfr), "-r", str(FPS), "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-g", "240", "-x264-params", "open-gop=0", "-video_track_timescale", "15360", str(tmp)])
    tmp.rename(out)


def mp3_pcm(path):
    return sh(["ffmpeg", "-loglevel", "error", "-i", path, "-f", "s16le", "-ac", "1", "-ar", str(SR), "-"]).stdout


XFADE = 5.0  # 两首之间交叉淡入淡出秒数（Josh 2026-09-28）


def build_music(path, total_sec, seed):
    """背景乐：「安静」专辑随机排（每集每个版本种子不同，所以开头那首和中间顺序都不同、没有规律），
    一轮放完再打乱一次，避免同一首连着；两首之间 XFADE 秒交叉淡入淡出。输出一条够长的 m4a。"""
    import random
    tracks = music_tracks()
    rng = random.Random(seed)
    durs = {t: float(sh(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(t)],
                        text=True).stdout) for t in tracks}
    order, acc = [], 0.0
    while acc < total_sec + 30:
        batch = tracks[:]
        rng.shuffle(batch)
        if order and batch[0] == order[-1]:
            batch.append(batch.pop(0))
        for t in batch:
            order.append(t)
            acc += durs[t] - XFADE
            if acc >= total_sec + 30:
                break
    ins, fl = [], []
    for i, t in enumerate(order):
        ins += ["-i", str(t)]
        fl.append(f"[{i}:a]aresample={SR},aformat=channel_layouts=stereo[s{i}]")
    prev = "s0"
    for i in range(1, len(order)):
        fl.append(f"[{prev}][s{i}]acrossfade=d={XFADE}:c1=tri:c2=tri[x{i}]")
        prev = f"x{i}"
    sh(["ffmpeg", "-y", "-loglevel", "error", *ins, "-filter_complex", ";".join(fl), "-map", f"[{prev}]",
        "-t", f"{total_sec + 5:.2f}", "-c:a", "aac", "-b:a", "256k", str(path)])
    return [t.name for t in order]


def music_tracks():
    d = json.load(open(ROOT / "data/music-companion.json"))
    return [ROOT / "public" / t["src"].lstrip("/") for t in d["audioTracks"]
            if "安静" in t.get("tags", []) and not t.get("hidden")]


def render(n, limit=None):
    eps = plan(load_verses())
    verses = eps[n - 1][:limit] if limit else eps[n - 1]
    scene = scene_for(n)
    out = OUT_ROOT / (f"en-ep{n:02d}" if EN else f"tw-ep{n:02d}" if TW else f"ep{n:02d}")
    work = out / ("work-music" if MUSIC else "work")
    work.mkdir(parents=True, exist_ok=True)
    span = f"第 {(n - 1) * EP_SIZE + 1}–{(n - 1) * EP_SIZE + len(verses)} 节"

    # 时间轴：片头 → 每节一段 → 片尾
    segs = [("intro", None, frames(INTRO))] + [(f"v{i:04d}", v, seg_frames(v)) for i, v in enumerate(verses)] \
        + [("outro", None, frames(OUTRO))]
    if limit and "--no-outro" in sys.argv:
        segs = segs[:-1]
    print(f"第 {n} 集：{len(verses)} 节，{span}，时长 {sum(s[2] for s in segs) / FPS / 3600:.2f} 小时", flush=True)

    L, peak = scene_backdrop_peak(scene)
    print(f"  场景文字区亮度 {L:.2f} → 局部压暗 {peak:.0%}", flush=True)
    jobs, pos = [], 0
    for key, v, nfr in segs:
        png = work / f"{key}.png"
        d = nfr / FPS
        if key == "intro":
            # 前 3 秒只有风景，AskBible 淡入 1.5 秒、停 3 秒、淡出 2 秒
            if not png.exists():
                brand_card(png, peak=peak)
            t_in, t_out = (3.0, FI), (7.5, FO)
        elif key == "outro":
            # 品牌 + 一句祝福，停 8 秒，然后连风景一起淡到黑
            if not png.exists():
                brand_card(png, "May God’s Word renew your strength." if EN else "願你在神的話語中重新得力。" if TW
                           else "愿你在神的话语中重新得力。", peak=peak)
            t_in, t_out = (0.0, FI), (d, 0.1)
        else:
            if not png.exists():
                verse_card(png, v["text"], v["ref"], peak)
            t_in, t_out = ((0.0, M_FI), (d - BLANK - M_FO, M_FO)) if MUSIC else ((0.0, FI), (d - BLANK - FO, FO))
        jobs.append((scene, png, pos, nfr, work / f"{key}.mp4", t_in, t_out, key == "intro", key == "outro"))
        pos += nfr

    done = [0]
    def run(j):
        render_segment(*j)
        done[0] += 1
        if done[0] % 25 == 0:
            print(f"  视频段 {done[0]}/{len(jobs)}", flush=True)
    for j in jobs:  # 串行：4K 并行跑反而更慢（实测）
        run(j)

    (work / "list.txt").write_text("".join(f"file '{j[4].name}'\n" for j in jobs))
    video = work / "video.mp4"
    sh(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(work / "list.txt"),
        "-c", "copy", str(video)])

    # 朗读音轨：每节在字幕淡入结束（FI 秒）时开始读，按帧精确对齐
    print("  拼朗读音轨…" if not MUSIC else "  纯音乐版：不拼朗读", flush=True)
    pcm = work / "voice.pcm"
    with open(pcm, "wb") as fh:
      if MUSIC:
        left = sum(n for _, _, n in segs) * SR // FPS
        while left > 0:  # 分块写静音，别一次在内存里造 1GB
            k = min(left, SR * 60); fh.write(b"\0\0" * k); left -= k
      else:
        for key, v, nfr in segs:
            total = nfr * SR // FPS
            if v is None:
                fh.write(b"\0\0" * total); continue
            lead = int(FI * SR)
            data = mp3_pcm(v["audio"])[: (total - lead) * 2]
            fh.write(b"\0\0" * lead + data + b"\0\0" * (total - lead - len(data) // 2))
    total_sec = pos / FPS

    # 背景乐：随机顺序 + 交叉淡入淡出，每集每个版本不一样
    seed = f"ep{n}-{'en' if EN else 'tw' if TW else 'zh'}-{'music' if MUSIC else 'read'}"
    order = build_music(work / "music.m4a", total_sec, seed)
    print(f"  背景乐顺序（{seed}）：{len(order)} 首", flush=True)
    final = out / f"askbible-golden-verses-ep{n:02d}{'-music' if MUSIC else ''}{'-test' if limit else ''}.mp4"
    print("  混音、合成…", flush=True)
    sh(["ffmpeg", "-y", "-loglevel", "error",
        "-i", str(video),
        "-f", "s16le", "-ar", str(SR), "-ac", "1", "-i", str(pcm),
        "-i", str(work / "music.m4a"),
        "-filter_complex",
        f"[1:a]volume=1.4,pan=stereo|c0=c0|c1=c0[vo];"
        f"[2:a]aresample={SR},volume={1.0 if MUSIC else 0.22},afade=in:st=0:d=2,afade=out:st={total_sec - 5:.2f}:d=5[mu];"
        f"[vo][mu]amix=inputs=2:normalize=0:duration=first,loudnorm=I={-16 if MUSIC else -14}:TP=-1.5,aresample={SR}[a]",
        "-map", "0:v", "-map", "[a]", "-t", f"{total_sec:.3f}",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(final)])

    # YouTube 章节时间戳（贴进说明栏）：每 50 节一个，标这一段的第一节
    lines, t = ["0:00:00 Intro" if EN else "0:00:00 片頭" if TW else "0:00:00 片头"], INTRO
    for i, (key, v, nfr) in enumerate(segs[1:-1]):
        if i % 50 == 0:
            s_ = int(t)
            lines.append(f"{s_ // 3600}:{s_ % 3600 // 60:02d}:{s_ % 60:02d} {v['ref']}")
        t += nfr / FPS
    (out / ("chapters-music.txt" if MUSIC else "chapters.txt")).write_text("\n".join(lines) + "\n")

    if "--keep" not in sys.argv:
        shutil.rmtree(work)
    else:  # 保留分段：以后只改片头 / 片尾时，删掉对应的 intro.* / outro.* 再跑一次，其它段直接复用
        for f in ("video.mp4", "voice.pcm"):
            (work / f).unlink(missing_ok=True)
    print(f"完成：{final}（{final.stat().st_size / 1e9:.2f} GB）", flush=True)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "plan"
    if cmd == "plan":
        for i, ep in enumerate(plan(load_verses()), 1):
            h = sum(seg_frames(v) for v in ep) / FPS / 3600
            print(f"第{i}集  {len(ep):4d} 节  {h:.2f} 小时  {ep[0]['ref']} — {ep[-1]['ref']}")
    elif cmd == "cover":
        cover(int(sys.argv[2]))
    elif cmd == "cover-options":
        cover_options(int(sys.argv[2]), sys.argv[3] if len(sys.argv) > 3 else "read")
    elif cmd == "still":
        still(int(sys.argv[2]))
    elif cmd == "render":
        lim = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else None
        render(int(sys.argv[2]), lim)
