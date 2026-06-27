package me.askbible.alarm

import android.content.Context
import java.io.File
import kotlin.random.Random

/** 预备音乐：优先从 JS 同步的「安静」专辑曲池随机选曲，否则回退 APK raw。 */
object ReadingAlarmPreludeCache {
  private const val FILE_NAME = "reading_alarm_prelude.mp3"
  private const val POOL_DIR_NAME = "reading-alarm-prelude-pool"
  private const val MIN_BYTES = 10_000L

  fun localFile(context: Context): File = File(context.filesDir, FILE_NAME)

  private fun poolDir(context: Context): File = File(context.filesDir, POOL_DIR_NAME)

  /** 每次播放前随机选曲（App 曾打开过且已同步曲池时生效）。 */
  fun pickRandomPlayableFile(context: Context): File? {
    val appContext = context.applicationContext
    val poolCandidates =
      poolDir(appContext)
        .listFiles()
        ?.filter { file ->
          file.isFile &&
            file.length() > MIN_BYTES &&
            file.name.endsWith(".mp3", ignoreCase = true)
        }
        ?.toList()
        ?: emptyList()
    if (poolCandidates.isNotEmpty()) {
      return poolCandidates[Random.nextInt(poolCandidates.size)]
    }
    return ensureBundledFallbackFile(appContext)
  }

  fun ensureLocalFile(context: Context): File? = pickRandomPlayableFile(context)

  private fun ensureBundledFallbackFile(context: Context): File? {
    val dest = localFile(context.applicationContext)
    if (dest.exists() && dest.length() > MIN_BYTES) return dest
    val appContext = context.applicationContext
    val rawId =
      appContext.resources.getIdentifier("reading_alarm_prelude", "raw", appContext.packageName)
    if (rawId == 0) return null
    return try {
      appContext.resources.openRawResource(rawId).use { input ->
        dest.outputStream().use { output -> input.copyTo(output) }
      }
      if (dest.length() > 0L) dest else null
    } catch (_: Exception) {
      if (dest.exists()) dest.delete()
      null
    }
  }

  fun warmAsync(context: Context) {
    Thread { pickRandomPlayableFile(context.applicationContext) }.start()
  }
}
