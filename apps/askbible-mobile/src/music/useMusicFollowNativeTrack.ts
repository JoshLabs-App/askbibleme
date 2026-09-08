import { useEffect, useRef } from "react";
import { usePlaybackStream } from "../audio/playbackState";
import { reshuffleShellMediaSceneArtwork } from "../audio/shellMediaSceneArtwork";
import { setShellMusicPlayableAssetUri } from "../audio/shellMusicPlayableAssetUri";
import { syncShellMediaSessionExplicit } from "../audio/shellMediaControls";
import { patchShellMediaSessionLiveArgs } from "../audio/shellMediaSessionPayload";
import { buildMusicNativeNextUris, findTrackIndexByResolvedUri } from "./musicNativeNextQueue";
import type { PlaybackTrack } from "./types";

type Args = {
  tracks: PlaybackTrack[];
  setTrackIndex: (index: number) => void;
  setMusicCurrentSec: (sec: number) => void;
  persistMusicResume: (trackId: string, positionSec: number) => void | Promise<void>;
};

/** 队列剩这么少就补货。留两首的余量，够覆盖一次补货的往返。 */
const REFILL_THRESHOLD = 2;

/**
 * 跟随原生正在播的音乐曲目：同步界面，并在队列见底时补货。
 *
 * **这里不做任何播放决策。** 换曲是原生按队列自己完成的（关屏时 JS 被挂起也照样走），
 * JS 只负责两件本来就属于它的事：
 *
 * 1. 界面显示哪一首（原生只知道 URI，曲库在 JS 这边）
 * 2. 队列快空了给下一批 URI（选什么曲目是内容问题，不是播放问题）
 *
 * 取代了 `useNativeMusicEnded`：那个 hook 监听「曲终」事件，然后自己挑下一首、
 * 发一次完整会话更新把 `playing: true` 也一并推回原生——等于 JS 又参与了一次播放决策，
 * 而它手里的答案永远比原生慢一拍。现在只看状态里的 uri 变了没有。
 */
export function useMusicFollowNativeTrack({
  tracks,
  setTrackIndex,
  setMusicCurrentSec,
  persistMusicResume,
}: Args): void {
  const music = usePlaybackStream("music");
  const lastUriRef = useRef<string | null>(null);

  useEffect(() => {
    const uri = music.uri;
    if (!uri || uri === lastUriRef.current) return;
    lastUriRef.current = uri;

    const index = findTrackIndexByResolvedUri(tracks, uri);
    const track = index >= 0 ? tracks[index] : null;
    if (!track) return;

    setTrackIndex(index);
    setMusicCurrentSec(0);
    setShellMusicPlayableAssetUri(uri);
    void persistMusicResume(track.id, 0);
    patchShellMediaSessionLiveArgs({
      tracks,
      playbackMode: "music",
      trackIndex: index,
      musicCurrentSec: 0,
      playing: true,
    });
  }, [music.uri, tracks, setTrackIndex, setMusicCurrentSec, persistMusicResume]);

  useEffect(() => {
    if (!music.playing || !music.uri) return;
    if (music.queueLength > REFILL_THRESHOLD) return;

    let cancelled = false;
    void (async () => {
      const index = findTrackIndexByResolvedUri(tracks, music.uri!);
      if (index < 0) return;
      const nextAssetUris = await buildMusicNativeNextUris({ tracks, startIndex: index });
      if (cancelled || nextAssetUris.length === 0) return;
      const artworkUri = await reshuffleShellMediaSceneArtwork();
      if (cancelled) return;
      const track = tracks[index];
      /*
       * 不带 userPlay：原生只会取走队列，不会重新起播。
       * （见 model/JsIntent 的保活规则——保活同步碰不到「谁在播」。）
       */
      syncShellMediaSessionExplicit({
        title: track.title,
        artist: track.artist,
        album: track.album,
        assetUri: music.uri,
        artworkUri,
        durationSec: track.durationSec ?? 0,
        positionSec: music.positionSec,
        playing: true,
        kind: "music",
        nextAssetUri: nextAssetUris[0] ?? null,
        nextNextAssetUri: nextAssetUris[1] ?? null,
        nextAssetUris,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [music.playing, music.uri, music.queueLength, music.positionSec, tracks]);
}
