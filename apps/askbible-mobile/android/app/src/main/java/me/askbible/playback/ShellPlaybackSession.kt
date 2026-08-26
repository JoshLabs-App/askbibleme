package me.askbible.playback

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.SystemClock
import org.json.JSONArray
import org.json.JSONObject
import java.util.ArrayDeque

/** JS 与前台服务共享的播放元数据。 */
object ShellPlaybackSession {
  @Volatile var title: String = ""
  @Volatile var artist: String = ""
  @Volatile var album: String = ""
  @Volatile var artworkUri: String? = null
  @Volatile var durationSec: Double = 0.0
  @Volatile var positionSec: Double = 0.0
  @Volatile var playing: Boolean = false
  @Volatile var kind: String = ""
  @Volatile var active: Boolean = false
  /** 主会话资源（金句单独播时用）。 */
  @Volatile var assetUri: String? = null
  @Volatile var nextAssetUri: String? = null
  @Volatile var nextNextAssetUri: String? = null
  private val nextLock = Any()
  private val nextQueue = ArrayList<String>()
  private val recentlyPlayed = ArrayDeque<String>()
  @Volatile var gapSec: Double = 0.0
  @Volatile var gapAssetUri: String? = null
  /** 音乐占栏时金句垫底轨（只播不改通知标题）。 */
  @Volatile var verseUnderlayUri: String? = null
  @Volatile var verseUnderlayPlaying: Boolean = false
  @Volatile var verseUnderlayNextUri: String? = null
  @Volatile var verseUnderlayGapSec: Double = 0.0
  @Volatile var verseUnderlayGapUri: String? = null
  private val verseUnderlayQueue = ArrayList<String>()
  /** 系统栏用户暂停：拒绝 JS 保活把 playing 刷回 true。 */
  @Volatile var userPaused: Boolean = false
  /** 来电 / 通话：停播但不当成用户暂停。 */
  @Volatile var systemInterrupted: Boolean = false
  /** JS 点播：允许重开当前 URI（越过句终等待）。 */
  @Volatile var forceRestartUri: Boolean = false
  /** JS userPlay 时刻，用来丢掉三星开播瞬间误发的 MediaSession Pause。 */
  @Volatile var lastUserPlayAtElapsed: Long = 0L
  @Volatile var rate: Float = 1f
  @Volatile var stopAtSec: Double = 0.0
  private const val NEXT_QUEUE_CAP = 120
  private const val RECENT_PLAYED_CAP = 128

