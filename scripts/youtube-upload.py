#!/usr/bin/env python3
"""把做好的 YouTube 视频传到 @AskBible.me_Still（或 AskBibleEN）。凭据用 Google Cloud 项目 askbibleme
（和 01youtube 项目同一份 client），每个频道一份 token，放在 ~/.config/youtube_upload/，不进仓库。

用法：
  python3 scripts/youtube-upload.py auth still        # 首次：浏览器里选 AskBible.me_Still 频道并允许
  python3 scripts/youtube-upload.py whoami still      # 看 token 绑的是哪个频道
  python3 scripts/youtube-upload.py upload 00/youtube/ep01/upload.json            # 上传（默认 private）
  python3 scripts/youtube-upload.py publish 00/youtube/ep01/upload.json           # Josh 确认后改成 public

upload.json 字段：channel / video / thumbnail / title / description / tags / privacy；上传后会写回 video_id。
"""
import json, sys, time
from pathlib import Path
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload

ROOT = Path(__file__).resolve().parent.parent
CFG = Path.home() / ".config/youtube_upload"
CLIENT = CFG / "askbibleme-client.json"
SCOPES = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.force-ssl"]
CHANNELS = {"still": "AskBible.me_Still", "en": "AskBibleEN"}


def token_file(ch):
    return CFG / f"askbible-{ch}-token.json"


def creds(ch, allow_flow=False):
    tf = token_file(ch)
    c = Credentials.from_authorized_user_file(str(tf), SCOPES) if tf.exists() else None
    if c and not c.valid and c.refresh_token:
        try:
            c.refresh(Request())
        except Exception as e:
            from google.auth.exceptions import RefreshError
            if not isinstance(e, RefreshError):  # 断网之类：照实报，别当成授权失效（2026-10-03 断网时误报了两个半小时）
                raise
            c = None
    if not c or not c.valid:
        if not allow_flow:
            sys.exit(f"没有 {CHANNELS[ch]} 的有效授权，先跑：python3 scripts/youtube-upload.py auth {ch}")
        flow = InstalledAppFlow.from_client_secrets_file(str(CLIENT), SCOPES)
        print(f"浏览器会打开 Google 授权页：请选择频道「{CHANNELS[ch]}」，然后点允许。", flush=True)
        c = flow.run_local_server(port=0, open_browser=True, prompt="consent")
    tf.write_text(c.to_json())
    tf.chmod(0o600)
    return c


def yt(ch, allow_flow=False):
    return build("youtube", "v3", credentials=creds(ch, allow_flow))


def whoami(ch, allow_flow=False):
    items = yt(ch, allow_flow).channels().list(part="snippet", mine=True).execute().get("items", [])
    for it in items:
        print(f"token 绑定的频道：{it['snippet']['title']}（{it['snippet'].get('customUrl')}，{it['id']}）")
    return items


def upload(meta_path):
    mp = Path(meta_path)
    m = json.loads(mp.read_text())
    ch = m["channel"]
    items = whoami(ch)
    if not items or CHANNELS[ch].lower().replace(".", "") not in (items[0]["snippet"]["title"] + (items[0]["snippet"].get("customUrl") or "")).lower().replace(".", ""):
        sys.exit(f"token 绑的频道不是 {CHANNELS[ch]}，停止，免得传错频道")
    y = yt(ch)
    if not m.get("video_id"):
        body = {"snippet": {"title": m["title"], "description": m["description"], "tags": m.get("tags", []),
                            "categoryId": m.get("category", "22"), "defaultLanguage": m.get("lang", "zh-Hans"),
                            "defaultAudioLanguage": m.get("lang", "zh-Hans")},
                "status": {"privacyStatus": m.get("privacy", "private"), "selfDeclaredMadeForKids": False}}
        media = MediaFileUpload(str(ROOT / m["video"]), mimetype="video/mp4", resumable=True, chunksize=64 * 1024 * 1024)
        req = y.videos().insert(part="snippet,status", body=body, media_body=media)
        resp, last, retries = None, -1, 0
        while resp is None:
            try:
                st, resp = req.next_chunk()
                retries = 0
                if st and int(st.progress() * 100) != last:
                    last = int(st.progress() * 100)
                    print(f"上传 {last}%", flush=True)
            except (HttpError, OSError) as e:  # 断线就等一下接着传（resumable）
                if isinstance(e, HttpError) and e.resp.status in (400, 401, 403):
                    raise  # 额度用完 / 权限问题，重试没用，交给调度脚本处理
                retries += 1
                if retries > 10:
                    raise
                print(f"出错重试 {retries}：{e}", flush=True)
                time.sleep(min(60, 5 * retries))
        m["video_id"] = resp["id"]
        mp.write_text(json.dumps(m, ensure_ascii=False, indent=2))
        print(f"上传完成：https://youtu.be/{resp['id']}（{m.get('privacy', 'private')}）", flush=True)
    if m.get("thumbnail"):
        try:
            y.thumbnails().set(videoId=m["video_id"], media_body=MediaFileUpload(str(ROOT / m["thumbnail"]))).execute()
            print("封面已设置", flush=True)
        except HttpError as e:  # 频道没做电话验证就不能用自定义封面；视频本身已经传好，不算失败
            print(f"封面没设上（{e.resp.status}，频道可能还没电话验证），视频已上传", flush=True)
    if m.get("playlist") and not m.get("in_playlist"):  # 按版本加进频道里的播放列表（专辑）
        y.playlistItems().insert(part="snippet", body={"snippet": {"playlistId": m["playlist"], "resourceId": {
            "kind": "youtube#video", "videoId": m["video_id"]}}}).execute()
        m["in_playlist"] = True
        mp.write_text(json.dumps(m, ensure_ascii=False, indent=2))
        print("已加入播放列表", flush=True)


def publish(meta_path):
    m = json.loads(Path(meta_path).read_text())
    y = yt(m["channel"])
    v = y.videos().list(part="status", id=m["video_id"]).execute()["items"][0]
    st = v["status"]
    st["privacyStatus"] = "public"
    y.videos().update(part="status", body={"id": m["video_id"], "status": st}).execute()
    print(f"已公开：https://youtu.be/{m['video_id']}")


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "auth":
        whoami(sys.argv[2], allow_flow=True)
    elif cmd == "whoami":
        whoami(sys.argv[2])
    elif cmd == "upload":
        upload(sys.argv[2])
    elif cmd == "publish":
        publish(sys.argv[2])
