package me.askbible.native_.data

import org.json.JSONObject

/** Stable IDs survive catalog reordering; a missing song falls back to the quiet album. */
data class MusicResumeState(
    val trackId: String,
    val timeSec: Double,
    val repeatMode: String,
    val wasPlaying: Boolean,
    val sleepDeadline: Double?,
) {
    fun trackIndex(tracks: List<MusicTrack>): Int? = tracks.indexOfFirst { it.id == trackId }.takeIf { it >= 0 }
    fun shouldResume(now: Double): Boolean = wasPlaying && (sleepDeadline == null || sleepDeadline > now)
    fun encode(): String = JSONObject().put("trackId", trackId).put("timeSec", timeSec)
        .put("repeatMode", repeatMode).put("wasPlaying", wasPlaying).put("sleepDeadline", sleepDeadline).toString()

    companion object {
        const val STORAGE_KEY = "askbible.music.resume.v1"
        fun decode(raw: String?): MusicResumeState? = try {
            raw?.let { JSONObject(it) }?.let {
                MusicResumeState(it.getString("trackId"), it.optDouble("timeSec", 0.0),
                    it.optString("repeatMode", "all"), it.optBoolean("wasPlaying", false),
                    if (it.isNull("sleepDeadline")) null else it.getDouble("sleepDeadline"))
            }
        } catch (_: Exception) { null }

        fun position(seconds: Double, duration: Double): Double =
            if (!seconds.isFinite() || seconds <= 0 || (duration.isFinite() && duration > 0 && seconds >= duration)) 0.0 else seconds
    }
}
