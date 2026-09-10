import MediaPlayer

/// 能接锁屏 / 控制中心 / 耳机线控的播放器
@MainActor
protocol RemotePlayable: AnyObject {
    func remotePlay()
    func remotePause()
    func remoteToggle()
    func remoteNext()
    func remotePrevious()
    func remoteSeek(to seconds: Double)
}

/// 远程控制命令的唯一入口。
///
/// MPRemoteCommandCenter 的 addTarget 是叠加的：整章朗读和音乐两个播放器各注册一份，
/// 锁屏按一下播放两边都会响。所以命令只在这里注册一次，路由给「最后一个开播的」播放器
/// —— 谁 resume 谁 claim。RN 版是单一 shell 播放器天然没这个问题，原生拆成两个播放器后必须有人当总机。
@MainActor
final class RemoteControlHub {
    static let shared = RemoteControlHub()
    private weak var active: RemotePlayable?

    private init() {
        let center = MPRemoteCommandCenter.shared()
        center.playCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.active?.remotePlay() }
            return .success
        }
        center.pauseCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.active?.remotePause() }
            return .success
        }
        center.togglePlayPauseCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.active?.remoteToggle() }
            return .success
        }
        center.nextTrackCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.active?.remoteNext() }
            return .success
        }
        center.previousTrackCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.active?.remotePrevious() }
            return .success
        }
        center.changePlaybackPositionCommand.addTarget { [weak self] event in
            guard let e = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
            Task { @MainActor in self?.active?.remoteSeek(to: e.positionTime) }
            return .success
        }
    }

    func claim(_ player: RemotePlayable) { active = player }

    func release(_ player: RemotePlayable) {
        if active === player { active = nil }
    }
}
