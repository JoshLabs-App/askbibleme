package me.askbible.native_.data

import java.net.URI

/**
 * 音乐曲目音源解析。对应 RN 版 musicAudioRemote.ts + bundled-music-tracks.ts，与 iOS 的 MusicAudioSource 对等：
 * 内置曲走安装包 assets；赞美诗 Hymn Commons 直链原样用；其余 /music/uploads/… 走 R2 公网点播。
 * 禁止回落到 askbible.me（流量计费）—— 就算 src 是 askbible.me 的绝对地址也只取对象键转 R2。
 */
object MusicAudioSource {
    const val R2_PUBLIC_BASE = "https://pub-f30fb48025d841f09c37bb9b52df5354.r2.dev"
    const val USER_AGENT = "AskBible.me/1.0 (Android ExoPlayer)"

    private fun parse(raw: String): URI? = try { URI(raw) } catch (_: Exception) { null }

    /** TEMP：赞美诗专辑直链 Hymn Commons 钢琴 MP3（用户指定不经 R2） */
    fun isHymnCommonsDirect(raw: String): Boolean {
        val s = raw.trim()
        val u = parse(s) ?: return false
        if (u.scheme != "https") return false
        val host = u.host?.lowercase() ?: return false
        if (host != "hymncommons.org" && !host.endsWith(".hymncommons.org")) return false
        return (u.rawPath ?: "").lowercase().endsWith(".mp3")
    }

    /** companion src 或绝对 URL → music/uploads/….mp3；拿不到对象键返回 null */
    fun objectKey(raw: String): String? {
        val s = raw.trim()
        if (s.isEmpty()) return null
        var path = s
        val lower = s.lowercase()
        if (lower.startsWith("http://") || lower.startsWith("https://")) {
            // RN 用 URL.pathname（保留百分号编码）；这里用 rawPath 同理
            path = parse(s)?.rawPath ?: return null
        }
        val cleaned = path.trimStart('/')
        if (cleaned.startsWith("music/uploads/")) return cleaned
        // 对应正则 /(music\/uploads\/[^/?#]+)$/i：取最后一次出现、且后面直到结尾不再有 / ? #
        val at = cleaned.lowercase().lastIndexOf("music/uploads/")
        if (at < 0) return null
        val tail = cleaned.substring(at + "music/uploads/".length)
        if (tail.isEmpty() || tail.any { it == '/' || it == '?' || it == '#' }) return null
        return cleaned.substring(at)
    }

    /** 远端播放地址：赞美诗直链原样，其余对象键接 R2 公网 base */
    fun remoteUrl(src: String): String? {
        if (isHymnCommonsDirect(src)) return src.trim()
        val key = objectKey(src) ?: return null
        return "$R2_PUBLIC_BASE/$key"
    }

    /** 安装包内置文件（app/src/main/assets/music），ExoPlayer 的 AssetDataSource 认这个 scheme */
    fun bundledUri(track: MusicTrack): String = "asset:///music/${track.id}.mp3"

    fun uri(track: MusicTrack): String? =
        if (track.bundled) bundledUri(track) else remoteUrl(track.src)
}

/** 循环模式。与 iOS / RN 的 MusicRepeatMode 一致：off / one / all */
enum class MusicRepeatMode(val raw: String) { OFF("off"), ONE("one"), ALL("all") }

/** 专辑规则。对应 RN 版 musicAlbumPlayback.ts + musicAlbumCatalog.ts 里原生用到的部分，与 iOS 的 MusicAlbumRules 对等。 */
object MusicAlbumRules {
    /** 睡眠 / 专注工作单曲循环；四个常规专辑整专辑循环；未知专辑不动 */
    fun defaultRepeatMode(album: String): MusicRepeatMode? = when (album) {
        "睡眠", "专注工作" -> MusicRepeatMode.ONE
        "安静", "下午茶", "钢琴", "赞美诗" -> MusicRepeatMode.ALL
        else -> null
    }

    /** 睡眠专辑压到 0.3 音量 */
    fun defaultGain(album: String): Float = if (album == "睡眠") 0.3f else 1f

    /**
     * 切专辑对睡眠定时的影响：切到睡眠且没设 → 30 分钟；离开睡眠且设了 → 0（关掉）；否则 null（不动）。
     * currentMinutes 0 表示未设。
     */
    fun sleepTimerOnSwitch(album: String, currentMinutes: Int): Int? {
        if (album == "睡眠") return if (currentMinutes == 0) 30 else null
        return if (currentMinutes > 0) 0 else null
    }

    /** 别名归一：工作/专注 → 专注工作，放松 → 安静，快乐/休闲 → 下午茶，圣诗 → 赞美诗；空 → 默认 */
    fun normalize(raw: String): String {
        val s = raw.trim()
        if (s.isEmpty()) return MusicCatalog.DEFAULT_ALBUM
        return when (s) {
            "工作", "专注" -> "专注工作"
            "放松" -> "安静"
            "快乐", "休闲" -> "下午茶"
            "圣诗", "赞美诗" -> "赞美诗"
            else -> s
        }
    }

    /** 心境条短名（用户可见） */
    fun shortLabel(album: String): String = when (album) {
        "安静" -> "放松"
        "下午茶" -> "休闲"
        "专注工作" -> "工作"
        "赞美诗" -> "圣诗"
        else -> album
    }

    /**
     * 切专辑的起播曲（pickAlbumStartTrackIndex）：当前曲已在该专辑 → null（不动）；
     * 否则优先内置曲，再退到专辑首曲。原生所有曲都可播（内置或 R2），playable 即全部。
     */
    fun startIndex(tracks: List<MusicTrack>, album: String, current: Int): Int? {
        val inAlbum = tracks.indices.filter { tracks[it].album == album }
        if (inAlbum.isEmpty()) return null
        if (current in tracks.indices && tracks[current].album == album && current in inAlbum) return null
        return inAlbum.firstOrNull { tracks[it].bundled } ?: inAlbum.first()
    }
}