  fun updateFromJson(json: String) {
    val payload = JSONObject(json)
    val nextKind = payload.optString("kind", "")
    val nextAsset = payload.optString("assetUri", "").takeIf { it.isNotBlank() }
    val nextPlaying = payload.optBoolean("playing", false)
    val incomingNextUris = collectNextUris(payload)
    val nextGapSec = payload.optDouble("gapSec", 0.0)
    val nextGapUri = payload.optString("gapAssetUri", "").takeIf { it.isNotBlank() }
    val userPlay = payload.optBoolean("userPlay", false)
    val userPause = payload.optBoolean("userPause", false)

    if (userPlay) {
      userPaused = false
      val explicitRestart = payload.optBoolean("forceRestart", false)
      // 金句：重复 userPlay 会 seek 0 掐句中；仅 forceRestart 或换轨点播才重头。
      // 音乐 / 读经：保留 userPlay → forceRestart 语义。
      forceRestartUri = explicitRestart || nextKind != "verse"
      lastUserPlayAtElapsed = SystemClock.elapsedRealtime()
    } else if (userPause) {
      // 音乐占栏时金句只是垫底：userPause 只关垫底，勿当成整会话暂停（否则音乐会一起停）。
      val verseUnderMusic = nextKind == "verse" && kind == "music" && playing
      if (!verseUnderMusic) {
        userPaused = true
      }
    } else if (
      nextPlaying &&
        !userPause &&
        userPaused &&
        (nextKind == "scripture" || nextKind == "music" || nextKind == "verse")
    ) {
      // 三星 OEM Pause 会留下 userPaused，而 JS 仍标 playing（无 userPause）。
      // 若不软清，后续 sync 会被公式压成 PAUSED → UI 亮着却没声。勿 forceRestart。
      // 金句也要软清：否则「音乐+金句 / 音乐+读经」UI 亮着两路都无声。
      userPaused = false
    }

    if (nextKind == "verse") {
      if (nextAsset != null) {
        // 关屏后 JS 可能仍停在旧句：勿把原生已接播的垫底 URI 打回去。
        val staleUnderlay =
          !userPlay &&
            nextAsset != verseUnderlayUri &&
            wasRecentlyPlayed(nextAsset)
        if (!staleUnderlay) {
          verseUnderlayUri = nextAsset
        }
      }
      verseUnderlayPlaying = nextPlaying && !userPaused && !userPause
      verseUnderlayGapSec = nextGapSec
      verseUnderlayGapUri = nextGapUri
      mergeVerseUnderlayNext(incomingNextUris, replace = userPlay)
      // 音乐会话仍占栏（含刚开播 / 缓冲中 playing=false）：金句只垫底，勿抢成 kind=verse。
      // 否则主轨 stop，UI 仍 musicWantPlaying →「金句+音乐」只剩金句或两路都哑。
      if (kind == "music" && !userPaused) {
        return
      }
    }

    // 音乐在播时：拒绝环境音改写通知；读经可更新。
    if (
      kind == "music" &&
        playing &&
        nextKind.isNotEmpty() &&
        nextKind != "music" &&
        nextKind != "scripture" &&
        nextKind != "verse"
    ) {
      return
    }

    title = payload.optString("title", "")
    artist = payload.optString("artist", "")
    album = payload.optString("album", "")
    artworkUri = payload.optString("artworkUri", null).takeIf { !it.isNullOrBlank() }
    durationSec = payload.optDouble("durationSec", 0.0)
    positionSec = payload.optDouble("positionSec", 0.0)
    playing = if (userPaused && !userPlay) false else nextPlaying
    kind = nextKind
    // 读经开播：硬清金句垫底（对齐 iOS stopVerse），勿依赖 pauseFromJs 时序。
    if (nextKind == "scripture") {
      verseUnderlayPlaying = false
      verseUnderlayUri = null
      verseUnderlayNextUri = null
      synchronized(nextLock) { verseUnderlayQueue.clear() }
    }
    if (payload.has("rate")) {
      val nextRate = payload.optDouble("rate", 1.0)
      if (nextRate.isFinite() && nextRate > 0) {
        rate = nextRate.toFloat().coerceIn(0.5f, 2f)
      }
    }
    if (payload.has("stopAtSec")) {
      val nextStop = payload.optDouble("stopAtSec", 0.0)
      stopAtSec = if (nextStop.isFinite() && nextStop > 0) nextStop else 0.0
    } else if (userPlay && nextKind == "scripture") {
      stopAtSec = 0.0
    }
    // 关屏后 JS 可能仍停在旧句：勿把原生已接播的 assetUri 打回去。
    // userPlay = 用户显式点播：必须换轨（读经回听已播章、今日计划点第一章等），不可当 stale 丢掉。
    val staleIncoming =
      !userPlay &&
        nextAsset != null &&
        nextAsset != assetUri &&
        wasRecentlyPlayed(nextAsset)
    if (
      !staleIncoming &&
        (userPlay || assetUri.isNullOrBlank() || nextAsset == null || nextAsset == assetUri)
    ) {
      if (nextAsset != null) {
        assetUri = nextAsset
      }
    }
    mergeIncomingNext(incomingNextUris, replace = userPlay && !staleIncoming)
    gapSec = nextGapSec
    gapAssetUri = nextGapUri
    active = true
  }

  fun peekNextQueuedUri(): String? {
    synchronized(nextLock) {
      return nextQueue.firstOrNull() ?: nextAssetUri
    }
  }

  fun consumeQueuedUri(): String? {
    synchronized(nextLock) {
      val next =
        if (nextQueue.isNotEmpty()) {
          nextQueue.removeAt(0)
        } else {
          val fallback = nextAssetUri
          nextAssetUri = nextNextAssetUri
          nextNextAssetUri = null
          fallback
        }
      syncNextVarsLocked()
      return next?.takeIf { it.isNotBlank() }
    }
  }

  fun replaceNextUris(first: String?, second: String? = null) {
    mergeIncomingNext(listOfNotNull(first, second), replace = true)
  }

  fun peekVerseUnderlayNext(): String? {
    synchronized(nextLock) {
      return verseUnderlayQueue.firstOrNull() ?: verseUnderlayNextUri
    }
  }

  fun consumeVerseUnderlayNext(): String? {
    synchronized(nextLock) {
      val next =
        if (verseUnderlayQueue.isNotEmpty()) {
          verseUnderlayQueue.removeAt(0)
        } else {
          verseUnderlayNextUri
        }
      verseUnderlayNextUri = verseUnderlayQueue.firstOrNull()
      if (!next.isNullOrBlank()) verseUnderlayUri = next
      return next?.takeIf { it.isNotBlank() }
    }
  }

  fun mergeVerseUnderlayNext(uris: List<String>, replace: Boolean) {
    synchronized(nextLock) {
      if (replace) verseUnderlayQueue.clear()
      val current = verseUnderlayUri
      for (raw in uris) {
        val uri = raw.trim()
        if (uri.isEmpty() || uri == current) continue
        if (verseUnderlayQueue.contains(uri)) continue
        verseUnderlayQueue.add(uri)
      }
      while (verseUnderlayQueue.size > NEXT_QUEUE_CAP) {
        verseUnderlayQueue.removeAt(verseUnderlayQueue.lastIndex)
      }
      verseUnderlayNextUri = verseUnderlayQueue.firstOrNull()
    }
  }

