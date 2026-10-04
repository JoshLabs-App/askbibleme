import AVFoundation

/// 音频会话总闸（O-24）：自家没在出声时用 `.ambient + .mixWithOthers`，不打断「听到」/ 播客等别的 App；
/// 用户点开音乐 / 读经 / 金句 / 环境音时才切 `.playback`（这时暂停别人是对的，也要锁屏后台续播）。
/// 首页静音背景视频开播前调 `relaxIfIdle()` —— 否则 AVPlayer 一播就按独占类别激活会话，把别的 App 掐停。
@MainActor
enum AudioSessionPolicy {
    private static var probes: [() -> Bool] = []

    /// 各播放器在 init 里登记「我在出声吗」（闭包里 weak self）
    static func register(_ isSounding: @escaping () -> Bool) { probes.append(isSounding) }

    static var ownAudioSounding: Bool { probes.contains { $0() } }

    /// 自家要出声：独占 + 后台可播
    static func playback(mode: AVAudioSession.Mode = .default) {
        let s = AVAudioSession.sharedInstance()
        try? s.setCategory(.playback, mode: mode)
        try? s.setActive(true)
    }

    /// 自家没在出声就退回混音，不打断别的 App
    static func relaxIfIdle() {
        guard !ownAudioSounding else { return }
        try? AVAudioSession.sharedInstance().setCategory(.ambient, mode: .default, options: [.mixWithOthers])
    }
}
