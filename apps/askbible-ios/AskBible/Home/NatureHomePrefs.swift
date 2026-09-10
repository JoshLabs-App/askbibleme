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
    }

    func selectScene(_ id: String) {
        guard NatureScenes.scene(id: id) != nil else { return }
        sceneId = id
        defaults.set(id, forKey: Self.sceneKey)
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