  fun snapshotVerseUnderlayQueue(): List<String> {
    synchronized(nextLock) {
      return ArrayList(verseUnderlayQueue)
    }
  }

  fun promoteUnderlayToPrimary() {
    kind = "verse"
    playing = true
    title = "AskBible.me"
    artist = "Daily Verse"
    album = "AskBible.me"
    assetUri = verseUnderlayUri
    gapSec = verseUnderlayGapSec
    gapAssetUri = verseUnderlayGapUri
    active = true
    mergeIncomingNext(snapshotVerseUnderlayQueue(), replace = true)
  }

  /** 关屏后 JS 冻住补不上队列：把已播过的金句再排进去，避免金句停、音乐还在。 */
  fun refillVerseQueuesFromHistory(currentUri: String?): Boolean {
    synchronized(nextLock) {
      val current = currentUri?.trim().orEmpty()
      val replay = ArrayList<String>()
      for (uri in recentlyPlayed) {
        if (uri.isNotBlank() && uri != current && !replay.contains(uri)) replay.add(uri)
      }
      if (replay.isEmpty()) return false
      if (kind != "verse") {
        if (verseUnderlayQueue.isNotEmpty()) return true
        verseUnderlayQueue.addAll(replay)
        verseUnderlayNextUri = verseUnderlayQueue.firstOrNull()
        return verseUnderlayQueue.isNotEmpty()
      }
      if (nextQueue.isNotEmpty()) return true
      nextQueue.addAll(replay)
      syncNextVarsLocked()
      return nextQueue.isNotEmpty()
    }
  }

  fun markAssetPlayed(uri: String?) {
    val trimmed = uri?.trim().orEmpty()
    if (trimmed.isEmpty()) return
    synchronized(nextLock) { markPlayedLocked(trimmed) }
  }

  fun wasRecentlyPlayed(uri: String?): Boolean {
    val trimmed = uri?.trim().orEmpty()
    if (trimmed.isEmpty()) return false
    synchronized(nextLock) { return recentlyPlayed.contains(trimmed) }
  }

  fun mergeIncomingNext(uris: List<String>, replace: Boolean) {
    synchronized(nextLock) {
      if (replace) {
        nextQueue.clear()
      }
      val current = assetUri
      for (raw in uris) {
        val uri = raw.trim()
        if (uri.isEmpty() || uri == current) continue
        if (nextQueue.contains(uri)) continue
        if (!replace && recentlyPlayed.contains(uri)) continue
        nextQueue.add(uri)
      }
      while (nextQueue.size > NEXT_QUEUE_CAP) {
        nextQueue.removeAt(nextQueue.lastIndex)
      }
      syncNextVarsLocked()
    }
  }

  private fun syncNextVarsLocked() {
    nextAssetUri = nextQueue.getOrNull(0)
    nextNextAssetUri = nextQueue.getOrNull(1)
  }

  private fun markPlayedLocked(uri: String) {
    recentlyPlayed.remove(uri)
    recentlyPlayed.addLast(uri)
    while (recentlyPlayed.size > RECENT_PLAYED_CAP) {
      recentlyPlayed.removeFirst()
    }
  }

  private fun collectNextUris(payload: JSONObject): List<String> {
    val out = ArrayList<String>()
    fun add(raw: String?) {
      val uri = raw?.trim().orEmpty()
      if (uri.isNotEmpty() && !out.contains(uri)) out.add(uri)
    }
    add(payload.optString("nextAssetUri", ""))
    add(payload.optString("nextNextAssetUri", ""))
    val arr: JSONArray? = payload.optJSONArray("nextAssetUris")
    if (arr != null) {
      for (i in 0 until arr.length()) {
        add(arr.optString(i, ""))
      }
    }
    return out
  }

  fun clear() {
    title = ""
    artist = ""
    album = ""
    artworkUri = null
    durationSec = 0.0
    positionSec = 0.0
    playing = false
    kind = ""
    active = false
    assetUri = null
    nextAssetUri = null
    nextNextAssetUri = null
    synchronized(nextLock) {
      nextQueue.clear()
      recentlyPlayed.clear()
      verseUnderlayQueue.clear()
    }
    gapSec = 0.0
    gapAssetUri = null
    verseUnderlayUri = null
    verseUnderlayPlaying = false
    verseUnderlayNextUri = null
    verseUnderlayGapSec = 0.0
    verseUnderlayGapUri = null
    userPaused = false
    systemInterrupted = false
    forceRestartUri = false
    lastUserPlayAtElapsed = 0L
    rate = 1f
    stopAtSec = 0.0
  }

  fun loadArtworkBitmap(): Bitmap? {
    val uri = artworkUri ?: return null
    return try {
      when {
        uri.startsWith("file://") -> {
          val path = Uri.parse(uri).path ?: return null
          BitmapFactory.decodeFile(path)
        }
        uri.startsWith("/") -> BitmapFactory.decodeFile(uri)
        else -> null
      }
    } catch (_: Exception) {
      null
    }
  }
}
