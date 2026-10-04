#!/usr/bin/env python3
"""YouTube 放松系列全自动跑完：9 集 × 6 个版本（简体 / 繁体 / 英文 × 纯音乐 / 金句朗读），全部传 @AskBible.me_Still，
按版本分进三个播放列表（00/youtube/playlists.json）。AskBibleEN 频道无法电话验证，已放弃（2026-09-28）。

- 渲染一支、排队上传一支；待上传的本地视频最多 MAX_PENDING 支，满了渲染就等（硬盘放不下全部 150 GB）。
- 上传成功后用 API 确认 YouTube 上有这支视频，再删本地 mp4（可随时用渲染脚本重新生成）。
- 当天上传额度用完（403 quotaExceeded）就睡到美西午夜额度重置后再传。
- 进度记在 00/youtube/series-state.json，中断后重跑会跳过已完成的。

用法：python3 scripts/youtube-series-run.py            # 后台跑，日志 00/youtube/series-run.log
"""
import json, os, subprocess, sys, threading, time, queue, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
Y = ROOT / "00/youtube"
STATE = Y / "series-state.json"
MAX_PENDING = 3
EPISODES = range(1, 10)
# 每集顺序（Josh 2026-09-28）：和频道呈现一致，英文 → 繁体 → 简体；先纯音乐，再简体金句朗读。
# 2026-09-30 Josh 加英文朗读、繁体朗读（纯音乐版保持无人声）；繁体朗读用简体那份中文朗读音频
# 2026-09-30 Josh：以后只做音乐版，朗读是音乐版里可切换的音轨（D-5）。"dual" = 朗读时间轴的音乐版：
# 原音轨纯音乐，另有「中文朗读」「English 朗读」两条配音。传成私享 → 配音暂存到 R2 → Claude 在 Studio 加配音
# （`dubs-pending` 列出待加的，页面脚本 scripts/youtube-studio-add-dubs.js）→ `finish <key>` 公开并清理
# 2026-10-01 Josh：同一集发简 / 繁 / 英三支怕被 YouTube 当重复上传，「只保留一支英文的」——每集只做英文一支（D-5）
VARIANTS = [("en", "dual")]
R2_ACCOUNT = "652050e08d4a384c7cbe975ea02fb52c"
R2_BUCKET, R2_PUBLIC = "askbible-media", "https://askbible-media.joshlabs.app"
PART = 90 * 1024 * 1024  # Cloudflare API 单次请求约 100 MB 上限：分段传，页面里按顺序拼回
SCENE_NAMES = {  # 与渲染脚本 SCENES 顺序一致
    "9a090c2be6a34caa9536861005726781": ("雪山湖", "Mountain Lake"),
    "005ff1000c2046e2af6055b0d0d78792": ("云海", "Sea of Clouds"),
    "3adc833b30b4495fb8c46a48cc11afe9": ("层峦", "Rolling Mountains"),
    "0b288d8250b2460788fd0f0e2efa828d": ("晨光", "Morning Light"),
    "3f24c668f5eb4be889950a7874a2464d": ("雾林", "Misty Forest"),
    "d82f4a27a47d43b796abe0c837702963": ("暮湖", "Twilight Lake"),
    "a59d8302282b42a28d858a8d92c5ba58": ("晨读", "Morning Study"),
    "3736d8d552da45de84099a78ad8cc3eb": ("雨窗", "Rainy Window"),
    "aaf87b9fcc864378a8b0cd099cb9a5c5": ("雨夜城", "Rainy Night City"),
}
TW_SCENE = {"雪山湖": "雪山湖", "云海": "雲海", "层峦": "層巒", "晨光": "晨光", "雾林": "霧林", "暮湖": "暮湖",
            "晨读": "晨讀", "雨窗": "雨窗", "雨夜城": "雨夜城"}
# 说明栏第二段：提示去 AskBible.me 听金句（Josh 2026-09-30，D-5）；商店链接同 lib/app-install-urls.ts
APPS = "iPhone https://apps.apple.com/app/id6771996188 · Android https://play.google.com/store/apps/details?id=me.askbible"
LISTEN = {
    "en": f"🎧 Hear any verse read aloud: https://askbible.me\nApp: {APPS}",
    "tw": f"🎧 想聽某一節？打開 AskBible.me，每節金句都能點開聽朗讀：https://askbible.me\nApp：{APPS.replace('Android', '安卓')}",
    "zh": f"🎧 想听某一节？打开 AskBible.me，每节金句都能点开听朗读：https://askbible.me\nApp：{APPS.replace('Android', '安卓')}",
}
lock = threading.Lock()
HOLD_EN = Y / ".en-hold"  # 存在时英文版只渲染不上传（留作开关；AskBibleEN 验证不了，2026-09-28 起英文版也传 @AskBible.me_Still）
held = []


