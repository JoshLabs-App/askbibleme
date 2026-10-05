import SwiftUI

/// 首页场景相关偏好，对应 RN 的 natureActiveScenePrefs / natureHomeLiveVideoPrefs / natureHomeVerseAppearancePrefs（字号档）/
/// natureSceneUsage，键与 RN AsyncStorage 同名。环境音跟 RN 一样不做冷启动恢复：打开 App 不自动出声，点选场景才跟场景默认。
/// 与 Android 的 NatureHomePrefs 对等。
@MainActor
final class NatureHomePrefs: ObservableObject {
    @Published private(set) var sceneId: String
    /// 默认开：直接播循环视频；点「模糊」切柔焦静帧
    @Published private(set) var liveVideo: Bool
    @Published private(set) var textScaleIndex: Int
    /// 每景被点选的次数，场景条按它排序
    @Published private(set) var usage: [String: Int]

    var textScale: CGFloat { NatureScenes.textScaleSteps[textScaleIndex] }

    private let defaults = UserDefaults.standard
    private static let sceneKey = "askbible-mobile-nature-active-scene-v1"
    private static let liveKey = "askbible-nature-home-live-video-v1"
    private static let scaleKey = "askbible-nature-home-text-scale-v1"
    private static let usageKey = "askbible.mobile.nature-scene-usage.v1"
    /// 当前场景是哪一天定下的（本地日序号 = 1970-01-01 起的天数），跨天进 App 就换景
    private static let sceneDayKey = "askbible-nature-home-scene-day-v1"

    init() {
        let d = UserDefaults.standard
        let storedScene = d.string(forKey: Self.sceneKey) ?? ""
        sceneId = NatureScenes.scene(id: storedScene) != nil ? storedScene : NatureScenes.defaultSceneId
        liveVideo = (d.string(forKey: Self.liveKey) ?? "1") != "0"
        // RN 存 {"v":3,"stepIndex":n}
        var index = NatureScenes.defaultTextScaleIndex
        if let raw = d.string(forKey: Self.scaleKey), let data = raw.data(using: .utf8),
           let j = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any], let n = j["stepIndex"] as? Int {
            index = n
        }
        textScaleIndex = max(0, min(NatureScenes.textScaleSteps.count - 1, index))
        var map: [String: Int] = [:]
        if let raw = d.string(forKey: Self.usageKey), let data = raw.data(using: .utf8),
           let j = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] {
            for (k, v) in j { if let n = v as? Int, n > 0 { map[k] = n } }
        }
        usage = map
        rotateIfNewDay()
    }

    /// 每天换一个场景（Josh 2026-10-05）：跨天第一次进 App / 回前台时按日序号轮到下一景，同一天内不动；
    /// 当天手动点选的景保留到当天结束。首次安装（没记过日子）只记下今天，先看默认景，明天开始轮换。
    /// 和安卓用同一个公式（日序号 % 景数），两端同一天看到同一景。不触发环境音。
    func rotateIfNewDay() {
        let today = Self.localDayNumber()
        let stored = defaults.object(forKey: Self.sceneDayKey) as? Int
        guard stored != today else { return }
        defaults.set(today, forKey: Self.sceneDayKey)
        guard stored != nil else { return }
        let all = NatureScenes.scenes
        guard all.count > 1 else { return }
        var next = all[((today % all.count) + all.count) % all.count].id
        if next == sceneId, let i = all.firstIndex(where: { $0.id == next }) { next = all[(i + 1) % all.count].id }
        sceneId = next
        defaults.set(next, forKey: Self.sceneKey)
    }

    private static func localDayNumber(_ now: Date = Date()) -> Int {
        let secs = now.timeIntervalSince1970 + Double(TimeZone.current.secondsFromGMT(for: now))
        return Int(floor(secs / 86_400))
    }

    func selectScene(_ id: String) {
        guard NatureScenes.scene(id: id) != nil else { return }
        sceneId = id
        defaults.set(id, forKey: Self.sceneKey)
        defaults.set(Self.localDayNumber(), forKey: Self.sceneDayKey)
    }

    func bumpUsage(_ id: String) {
        usage[id, default: 0] += 1
        if let data = try? JSONSerialization.data(withJSONObject: usage), let s = String(data: data, encoding: .utf8) {
            defaults.set(s, forKey: Self.usageKey)
        }
    }

    func toggleLiveVideo(_ on: Bool) {
        liveVideo = on
        defaults.set(on ? "1" : "0", forKey: Self.liveKey)
    }

    func bumpTextScale(_ delta: Int) {
        let next = max(0, min(NatureScenes.textScaleSteps.count - 1, textScaleIndex + delta))
        guard next != textScaleIndex else { return }
        textScaleIndex = next
        defaults.set("{\"v\":3,\"stepIndex\":\(next)}", forKey: Self.scaleKey)
    }
}
