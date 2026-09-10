import Foundation

/// 译本偏好的落盘格式，与 RN `read-bible-translation-prefs.ts` 同键同形（与 Kotlin 的 TranslationPrefsRules 对等）：
/// `selah_read_bible_translation_v1` = {"version":1,"primaryTranslationId":…,"contrastTranslationIds":[…],"audioTranslationId":null}
/// 原生只接一路对照译本：读回取 contrastTranslationIds 里第一个合法且 ≠ 主译本的 id（老字段 contrastTranslationId 也认），写回也只写一项。
/// audioTranslationId 原生不用，恒写 null（= 朗读随主译本）。
enum TranslationPrefsRules {
    static let key = "selah_read_bible_translation_v1"

    struct Stored: Equatable {
        let primaryId: String
        let secondaryId: String?
    }

    /// raw 为空 / 非 JSON / version ≠ 1 / 主译本不在内置表 → 默认主译本、无对照
    static func parse(_ raw: String?, allowed: [String], defaultId: String) -> Stored {
        let fallback = Stored(primaryId: defaultId, secondaryId: nil)
        guard let text = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty,
              let data = text.data(using: .utf8),
              let j = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              let version = j["version"] as? NSNumber,
              // RN 是 `j.version !== 1`：布尔 true / 字符串 "1" 都不算（JSONSerialization 里 true 也是 NSNumber，要按类型排除）
              CFGetTypeID(version) != CFBooleanGetTypeID(), version.doubleValue == 1 else { return fallback }
        let rawPrimary = (j["primaryTranslationId"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let primary = !rawPrimary.isEmpty && allowed.contains(rawPrimary) ? rawPrimary : defaultId
        // RN：`j.contrastTranslationIds ?? j.contrastTranslationId` —— 前者缺失或 null 才看老字段；数组逐项，字符串当单项
        var rawContrast = j["contrastTranslationIds"]
        if rawContrast == nil || rawContrast is NSNull { rawContrast = j["contrastTranslationId"] }
        let candidates: [String]
        if let list = rawContrast as? [Any] {
            candidates = list.map { ($0 as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "" }
        } else if let single = rawContrast as? String {
            candidates = [single.trimmingCharacters(in: .whitespacesAndNewlines)]
        } else {
            candidates = []
        }
        let secondary = candidates.first { !$0.isEmpty && $0 != primary && allowed.contains($0) }
        return Stored(primaryId: primary, secondaryId: secondary)
    }

    /// 与 RN `JSON.stringify(normalized)` 逐字节相同的键序
    static func serialize(primaryId: String, secondaryId: String?) -> String {
        let contrast: String
        if let s = secondaryId, s != primaryId { contrast = "[" + quote(s) + "]" } else { contrast = "[]" }
        return "{\"version\":1,\"primaryTranslationId\":" + quote(primaryId) +
            ",\"contrastTranslationIds\":" + contrast + ",\"audioTranslationId\":null}"
    }

    private static func quote(_ s: String) -> String {
        var out = "\""
        for ch in s.unicodeScalars {
            switch ch {
            case "\"": out += "\\\""
            case "\\": out += "\\\\"
            case "\n": out += "\\n"
            case "\r": out += "\\r"
            case "\t": out += "\\t"
            default:
                if ch.value < 0x20 { out += String(format: "\\u%04x", ch.value) } else { out.unicodeScalars.append(ch) }
            }
        }
        return out + "\""
    }
}