def log(msg):
    line = f"{datetime.datetime.now():%m-%d %H:%M} {msg}"
    print(line, flush=True)


def load_state():
    return json.loads(STATE.read_text()) if STATE.exists() else {}


def save_state(st):
    with lock:
        # 先并进磁盘上别的命令（finish / claims-ok）写的标记，免得 --from 进程拿内存里的旧进度把它们盖掉（2026-10-03）
        for k, v in (json.loads(STATE.read_text()) if STATE.exists() else {}).items():
            if k not in st:
                st[k] = v
            elif isinstance(v, dict) and isinstance(st[k], dict):
                for f in ("dubs_done", "archived_to", "claims_ok", "made_private", "retired"):
                    if f in v and f not in st[k]:
                        st[k][f] = v[f]
        STATE.write_text(json.dumps(st, ensure_ascii=False, indent=2))


def key(n, lang, var):
    return f"ep{n:02d}-{lang}-{var}"


def paths(n, lang, var):
    d = Y / ({"en": f"en-ep{n:02d}", "tw": f"tw-ep{n:02d}"}.get(lang, f"ep{n:02d}"))
    video = d / f"askbible-golden-verses-ep{n:02d}{'-music' if var != 'read' else ''}.mp4"
    chapters = d / ("chapters-music.txt" if var != "read" else "chapters.txt")
    cover = Y / "covers" / f"{ {'en': 'en-', 'tw': 'tw-'}.get(lang, '')}ep{n:02d}-{'read' if var == 'read' else 'music'}.jpg"
    return d, video, chapters, cover


def hours_label(sec, lang):
    h = int(sec / 1800) / 2  # 向下取到半小时：写少不写多
    h = int(h) if h == int(h) else h
    return f"{h} Hours" if lang == "en" else f"{h} 小時" if lang == "tw" else f"{h} 小时"


