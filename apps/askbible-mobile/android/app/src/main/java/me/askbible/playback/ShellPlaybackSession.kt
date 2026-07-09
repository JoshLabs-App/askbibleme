package me.askbible.playback

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import org.json.JSONObject

/** JS 与前台服务共享的播放元数据。 */
object ShellPlaybackSession {
  @Volatile var title: String = ""
  @Volatile var artist: String = ""
  @Volatile var album: String = ""
  @Volatile var artworkUri: String? = null
  @Volatile var durationSec: Double = 0.0
  @Volatile var positionSec: Double = 0.0
  @Volatile var playing: Boolean = false
  @Volatile var active: Boolean = false

  fun updateFromJson(json: String) {
    val payload = JSONObject(json)
    title = payload.optString("title", "")
    artist = payload.optString("artist", "")
    album = payload.optString("album", "")
    artworkUri = payload.optString("artworkUri", null).takeIf { !it.isNullOrBlank() }
    durationSec = payload.optDouble("durationSec", 0.0)
    positionSec = payload.optDouble("positionSec", 0.0)
    playing = payload.optBoolean("playing", false)
    active = true
  }

  fun clear() {
    title = ""
    artist = ""
    album = ""
    artworkUri = null
    durationSec = 0.0
    positionSec = 0.0
    playing = false
    active = false
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
