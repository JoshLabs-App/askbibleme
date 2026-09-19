import AVFoundation
import UIKit

/// 成就的「听觉 + 触觉」反馈（Josh 2026-09-19：「加 XP 这些……时，都会有声音，动态的」）。
///
/// 三个音效是本机合成的钟声（非谐波分音 + 指数衰减），不是游戏的电子 ding ——
/// 和羊皮卷 / 修道院的语气对齐。生成脚本见 `tools/gen-achievement-sfx.py`。
///
/// 三条硬约束：
/// 1. **绝不打断正在播的经文 / 音乐**：音频会话用 `.ambient` + `.mixWithOthers`，
///    而且**只在播放时临时激活**，用完不去动全局会话，免得把 ChapterAudioPlayer
///    的 `.playback / .spokenAudio` 配置顶掉。
/// 2. **跟随静音键**：`.ambient` 类别在静音档下本来就不出声，这是对的 ——
///    用户把手机调静音，就是不想让它响。
/// 3. **可以关**：设置里一个开关，默认开。
@MainActor
final class AchievementFeedback {
    static let shared = AchievementFeedback()

    enum Cue {
        /// +XP 的轻点。读 / 听的时候几秒一次，必须短且轻，不然很快就烦。
        case xp
        /// 拿到勋章 / 卷印：单声钟
        case earn
        /// 升级：三声上行钟 + 更重的触感
        case levelUp

        var file: String {
            switch self {
            case .xp: return "xp"
            case .earn: return "earn"
            case .levelUp: return "levelup"
            }
        }
    }

    static let soundEnabledKey = "askbible-achievement-sound-v1"

    /// 默认开。`object(forKey:)` 为 nil 时 `bool(forKey:)` 返回 false，所以要先判存在。
    static var soundEnabled: Bool {
        get {
            let d = UserDefaults.standard
            guard d.object(forKey: soundEnabledKey) != nil else { return true }
            return d.bool(forKey: soundEnabledKey)
        }
        set { UserDefaults.standard.set(newValue, forKey: soundEnabledKey) }
    }

    /// 每个音效预留两个播放器轮换：连着两次 +XP 时，第二声不会把第一声掐掉。
    private var players: [String: [AVAudioPlayer]] = [:]
    private var cursor: [String: Int] = [:]
    /// 两次 +XP 之间的最小间隔：真机上连读会密集触发，太密就成噪音了
    private var lastXPAt: Date = .distantPast

    private init() {}

    func play(_ cue: Cue) {
        haptic(cue)
        guard Self.soundEnabled else { return }
        if cue == .xp {
            guard Date().timeIntervalSince(lastXPAt) > 0.28 else { return }
            lastXPAt = Date()
        }
        guard let p = player(cue.file) else { return }
        // 只在这一刻借用会话，mixWithOthers 保证经文朗读继续播、不被打断
        let session = AVAudioSession.sharedInstance()
        if session.category != .playback {
            try? session.setCategory(.ambient, mode: .default, options: [.mixWithOthers])
        }
        p.currentTime = 0
        p.play()
    }

    private func haptic(_ cue: Cue) {
        switch cue {
        case .xp:
            UIImpactFeedbackGenerator(style: .light).impactOccurred(intensity: 0.5)
        case .earn:
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        case .levelUp:
            UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
            Task {
                try? await Task.sleep(for: .milliseconds(140))
                UINotificationFeedbackGenerator().notificationOccurred(.success)
            }
        }
    }

    private func player(_ name: String) -> AVAudioPlayer? {
        if players[name] == nil {
            guard let url = Bundle.main.url(forResource: name, withExtension: "m4a") else { return nil }
            let made = (0..<2).compactMap { _ -> AVAudioPlayer? in
                let p = try? AVAudioPlayer(contentsOf: url)
                p?.volume = name == "xp" ? 0.45 : 0.85
                p?.prepareToPlay()   // 先解码好，按下去才是「立刻」响
                return p
            }
            guard !made.isEmpty else { return nil }
            players[name] = made
            cursor[name] = 0
        }
        guard let pool = players[name], !pool.isEmpty else { return nil }
        let i = (cursor[name] ?? 0) % pool.count
        cursor[name] = i + 1
        return pool[i]
    }
}