def meta_for(n, lang, var, video, chapters, scene, count, first, last):
    if var == "dual":  # 音乐版 + 中英朗读配音：说明照纯音乐版，把「没有朗读」那几句换成怎么切音轨
        m = meta_for(n, lang, "music", video, chapters, scene, count, first, last)
        for old, new in {
            "Piano only — no narration.": "Piano only by default — to hear the verses read aloud, switch to English or Chinese reading in the player's Settings → Audio track.",
            "純音樂版：沒有朗讀，只有輕柔鋼琴。": "預設純音樂，只有輕柔鋼琴；想聽朗讀，在播放器「設定 → 音軌」切換中文朗讀 / English 朗讀。",
            "纯音乐版：没有朗读，只有轻柔钢琴。": "默认纯音乐，只有轻柔钢琴；想听朗读，在播放器「设置 → 音轨」切换中文朗读 / English 朗读。",
            "\n\n想听朗读的版本，请看本频道的「金句朗读」版。": "",
        }.items():
            m["description"] = m["description"].replace(old, new)
        m["privacy"] = "public"  # 传完直接公开，配音之后在 Studio 补（Josh 2026-10-03，D-29）
        return m
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(video)],
                               capture_output=True, text=True).stdout)
    zh_s, en_s = SCENE_NAMES[scene]
    ch = chapters.read_text().strip()
    if lang == "en" and var == "read":
        title = f"Be Still, Renew Your Strength | {hours_label(dur, 'en')} Bible Verses Read Aloud · Piano · 4K {en_s} | Sleep · Pray"
        if len(title) > 100:
            title = title.rsplit(" | ", 1)[0]
        desc = f"""Be still, and let God's Word renew your strength.

{LISTEN['en']}

{count} of the most-quoted Bible verses (World English Bible) read aloud one by one, with a quiet pause after each verse to reflect, gentle piano and 4K {en_s.lower()} scenery.
For sleep, prayer, quiet time, work or study. No ads inserted, no interruptions.

Episode {n} · verses {first}–{last} of the most-quoted Bible verses.
490 = 70 × 7 — "seventy times seven" (Matthew 18:22).

Chapters:
{ch}

📖 AskBible.me — read and ask the Bible anytime

#Bible #BibleVerses #ScriptureReading #Relax #Sleep #Meditation #Prayer"""
        tags = ["Bible", "Bible verses", "scripture reading", "Bible reading", "sleep", "meditation", "prayer", "piano", "4K", "AskBible"]
        return dict(channel="still", title=title, description=desc, tags=tags, category="22", lang="en")
    if lang == "tw" and var == "read":
        tw_s = TW_SCENE[zh_s]
        title = f"安靜下來，重新得力｜{hours_label(dur, 'tw')}聖經金句朗讀 · 輕柔鋼琴 · 4K {tw_s}｜放鬆 助眠 默想"
        desc = f"""安靜下來，在神的話語中重新得力。

{LISTEN['tw']}

{count} 節最常被引用的聖經金句（和合本），沉穩男聲朗讀，每節之後留 15 秒安靜默想，輕柔鋼琴相伴，4K {tw_s}風景。
適合睡前、禱告、默想、工作或讀書時放著聽。整片不插播、不打擾。

第 {n} 集 · 最常被引用的聖經金句第 {first}–{last} 節。
490 = 70 × 7，「七十個七次」（馬太福音 18:22）。

章節：
{ch}

📖 AskBible.me —— 隨時讀經、問經

#聖經 #金句朗讀 #和合本 #放鬆 #助眠 #默想"""
        tags = ["聖經", "金句朗讀", "和合本", "放鬆", "助眠", "默想", "禱告", "鋼琴", "4K", "AskBible"]
        assert len(title) <= 100, title
        return dict(channel="still", title=title, description=desc, tags=tags, category="22", lang="zh-Hant")
    if lang == "en":
        # YouTube 标题上限 100 字符：放得下就带「| Sleep · Pray」，放不下就去掉
        title = f"Be Still, Renew Your Strength | {hours_label(dur, 'en')} Piano & Bible Verses · 4K {en_s} | Sleep · Pray"
        if len(title) > 100:
            title = title.rsplit(" | ", 1)[0]
        desc = f"""Be still, and let God's Word renew your strength.

{LISTEN['en']}

Piano only — no narration. {count} of the most-quoted Bible verses (World English Bible) fade in one by one over a 4K {en_s.lower()}, each staying on screen for a quiet moment so you can read slowly and reflect.
For sleep, prayer, quiet time, work or study. No ads inserted, no interruptions.

Episode {n} · verses {first}–{last} of the most-quoted Bible verses.
490 = 70 × 7 — "seventy times seven" (Matthew 18:22).

Chapters:
{ch}

📖 AskBible.me — read and ask the Bible anytime

#Bible #BibleVerses #PeacefulPiano #Relax #Sleep #Meditation #Prayer"""
        tags = ["Bible", "Bible verses", "peaceful piano", "relaxing music", "sleep music", "meditation", "prayer", "scripture", "4K", "AskBible"]
        return dict(channel="still", title=title, description=desc, tags=tags, category="10", lang="en")
    if lang == "tw":
        tw_s = TW_SCENE[zh_s]
        title = f"安靜下來，重新得力｜{hours_label(dur, 'tw')}純音樂 · 聖經金句 · 輕柔鋼琴 · 4K {tw_s}｜放鬆 助眠 默想"
        desc = f"""安靜下來，在神的話語中重新得力。

{LISTEN['tw']}

純音樂版：沒有朗讀，只有輕柔鋼琴。{count} 節最常被引用的聖經金句（和合本）逐節在 4K {tw_s}風景上淡入淡出，每節停留十幾秒，慢慢讀、慢慢默想。
適合睡前、禱告、默想、工作或讀書時放著。整片不插播、不打擾。

第 {n} 集 · 最常被引用的聖經金句第 {first}–{last} 節。
490 = 70 × 7，「七十個七次」（馬太福音 18:22）。

章節：
{ch}

📖 AskBible.me —— 隨時讀經、問經

#聖經 #純音樂 #鋼琴 #放鬆 #助眠 #默想 #和合本"""
        tags = ["聖經", "純音樂", "鋼琴", "和合本", "放鬆", "助眠", "默想", "禱告", "4K", "AskBible"]
        assert len(title) <= 100, title
        return dict(channel="still", title=title, description=desc, tags=tags, category="10", lang="zh-Hant")
    if var == "read":
        title = f"安静下来，重新得力｜{hours_label(dur, 'zh')}圣经金句朗读 · 轻柔钢琴 · 4K {zh_s}｜放松 助眠 默想"
        body = f"{count} 节最常被引用的圣经金句（和合本），沉稳男声朗读，每节之后留 15 秒安静默想，轻柔钢琴相伴，4K {zh_s}风景。\n适合睡前、祷告、默想、工作或读书时放着听。整片不插播、不打扰。"
        tags = ["圣经", "金句朗读", "和合本", "放松", "助眠", "默想", "祷告", "钢琴", "4K", "AskBible"]
        cat = "22"
    else:
        title = f"安静下来，重新得力｜{hours_label(dur, 'zh')}纯音乐 · 圣经金句 · 轻柔钢琴 · 4K {zh_s}｜放松 助眠 默想"
        body = f"纯音乐版：没有朗读，只有轻柔钢琴。{count} 节最常被引用的圣经金句（和合本）逐节在 4K {zh_s}风景上淡入淡出，每节停留十几秒，慢慢读、慢慢默想。\n适合睡前、祷告、默想、工作或读书时放着。整片不插播、不打扰。\n\n想听朗读的版本，请看本频道的「金句朗读」版。"
        tags = ["圣经", "纯音乐", "钢琴", "和合本", "放松", "助眠", "默想", "祷告", "4K", "AskBible"]
        cat = "10"
    desc = f"""安静下来，在神的话语中重新得力。

{LISTEN['zh']}

{body}

第 {n} 集 · 最常被引用的圣经金句第 {first}–{last} 节。
490 = 70 × 7，「七十个七次」（马太福音 18:22）。

章节：
{ch}

📖 AskBible.me —— 随时读经、问经

#圣经 #放松 #助眠 #默想 #和合本"""
    assert len(title) <= 100, title
    return dict(channel="still", title=title, description=desc, tags=tags, category=cat, lang="zh-Hans")


