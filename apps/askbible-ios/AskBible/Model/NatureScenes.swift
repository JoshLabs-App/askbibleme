import UIKit
import ImageIO

/// 首页自然场景。搬自 RN assets/content/nature-settings.json（顺序 = 配置顺序）
/// + nature/ambientSceneSlots.ts（每景默认环境音、英文名）+ natureHomeVerseAppearancePrefs.ts（字号档）。
/// 海报 / 柔焦海报 / 循环视频都随安装包内置（Resources/nature/，tools/gen-nature-scenes.mjs 从 RN assets 复制），
/// 文件名 = 前缀 + 场景 id。与 Kotlin core 的 NatureScenes 对等，`npm run check:nature-scenes` 对拍表格。
struct NatureScene: Identifiable, Hashable {
    let id: String
    let title: String
    let titleEn: String
    /// 用户点选该景时默认打开的环境音；循环自动切景不触发
    let defaultAmbient: String?
}

enum NatureScenes {
    static let scenes: [NatureScene] = [
        NatureScene(id: "9cc949f2-3c1d-49c0-8357-2dc1d32bd954", title: "雪山湖", titleEn: "Snow Lake", defaultAmbient: "scene-water"),
        NatureScene(id: "3c8150de-7baa-4334-9c89-4042781ced66", title: "雨夜城", titleEn: "Rain City", defaultAmbient: "scene-rain"),
        NatureScene(id: "7536456b-50fe-42c0-ad70-e78c9710e762", title: "云海", titleEn: "Cloud Sea", defaultAmbient: "scene-wind"),
        NatureScene(id: "d721567f-395f-41d0-b022-7f78a4ef456e", title: "层峦", titleEn: "Ridges", defaultAmbient: "scene-wind"),
        NatureScene(id: "d86754f9-2c16-4896-a00f-31a29858b547", title: "晨光", titleEn: "Dawn", defaultAmbient: "scene-white-noise"),
        NatureScene(id: "3ebc424b-5a1b-48dd-accb-0906186dfda0", title: "雾林", titleEn: "Mist Forest", defaultAmbient: "scene-birds"),
        NatureScene(id: "c6eed3e9-7b57-4fd8-9843-4af6fb321b0c", title: "雨窗", titleEn: "Rain Window", defaultAmbient: "scene-rain"),
        NatureScene(id: "260b958e-f95a-4900-80b5-3ae9e7b2d720", title: "晨读", titleEn: "Morning", defaultAmbient: "scene-white-noise"),
        NatureScene(id: "8132b70e-f9dc-44a3-9cb0-35f43a46ef33", title: "暮湖", titleEn: "Dusk Lake", defaultAmbient: "scene-water"),
    ]

    /// nature-settings.json activeVideoId
    static let defaultSceneId = "9cc949f2-3c1d-49c0-8357-2dc1d32bd954"

    static func scene(id: String) -> NatureScene? { scenes.first { $0.id == id } }

    /// RN sortNatureScenesByUsage：按点选次数降序，同次数保持配置顺序
    static func sortedByUsage(_ usage: [String: Int]) -> [NatureScene] {
        scenes.enumerated()
            .sorted { a, b in
                let ca = usage[a.element.id] ?? 0, cb = usage[b.element.id] ?? 0
                return ca != cb ? ca > cb : a.offset < b.offset
            }
            .map(\.element)
    }

    /// RN NATURE_HOME_TEXT_SCALE_STEPS；默认档 12（= 1.0）
    static let textScaleSteps: [CGFloat] = [
        0.5, 0.54, 0.58, 0.62, 0.66, 0.7, 0.74, 0.78, 0.82, 0.86, 0.91, 0.96, 1, 1.05, 1.1, 1.15, 1.22,
        1.29, 1.36, 1.44, 1.54, 1.64, 1.75, 1.86, 2, 2.12, 2.25, 2.38, 2.55, 2.72, 2.9, 3.1, 3.35, 3.6, 3.65,
        3.7, 3.75, 3.82, 3.89, 3.96, 4.04, 4.14, 4.24, 4.35, 4.46, 4.6, 4.72, 4.85, 4.98, 5.15, 5.32, 5.5,
        5.7, 5.95, 6.2,
    ]
    static let defaultTextScaleIndex = 12

    /// RN cycleShellSleepTimerMinutes：0 → 15 → 30 → 60 → 120 → 0
    static func cycleSleepTimer(_ current: Int) -> Int {
        switch current {
        case 0: return 15
        case 15: return 30
        case 30: return 60
        case 60: return 120
        default: return 0
        }
    }

    // MARK: 资源

    /// 工程用文件系统同步组，子目录可能被摊平进包根（海报与柔焦海报同名会撞），所以文件名带前缀，先按子目录找、找不到再找包根
    static func resourceURL(_ name: String, ext: String) -> URL? {
        Bundle.main.url(forResource: name, withExtension: ext, subdirectory: "nature")
            ?? Bundle.main.url(forResource: name, withExtension: ext)
    }

    static func videoURL(id: String) -> URL? { resourceURL("nature-video-\(id)", ext: "mp4") }

    /// 全屏海报（live 时垫在视频底下）/ 柔焦海报（关 live 时就看它）。整张解码有几 MB，只留最近一张
    private static var posterCache: (key: String, image: UIImage)?
    static func posterImage(id: String, soft: Bool) -> UIImage? {
        let name = (soft ? "nature-soft-" : "nature-poster-") + id
        if let hit = posterCache, hit.key == name { return hit.image }
        guard let url = resourceURL(name, ext: "jpg"), let image = UIImage(contentsOfFile: url.path) else { return nil }
        posterCache = (name, image)
        return image
    }

    /// 场景条 64pt 圆图：按 256px 降采样解码（RN 用 previewFrameSrc 小图；原生没打小图，就地缩）
    private static var thumbCache: [String: UIImage] = [:]
    static func thumbImage(id: String) -> UIImage? {
        if let hit = thumbCache[id] { return hit }
        guard let url = resourceURL("nature-poster-" + id, ext: "jpg"),
              let source = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceThumbnailMaxPixelSize: 256,
            kCGImageSourceCreateThumbnailWithTransform: true,
        ]
        guard let cg = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else { return nil }
        let image = UIImage(cgImage: cg)
        thumbCache[id] = image
        return image
    }
}
