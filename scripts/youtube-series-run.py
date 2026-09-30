#!/usr/bin/env python3
"""YouTube 放松系列全自动跑完：9 集 × 6 个版本（简体 / 繁体 / 英文 × 纯音乐 / 金句朗读），全部传 @AskBible.me_Still，
按版本分进三个播放列表（00/youtube/playlists.json）。AskBibleEN 频道无法电话验证，已放弃（2026-09-28）。

- 渲染一支、排队上传一支；待上传的本地视频最多 MAX_PENDING 支，满了渲染就等（硬盘放不下全部 150 GB）。
- 上传成功后用 API 确认 YouTube 上有这支视频，再删本地 mp4（可随时用渲染脚本重新生成）。
- 当天上传额度用完（403 quotaExceeded）就睡到美西午夜额度重置后再传。
- 进度记在 00/youtube/series-state.json，中断后重跑会跳过已完成的。

用法：python3 scripts/youtube-series-run.py            # 后台跑，日志 00/youtube/series-run.log
"""
import json, subprocess, sys, threading, time, queue, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
Y = ROOT / "00/youtube"
STATE = Y / "series-state.json"
MAX_PENDING = 3
EPISODES = range(1, 10)
# 每集顺序（Josh 2026-09-28）：和频道呈现一致，英文 → 繁体 → 简体；先纯音乐，再简体金句朗读。
# 2026-09-30 Josh 加英文朗读、繁体朗读（纯音乐版保持无人声）；繁体朗读用简体那份中文朗读音频
VARIANTS = [("en", "music"), ("tw", "music"), ("zh", "music"), ("zh", "read"), ("en", "read"), ("tw", "read")]
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
        STATE.write_text(json.dumps(st, ensure_ascii=False, indent=2))


def key(n, lang, var):
    return f"ep{n:02d}-{lang}-{var}"


def paths(n, lang, var):
    d = Y / ({"en": f"en-ep{n:02d}", "tw": f"tw-ep{n:02d}"}.get(lang, f"ep{n:02d}"))
    video = d / f"askbible-golden-verses-ep{n:02d}{'-music' if var == 'music' else ''}.mp4"
    chapters = d / ("chapters-music.txt" if var == "music" else "chapters.txt")
    cover = Y / "covers" / f"{ {'en': 'en-', 'tw': 'tw-'}.get(lang, '')}ep{n:02d}-{var}.jpg"
    return d, video, chapters, cover


def hours_label(sec, lang):
    h = int(sec / 1800) / 2  # 向下取到半小时：写少不写多
    h = int(h) if h == int(h) else h
    return f"{h} Hours" if lang == "en" else f"{h} 小時" if lang == "tw" else f"{h} 小时"


def meta_for(n, lang, var, video, chapters, scene, count, first, last):
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(video)],
                               capture_output=True, text=True).stdout)
    zh_s, en_s = SCENE_NAMES[scene]
    ch = chapters.read_text().strip()
    if lang == "en" and var == "read":
        title = f"Be Still, Renew Your Strength | {hours_label(dur, 'en')} Bible Verses Read Aloud · Piano · 4K {en_s} | Sleep · Pray"
        if len(title) > 100:
            title = title.rsplit(" | ", 1)[0]
        desc = f"""Be still, and let God's Word renew your strength.

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
    extra = (["--music"] if var == "music" else []) + lf
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
            video.unlink(missing_ok=True)
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
    for n in EPISODES:
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
            m.update(video=str(video.relative_to(ROOT)), thumbnail=str(cover.relative_to(ROOT)), privacy="public",
                     playlist=json.loads((Y / "playlists.json").read_text())[f"{lang}-{var}"])
            meta_path = d / f"upload-{lang}-{var}.json"
            if meta_path.exists():  # 保留已上传的 video_id / 是否已进播放列表（中断后重跑）
                prev = json.loads(meta_path.read_text())
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


if __name__ == "__main__":
    main()
