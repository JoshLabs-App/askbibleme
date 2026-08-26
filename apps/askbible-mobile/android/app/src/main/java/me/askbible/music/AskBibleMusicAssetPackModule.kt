package me.askbible.music

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.google.android.play.core.assetpacks.AssetPackManagerFactory
import com.google.android.play.core.assetpacks.AssetPackState
import com.google.android.play.core.assetpacks.AssetPackStateUpdateListener
import com.google.android.play.core.assetpacks.model.AssetPackStatus
import java.io.File
import java.util.concurrent.ConcurrentHashMap

/**
 * Play Asset Delivery：fast-follow 包 [PACK_NAME] 内 companion 曲目。
 * JS 用 [getTrackFileUri] / [ensurePack]；装完后 Play 会自动下，这里负责查状态与续 fetch。
 */
class AskBibleMusicAssetPackModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  private val packManager by lazy { AssetPackManagerFactory.getInstance(reactContext.applicationContext) }
  private val waiters = ConcurrentHashMap.newKeySet<Promise>()

  private val listener =
    AssetPackStateUpdateListener { state ->
      if (state.name() != PACK_NAME) return@AssetPackStateUpdateListener
      if (
        state.status() == AssetPackStatus.COMPLETED ||
          state.status() == AssetPackStatus.FAILED ||
          state.status() == AssetPackStatus.CANCELED
      ) {
        val snapshot = waiters.toList()
        waiters.clear()
        snapshot.forEach { promise ->
          try {
            promise.resolve(stateToMap(state))
          } catch (_: Exception) {
            /* already resolved */
          }
        }
      }
    }

  override fun getName(): String = NAME

  override fun initialize() {
    super.initialize()
    packManager.registerListener(listener)
  }

  override fun invalidate() {
    try {
      packManager.unregisterListener(listener)
    } catch (_: Exception) {
      /* ignore */
    }
    super.invalidate()
  }

  @ReactMethod
  fun getPackStatus(promise: Promise) {
    packManager
      .getPackStates(listOf(PACK_NAME))
      .addOnSuccessListener { states ->
        val state = states.packStates()[PACK_NAME]
        if (state == null) {
          promise.resolve(statusMap("unknown", 0, 0))
        } else {
          promise.resolve(stateToMap(state))
        }
      }
      .addOnFailureListener { err ->
        promise.reject("pad_status", err.message, err)
      }
  }

  /** 若未完成则 fetch；完成后 resolve 状态 map。 */
  @ReactMethod
  fun ensurePack(promise: Promise) {
    packManager
      .getPackStates(listOf(PACK_NAME))
      .addOnSuccessListener { states ->
        val state = states.packStates()[PACK_NAME]
        when (state?.status()) {
          AssetPackStatus.COMPLETED -> promise.resolve(stateToMap(state))
          AssetPackStatus.FAILED,
          AssetPackStatus.CANCELED,
          null,
          -> {
            waiters.add(promise)
            packManager
              .fetch(listOf(PACK_NAME))
              .addOnFailureListener { err ->
                waiters.remove(promise)
                promise.reject("pad_fetch", err.message, err)
              }
          }
          else -> {
            waiters.add(promise)
            // 已在下载：等 listener；再踢一次 fetch 以续传
            packManager.fetch(listOf(PACK_NAME))
          }
        }
      }
      .addOnFailureListener { err ->
        promise.reject("pad_ensure", err.message, err)
      }
  }

  /**
   * @param relativePath pack assets 内相对路径，如 music/tracks/track-xxx.mp3
   * @return file:// URI 或 null
   */
  @ReactMethod
  fun getTrackFileUri(relativePath: String, promise: Promise) {
    val rel = relativePath.trim().trimStart('/')
    if (rel.isEmpty() || rel.contains("..")) {
      promise.resolve(null)
      return
    }
    val location = packManager.getPackLocation(PACK_NAME)
    if (location == null) {
      promise.resolve(null)
      return
    }
    val file = File(location.assetsPath(), rel)
    if (!file.isFile || file.length() <= 0L) {
      promise.resolve(null)
      return
    }
    promise.resolve("file://${file.absolutePath}")
  }

  private fun stateToMap(state: AssetPackState): WritableMap {
    val status =
      when (state.status()) {
        AssetPackStatus.PENDING -> "pending"
        AssetPackStatus.DOWNLOADING -> "downloading"
        AssetPackStatus.TRANSFERRING -> "transferring"
        AssetPackStatus.COMPLETED -> "completed"
        AssetPackStatus.FAILED -> "failed"
        AssetPackStatus.CANCELED -> "canceled"
        AssetPackStatus.WAITING_FOR_WIFI -> "waiting_for_wifi"
        AssetPackStatus.NOT_INSTALLED -> "not_installed"
        else -> "unknown"
      }
    return statusMap(status, state.bytesDownloaded(), state.totalBytesToDownload())
  }

  private fun statusMap(status: String, bytesDownloaded: Long, totalBytes: Long): WritableMap {
    return Arguments.createMap().apply {
      putString("status", status)
      putDouble("bytesDownloaded", bytesDownloaded.toDouble())
      putDouble("totalBytes", totalBytes.toDouble())
      putString("packName", PACK_NAME)
    }
  }

  companion object {
    const val NAME = "AskBibleMusicAssetPack"
    const val PACK_NAME = "music_companion_pack"
  }
}
