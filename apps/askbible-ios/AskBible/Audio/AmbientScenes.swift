import Foundation

/// 首页环境音（白噪音 / 雨 / 篝火…）。对应 RN 的 `ambientSceneSlots.ts` + `ambientScenePlaybackGain.ts`
/// + `ambientSceneAudioSource.ts`：2026-09 起不进安装包，R2 点播 + 首次播放缓存到本机。
struct AmbientSlot: Identifiable, Hashable {
    let id: String
    let label: String
    let labelEn: String
    let file: String
    /// 源文件响度差很大（-12 ~ -55 LUFS），按 RN 那份增益表压平
    let gain: Float
}

enum AmbientScenes {
    static let r2PublicBase = "https://pub-f30fb48025d841f09c37bb9b52df5354.r2.dev"
    /// 首页照片是「晨光」→ 默认白噪音（NATURE_SCENE_DEFAULT_AMBIENT）
    static let defaultSlotId = "scene-white-noise"

    /// 与 RN NATURE_AMBIENT_SCENE_SLOTS 同序
    static let slots: [AmbientSlot] = [
        AmbientSlot(id: "scene-water", label: "水", labelEn: "Water", file: "scene-water-lake-120.mp3", gain: 0.8),
        AmbientSlot(id: "scene-rain", label: "雨", labelEn: "Rain", file: "scene-rain-drops-roof-ofs.mp3", gain: 0.8),
        AmbientSlot(id: "scene-birds", label: "鸟", labelEn: "Birds", file: "scene-birds-forest-810419.mp3", gain: 0.8),
        AmbientSlot(id: "scene-white-noise", label: "白噪音", labelEn: "White Noise", file: "scene-white-noise-41.mp3", gain: 0.8),
        AmbientSlot(id: "scene-wind", label: "风", labelEn: "Wind", file: "scene-wind-hum-1177.mp3", gain: 0.088),
        AmbientSlot(id: "scene-fire", label: "火", labelEn: "Fire", file: "scene-campfire-forest-452486.mp3", gain: 0.056),
        AmbientSlot(id: "scene-waves", label: "海浪", labelEn: "Waves", file: "scene-waves-ocean.mp3", gain: 0.16),
        AmbientSlot(id: "scene-thunder", label: "雷", labelEn: "Thunder", file: "scene-thunderstorm-28.mp3", gain: 0.168),
        AmbientSlot(id: "scene-cafe", label: "咖啡厅", labelEn: "Cafe", file: "scene-cafe-120.mp3", gain: 0.52),
    ]

    static func slot(id: String) -> AmbientSlot? { slots.first { $0.id == id } }

    static func remoteURL(id: String) -> URL? {
        guard let s = slot(id: id) else { return nil }
        return URL(string: r2PublicBase + "/audio/scenes/" + s.file)
    }
}