def render(n, lang, var):
    args = ["python3", "scripts/youtube-golden-verses.py"]
    lf = {"en": ["--en"], "tw": ["--tw"]}.get(lang, [])
    extra = (["--music"] if var != "read" else []) + (["--old-music"] if var == "music" else []) + lf
    subprocess.run(args + ["cover", str(n)] + lf, cwd=ROOT, check=True, capture_output=True)
    r = subprocess.run(args + ["render", str(n)] + extra, cwd=ROOT, capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(r.stderr[-800:])


def plan_info(n, lang):
    import importlib.util
    spec = importlib.util.spec_from_file_location("g", ROOT / "scripts/youtube-golden-verses.py")
    g = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(g)
    ep = g.plan(g.load_verses())[n - 1]
    first = (n - 1) * g.EP_SIZE + 1
    return g.scene_for(n), len(ep), first, first + len(ep) - 1


def next_quota_reset():
    now = datetime.datetime.now(ZoneInfo("America/Los_Angeles"))
    nxt = (now + datetime.timedelta(days=1)).replace(hour=0, minute=10, second=0, microsecond=0)
    return (nxt - now).total_seconds()


def verify(channel, vid):
    import importlib.util
    spec = importlib.util.spec_from_file_location("u", ROOT / "scripts/youtube-upload.py")
    u = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(u)
    items = u.yt(channel).videos().list(part="status", id=vid).execute().get("items", [])
    return bool(items) and items[0]["status"]["uploadStatus"] in ("uploaded", "processed")


def do_upload(job, st):
    k, meta_path, video = job
    if True:
        while True:
            r = subprocess.run(["python3", "-u", "scripts/youtube-upload.py", "upload", str(meta_path)],
                               cwd=ROOT, capture_output=True, text=True)
            out = r.stdout + r.stderr
            if r.returncode == 0:
                break
            if "quota" in out.lower():
                wait = next_quota_reset()
                log(f"{k}：今天的上传额度用完了，等 {wait / 3600:.1f} 小时到额度重置再传")
                time.sleep(wait)
                continue
            log(f"{k}：上传出错，10 分钟后重试：{out[-300:]}")
            time.sleep(600)
        m = json.loads(Path(meta_path).read_text())
        vid = m["video_id"]
        if verify(m["channel"], vid):
            if not k.endswith("-dual"):  # dual 版本地成片留到公开后搬去移动硬盘（Josh 2026-10-03「全部发布后搬到移动硬盘里」）
                video.unlink(missing_ok=True)
            if k.endswith("-dual"):
                if m.get("privacy") == "public":  # 中断后重跑时视频可能早已以私享传上去了，这里补公开（D-29）
                    publish_vid(vid)
                st[k] = {"video_id": vid, "title": m["title"], "dubs": stage_dubs(k, vid, video, m.get("lang"))}
                retire_old(st, k)
                save_state(st)
                log(f"{k}：已传完（{m.get('privacy')}）https://youtu.be/{vid} ，配音从本机直传，等 Claude 在 Studio 加（dubs-pending）")
                try:
                    add_captions(k)
                    st.update(load_state())  # 把刚记下的 captions 并回内存里的进度，免得下次保存时盖掉
                except Exception as ex:  # 额度不够之类：不挡后面的活，之后手动跑 `captions <key>`
                    log(f"{k}：字幕轨没传上（{str(ex)[-200:]}），之后跑 captions {k}")
                return
            log(f"{k}：已公开 https://youtu.be/{vid} ，本地视频已删")
        else:  # 查不到 = 被 YouTube 拒了或删了：不记成完成，本地保留，下次重跑会重新上传
            log(f"{k}：上传后在 YouTube 查不到（可能被拒），本地视频保留，不记成完成")
            m.pop("video_id", None)
            Path(meta_path).write_text(json.dumps(m, ensure_ascii=False, indent=2))
            return
        st[k] = {"video_id": vid, "title": m["title"]}
        old_vid = st.get("_old_ep01", {}).pop(k, None)
        if old_vid:  # 第 1 集重做（新断行）：新版上线后把旧版改成私享，永久删除留给 Josh
            set_private(m["channel"], old_vid)
            log(f"{k}：旧版 https://youtu.be/{old_vid} 已改成私享（待 Josh 在 Studio 删除）")
        save_state(st)


def r2(method, key_, data=None):
    token = (Path.home() / ".config/cloudflare/token").read_text().strip()
    cmd = ["curl", "-sS", "--fail", "--retry", "8", "--retry-all-errors", "--retry-delay", "15", "-X", method,  # 偶发 SSL 断线（退出码 35）别让上传线程崩（2026-10-03）
            "-H", f"Authorization: Bearer {token}",
           f"https://api.cloudflare.com/client/v4/accounts/{R2_ACCOUNT}/r2/buckets/{R2_BUCKET}/objects/{key_}"]
    if data is not None:
        cmd[5:5] = ["-H", "Content-Type: application/octet-stream", "--data-binary", "@-"]
    subprocess.run(cmd, input=data, check=True, capture_output=True)


LOCAL_DUBS = "http://127.0.0.1:8765"  # ~/bin/serve-local-files.py，根目录是 00/youtube


def ensure_local_server():
    # 通用工具 ~/bin/serve-local-files.py（做法见 ~/.claude/CLAUDE.md「把本机大文件交给网页」）；页面回报的 /__status/… 记在日志里
    if subprocess.run(["pgrep", "-f", "serve-local-files.py|local-file-server.py"], capture_output=True).returncode != 0:
        subprocess.Popen(["python3", str(Path.home() / "bin/serve-local-files.py"), str(Y), "--port", "8765",
                          "--origin", "https://studio.youtube.com", "--log", str(Y / "local-file-server.log")],
                         cwd=ROOT, start_new_session=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def stage_dubs(k, vid, video, video_lang):
    """把两条配音分段传到 R2 的 yt-dubs/ 下，返回 Studio 加配音要的清单（语言名是 Studio「添加语言」里的原文）。
    配音语言不能和视频原始语言相同：英文字幕版原始语言是「英语」，English 朗读就标「英语（美国）」。"""
    out = {}
    for lang in ("zh", "en"):
        f = video.with_name(video.stem + f"-dub-{lang}.m4a")
        # 不再传 R2：Studio 页面直接从本机服务读（Josh 2026-10-03「一定要本机直传」，D-29）。
        # 原来先传 R2 再由页面下载上传，每集多占约 600 MB 上行；Chrome 首次要在 Studio 页点「允许访问本地网络」
        parts = [f"{LOCAL_DUBS}/{f.relative_to(Y)}"]
        label = "中文" if lang == "zh" else ("英语（美国）" if (video_lang or "").startswith("en") else "英语")
        out[lang] = {"label": label, "parts": parts, "name": f.name, "local": str(f.relative_to(ROOT)), "added": False}
    return out


CAPTION_LANGS = ["en", "zh-Hant", "zh-Hans"]


def add_captions(k):
    """给这支视频传多语言字幕轨（英 / 繁 / 简，Josh 2026-10-01，D-5）。SRT 由渲染脚本的 subs 按这支视频的时间轴生成。
    一条 400 额度；传过的记在进度里，不重复传。"""
    from googleapiclient.http import MediaFileUpload
    import importlib.util
    st = load_state()
    e = st[k]
    n, lang, var = int(k[2:4]), k.split("-")[1], k.split("-")[2]
    flags = {"en": ["--en"], "tw": ["--tw"]}.get(lang, []) + ["--music"] + (["--old-music"] if var == "music" else [])
    r = subprocess.run(["python3", "scripts/youtube-golden-verses.py", "subs", str(n)] + flags, cwd=ROOT, capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(r.stderr[-500:])
    files = {code: p for p in r.stdout.splitlines() for code in CAPTION_LANGS if p.endswith(f"-{code}.srt")}
    spec = importlib.util.spec_from_file_location("u", ROOT / "scripts/youtube-upload.py")
    u = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(u)
    y = u.yt("still")
    for code in CAPTION_LANGS:
        if code in e.get("captions", []):
            continue
        y.captions().insert(part="snippet", body={"snippet": {"videoId": e["video_id"], "language": code, "name": ""}},
                            media_body=MediaFileUpload(files[code], mimetype="application/octet-stream")).execute()
        e.setdefault("captions", []).append(code)
        st2 = load_state()  # 批量进程也在写这个文件：只回写这一项，别盖掉别的
        st2[k] = {**st2.get(k, {}), "captions": e["captions"]}
        save_state(st2)
        log(f"{k}：字幕轨 {code} 已上传")


def finish(k):
    """Studio 里两条配音都加好之后：公开、删 R2 暂存和本地配音文件。"""
    st = load_state()
    e = st[k]
    if (k.split("-")[1], k.split("-")[2]) not in VARIANTS:
        sys.exit(f"{k}：现在每集只发英文一支（Josh 2026-10-01，D-5），这支不公开")
    # 原来要先 claims-ok 才能公开（D-9）；2026-10-03 起传完直接公开（D-29），版权主张事后在 Studio 看
    tmp = Y / f".publish-{k}.json"
    tmp.write_text(json.dumps({"channel": "still", "video_id": e["video_id"]}))
    subprocess.run(["python3", "scripts/youtube-upload.py", "publish", str(tmp)], cwd=ROOT, check=True)
    tmp.unlink()
    for d in e["dubs"].values():
        for u in d["parts"]:
            if u.startswith(R2_PUBLIC + "/"):  # 10-03 之前暂存在 R2 的才要删
                r2("DELETE", u.split(R2_PUBLIC + "/", 1)[1])
        d["added"] = True
    # 公开后整集（成片 / 配音 / 字幕 / 封面 / 章节）搬进待移区，插移动硬盘自动挪走（Josh 2026-10-03）
    n = int(k[2:4])
    d_, video, chapters, cover = paths(n, k.split("-")[1], "dual")
    dst = BACKUP / d_.name
    dst.mkdir(parents=True, exist_ok=True)
    for f in [video, chapters, cover] + sorted(d_.glob(video.stem + "-dub-*.m4a")) + sorted(d_.glob(f"subs-ep{n:02d}-*.srt")):
        if f.exists():
            if (dst / f.name).exists():
                (dst / f.name).unlink()
            f.rename(dst / f.name)
    e["archived_to"] = str(dst)
    e["dubs_done"] = True
    retire_old(st, k)
    save_state(st)
    log(f"{k}：配音已加好，已公开 https://youtu.be/{e['video_id']} ，R2 暂存已删，本地文件已搬到 {e['archived_to']}")


BACKUP = Path.home() / "素材备份待移/01AskBible/youtube"  # 插上移动硬盘由 ~/bin/archive_to_drive.sh 自动搬走


def render_all_en():
    """Josh 2026-10-01：「现在先做英文，全部先做出来……现在不要自动删了，我们要保留在我们的硬盘备份出去」。
    第 1–9 集英文 dual 全部渲染（已有成片的跳过），出三语字幕 SRT；**不上传、不删**，成片 / 配音 / 字幕 / 封面 / 章节
    搬进 BACKUP（2026-10-02 起由硬链接改为搬走，本机不留，腾空间）；搬过的集留 `.moved-to-backup` 标记，重跑会跳过。
    被主张的配乐整首不用（youtube-golden-verses.py MUSIC_SKIP）。"""
    for n in EPISODES:
        d, video, chapters, cover = paths(n, "en", "dual")
        if (d / ".moved-to-backup").exists():  # 已搬进待移区（可能已在移动硬盘上），别重渲
            continue
        import shutil
        while shutil.disk_usage("/").free < 30e9 and not (d / "work-music").exists():  # 一集峰值约 28 GB：不够就等，别写满盘
            log(f"ep{n:02d}-en-dual：本机只剩 {shutil.disk_usage('/').free / 1e9:.0f} GB，等插移动硬盘腾空间（每 10 分钟查一次）")
            time.sleep(600)
        if not video.exists():
            log(f"ep{n:02d}-en-dual：开始渲染（只渲染不上传）")
            render(n, "en", "dual")
        subprocess.run(["python3", "scripts/youtube-golden-verses.py", "subs", str(n), "--en", "--music"],
                       cwd=ROOT, check=True, capture_output=True)
        dst = BACKUP / d.name
        dst.mkdir(parents=True, exist_ok=True)
        files = [video, chapters, cover] + sorted(d.glob(video.stem + "-dub-*.m4a")) + sorted(d.glob(f"subs-ep{n:02d}-*.srt"))
        # Josh 2026-10-02「改」：不在本机留，直接搬进待移区，插盘后挪到移动硬盘，腾本机空间
        moved = 0
        for f in files:
            if f.exists():
                if (dst / f.name).exists():
                    (dst / f.name).unlink()
                f.rename(dst / f.name)
                moved += 1
        (d / ".moved-to-backup").write_text(str(dst) + "\n")
        log(f"ep{n:02d}-en-dual：渲染完成，{moved} 个文件已搬到 {dst}（插移动硬盘自动挪走）")
    log("英文 9 集全部渲染完成（未上传）")


def publish_vid(vid):
    tmp = Y / f".publish-{vid}.json"
    tmp.write_text(json.dumps({"channel": "still", "video_id": vid}))
    subprocess.run(["python3", "scripts/youtube-upload.py", "publish", str(tmp)], cwd=ROOT, check=True, capture_output=True)
    tmp.unlink()


def retire_old(st, k):
    """重做的集：同一集同一字幕语言的旧版（纯音乐，简体还有旧的朗读版）改成私享，免得和新版重复；永久删除留给 Josh。"""
    n_, lang_ = k[2:4], k.split("-")[1]
    for old in [f"ep{n_}-{lang_}-music", f"ep{n_}-{lang_}-dual-old"] + ([f"ep{n_}-zh-read"] if lang_ == "zh" else []):
        o = st.get(old)
        if o and o.get("video_id") and not o.get("made_private"):
            set_private("still", o["video_id"])
            o["made_private"] = True
            log(f"{k}：旧版 {old} https://youtu.be/{o['video_id']} 已改成私享（待 Josh 在 Studio 删除）")


def set_private(channel, vid):
    import importlib.util
    spec = importlib.util.spec_from_file_location("u", ROOT / "scripts/youtube-upload.py")
    u = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(u)
    y = u.yt(channel)
    v = y.videos().list(part="status", id=vid).execute()["items"][0]
    stt = v["status"]; stt["privacyStatus"] = "private"
    y.videos().update(part="status", body={"id": vid, "status": stt}).execute()


def release_held(st):
    while held and not HOLD_EN.exists():
        do_upload(held.pop(0), st)


def uploader(q, st):
    while True:
        job = q.get()
        if job is None:
            q.task_done()
            return
        release_held(st)
        if "-en-" in job[0] and HOLD_EN.exists():
            held.append(job)
            log(f"{job[0]}：AskBibleEN 还没验证，先存在本地不上传")
        else:
            do_upload(job, st)
        q.task_done()


def main():
    # 第 1 集由 ep01-pipeline.sh 在跑，等它结束再开始（4K 串行最快）
    while subprocess.run(["pgrep", "-f", "ep01-pipeline.sh"], capture_output=True).returncode == 0:
        time.sleep(60)
    st = load_state()
    # 收尾第 1 集：pipeline 传完的写进状态，并删本地
    for (lang, var), mp in {("zh", "read"): Y / "ep01/upload.json", ("zh", "music"): Y / "ep01/upload-music.json",
                            ("en", "music"): Y / "en-ep01/upload-music.json"}.items():
        k = key(1, lang, var)
        if k not in st and mp.exists():
            m = json.loads(mp.read_text())
            if m.get("video_id") and verify(m["channel"], m["video_id"]):
                st[k] = {"video_id": m["video_id"], "title": m["title"]}
                (ROOT / m["video"]).unlink(missing_ok=True)
                log(f"{k}：已在线 https://youtu.be/{m['video_id']} ，本地视频已删")
    save_state(st)
    q = queue.Queue()
    t = threading.Thread(target=uploader, args=(q, st), daemon=True)
    t.start()
    start = int(sys.argv[sys.argv.index("--from") + 1]) if "--from" in sys.argv else 1
    # 先做 start 以后的集，再回头补前面的（Josh 2026-09-30：第 1、2 集也按新版重做）
    for n in [e for e in EPISODES if e >= start] + [e for e in EPISODES if e < start]:
        for lang, var in VARIANTS:
            k = key(n, lang, var)
            if k in st:
                continue
            while q.unfinished_tasks >= MAX_PENDING:
                time.sleep(60)
            d, video, chapters, cover = paths(n, lang, var)
            if not video.exists():
                log(f"{k}：开始渲染")
                render(n, lang, var)
            scene, count, first, last = plan_info(n, lang)
            m = meta_for(n, lang, var, video, chapters, scene, count, first, last)
            m.update(video=str(video.relative_to(ROOT)), thumbnail=str(cover.relative_to(ROOT)),
                     playlist=json.loads((Y / "playlists.json").read_text())[f"{lang}-{var}"])
            # dual 由 meta_for 设成 private（加完配音 finish 才公开）；这里原来一律写 public，把它盖掉了，
            # ep03 / ep04 的 dual 因此没加配音就公开了（2026-10-01 查出）
            m.setdefault("privacy", "public")
            meta_path = d / f"upload-{lang}-{var}.json"
            if meta_path.exists():  # 保留已上传的 video_id / 是否已进播放列表（中断后重跑）
                prev = json.loads(meta_path.read_text())
                # 旧 video_id 已记在别的键下（如 ep03-en-dual-old）= 那是被取代的旧版，不能沿用，否则新版不会上传（2026-10-03 查出）
                if prev.get("video_id") not in {e.get("video_id") for e in st.values() if isinstance(e, dict)}:
                    for f in ("video_id", "in_playlist"):
                        if prev.get(f):
                            m[f] = prev[f]
            meta_path.write_text(json.dumps(m, ensure_ascii=False, indent=2))
            log(f"{k}：渲染完成，排队上传（{m['title']}）")
            q.put((k, meta_path, video))
    q.join()
    while held:  # 最后只剩英文版等验证
        release_held(st)
        if held:
            time.sleep(600)
    q.put(None)
    log("全部完成")


def auto_public():
    """给 2026-10-03 改版前就在跑的 --from 进程兜底（它内存里还是旧代码：dual 传成私享、不撤旧版）：
    排队的 dual 配置改成 public；已传上的 dual 公开并把旧版改私享。--from 进程退出后自己停。"""
    marker = Y / ".auto-public.json"
    done = json.loads(marker.read_text()) if marker.exists() else {}
    while subprocess.run(["pgrep", "-f", "youtube-series-run.py --from"], capture_output=True).returncode == 0:
        for n in EPISODES:
            for lang, var in VARIANTS:
                mp = paths(n, lang, var)[0] / f"upload-{lang}-{var}.json"
                if not mp.exists() or subprocess.run(["pgrep", "-f", str(mp.relative_to(ROOT))], capture_output=True).returncode == 0:
                    continue  # 正在传的那支改配置没用，传完再公开
                m = json.loads(mp.read_text())
                if not m.get("video_id") and m.get("privacy") != "public":
                    m["privacy"] = "public"
                    mp.write_text(json.dumps(m, ensure_ascii=False, indent=2))
                    log(f"auto-public：{mp.parent.name} 排队的配置改成 public")
        st = load_state()
        for k, e in st.items():
            if k.endswith("-dual") and isinstance(e, dict) and e.get("video_id") and not e.get("retired") and k not in done:
                tmp = Y / f".publish-{k}.json"
                tmp.write_text(json.dumps({"channel": "still", "video_id": e["video_id"]}))
                subprocess.run(["python3", "scripts/youtube-upload.py", "publish", str(tmp)], cwd=ROOT, check=True)
                tmp.unlink()
                retire_old(st, k)  # 只改 YouTube 上的状态；进度文件归 --from 进程写，这里不存，记在 marker 里
                done[k] = e["video_id"]
                marker.write_text(json.dumps(done, ensure_ascii=False, indent=2))
                log(f"auto-public：{k} 已公开 https://youtu.be/{e['video_id']}")
        time.sleep(300)
    log("auto-public：--from 进程已结束，兜底停止")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "dubs-pending":  # 列出待在 Studio 加配音的视频（给 Claude 用）
        ensure_local_server()
        for k_, e in load_state().items():
            if isinstance(e, dict) and e.get("dubs") and not e.get("dubs_done") and not e.get("retired"):
                print(json.dumps({"key": k_, "video_id": e["video_id"],
                                  # 本地文件还在就一律从本机取（运行中的 --from 进程可能把旧的 R2 地址写回进度文件）
                                  "dubs": [{"label": d["label"], "name": d["name"],
                                            "parts": [f"{LOCAL_DUBS}/{(ROOT / d['local']).relative_to(Y)}"]
                                            if (ROOT / d.get("local", "-")).exists() else d["parts"]}
                                           for d in e["dubs"].values()]}, ensure_ascii=False))
    elif len(sys.argv) > 2 and sys.argv[1] == "finish":
        finish(sys.argv[2])
    elif len(sys.argv) > 2 and sys.argv[1] == "captions":  # 传英 / 繁 / 简三条字幕轨
        add_captions(sys.argv[2])
    elif len(sys.argv) > 1 and sys.argv[1] == "render-all-en":  # 只渲染不上传、不删（Josh 2026-10-01）
        render_all_en()
    elif len(sys.argv) > 2 and sys.argv[1] == "claims-ok":  # Studio 里看过版权检查、没有主张
        st_ = load_state()
        st_[sys.argv[2]]["claims_ok"] = True
        save_state(st_)
    elif len(sys.argv) > 1 and sys.argv[1] == "auto-public":
        auto_public()
    elif len(sys.argv) == 1 or sys.argv[1] == "--from":
        main()
    else:  # 不认识的参数（比如 --help）别默认开跑，免得起第二份上传（2026-10-03 出过一次）
        sys.exit("用法：[--from N] | dubs-pending | finish <key> | captions <key> | render-all-en | claims-ok <key> | auto-public")
