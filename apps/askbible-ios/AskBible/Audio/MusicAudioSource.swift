import Foundation

/// 音乐曲目音源解析。对应 RN 版 `musicAudioRemote.ts` + `bundled-music-tracks.ts`：
/// 内置曲走安装包；赞美诗 Hymn Commons 直链原样用；其余 `/music/uploads/…` 走 R2 公网点播。
/// 禁止回落到 askbible.me（流量计费）—— 就算 src 是 askbible.me 的绝对地址也只取对象键转 R2。
enum MusicAudioSource {
    static let r2PublicBase = "https://pub-f30fb48025d841f09c37bb9b52df5354.r2.dev"
    static let userAgent = "AskBible.me/1.0 (iOS AVPlayer)"

    /// TEMP：赞美诗专辑直链 Hymn Commons 钢琴 MP3（用户指定不经 R2）
    static func isHymnCommonsDirect(_ raw: String) -> Bool {
        let s = raw.trimmingCharacters(in: .whitespaces)
        guard let u = URL(string: s), u.scheme == "https", let host = u.host?.lowercased() else { return false }
        guard host == "hymncommons.org" || host.hasSuffix(".hymncommons.org") else { return false }
        return u.path(percentEncoded: true).lowercased().hasSuffix(".mp3")
    }

    /// companion `src` 或绝对 URL → `music/uploads/….mp3`；拿不到对象键返回 nil
    static func objectKey(_ raw: String) -> String? {
        let s = raw.trimmingCharacters(in: .whitespaces)
        guard !s.isEmpty else { return nil }
        var path = s
        let lower = s.lowercased()
        if lower.hasPrefix("http://") || lower.hasPrefix("https://") {
            // RN 用 URL.pathname（保留百分号编码），Swift 的 .path 会解码，所以要 percentEncoded: true
            guard let u = URL(string: s) else { return nil }
            path = u.path(percentEncoded: true)
        }
        let cleaned = String(path.drop(while: { $0 == "/" }))
        if cleaned.hasPrefix("music/uploads/") { return cleaned }
        // 对应正则 /(music\/uploads\/[^/?#]+)$/i：取最后一次出现、且后面直到结尾不再有 / ? #
        guard let r = cleaned.range(of: "music/uploads/", options: [.caseInsensitive, .backwards]) else { return nil }
        let tail = cleaned[r.upperBound...]
        guard !tail.isEmpty, !tail.contains(where: { $0 == "/" || $0 == "?" || $0 == "#" }) else { return nil }
        return String(cleaned[r.lowerBound...])
    }

    /// 远端播放地址：赞美诗直链原样，其余对象键接 R2 公网 base
    static func remoteURL(_ src: String) -> URL? {
        if isHymnCommonsDirect(src) { return URL(string: src.trimmingCharacters(in: .whitespaces)) }
        guard let key = objectKey(src) else { return nil }
        return URL(string: r2PublicBase + "/" + key)
    }

    /// 内置曲优先走安装包（没找到文件也退回 R2，不让一首曲子因打包遗漏变成哑的）
    static func url(for track: MusicTrack, bundle: Bundle = .main) -> URL? {
        if track.bundled, let local = bundle.url(forResource: track.id, withExtension: "mp3") { return local }
        return remoteURL(track.src)
    }
}

/// 循环模式。与 RN 版 `MusicRepeatMode` 一致：off / one / all
enum MusicRepeatMode: String {
    case off, one, all
}

/// 专辑规则。对应 RN 版 `musicAlbumPlayback.ts` + `musicAlbumCatalog.ts` 里原生用到的部分。
enum MusicAlbumRules {
    /// 睡眠 / 专注工作单曲循环；四个常规专辑整专辑循环；未知专辑不动
    static func defaultRepeatMode(_ album: String) -> MusicRepeatMode? {
        switch album {
        case "睡眠", "专注工作": return .one
        case "安静", "下午茶", "钢琴", "赞美诗": return .all
        default: return nil
        }
    }

    /// 睡眠专辑压到 0.3 音量
    static func defaultGain(_ album: String) -> Float {
        album == "睡眠" ? 0.3 : 1
    }

    /// 切专辑对睡眠定时的影响：切到睡眠且没设 → 30 分钟；离开睡眠且设了 → 0（关掉）；否则 nil（不动）。
    /// `currentMinutes` 0 表示未设。
    static func sleepTimerOnSwitch(to album: String, currentMinutes: Int) -> Int? {
        if album == "睡眠" { return currentMinutes == 0 ? 30 : nil }
        return currentMinutes > 0 ? 0 : nil
    }

    /// 别名归一：工作/专注 → 专注工作，放松 → 安静，快乐/休闲 → 下午茶，圣诗 → 赞美诗；空 → 默认
    static func normalize(_ raw: String) -> String {
        let s = raw.trimmingCharacters(in: .whitespaces)
        if s.isEmpty { return MusicCatalog.defaultAlbum }
        switch s {
        case "工作", "专注": return "专注工作"
        case "放松": return "安静"
        case "快乐", "休闲": return "下午茶"
        case "圣诗", "赞美诗": return "赞美诗"
        default: return s
        }
    }

    /// 心境条短名（用户可见）
    static func shortLabel(_ album: String, _ locale: AppLocale = AppLocale.current) -> String {
        switch album {
        case "安静": return SiteCopy.t("native.albumCalm", locale)
        case "下午茶": return SiteCopy.t("native.albumAfternoon", locale)
        case "专注工作": return SiteCopy.t("native.albumWork", locale)
        case "赞美诗": return SiteCopy.t("native.albumHymns", locale)
        case "钢琴": return SiteCopy.t("native.albumPiano", locale)
        case "睡眠": return SiteCopy.t("native.albumSleep", locale)
        default: return album
        }
    }

    /// 切专辑的起播曲（pickAlbumStartTrackIndex）：当前曲已在该专辑 → nil（不动）；
    /// 否则优先内置曲，再退到专辑首曲。原生所有曲都可播（内置或 R2），playable 即全部。
    static func startIndex(_ tracks: [MusicTrack], album: String, current: Int) -> Int? {
        let inAlbum = tracks.indices.filter { tracks[$0].album == album }
        guard !inAlbum.isEmpty else { return nil }
        if tracks.indices.contains(current), tracks[current].album == album, inAlbum.contains(current) { return nil }
        return inAlbum.first(where: { tracks[$0].bundled }) ?? inAlbum.first
    }
}
