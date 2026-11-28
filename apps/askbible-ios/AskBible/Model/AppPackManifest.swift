import Foundation

/// D-47 `pack-manifest.json`、本地状态 `active.json` 与路径/哈希校验纯模型。
extension AppPackStore {
    struct FileMeta: Codable, Equatable {
        let size: Int
        let sha256: String
    }

    struct Manifest: Codable, Equatable {
        let schemaVersion: Int
        let bundleId: String
        let builtAt: String
        let entry: String
        let files: [String: FileMeta]
    }

    struct ActiveState: Codable, Equatable {
        let bundleId: String
        let installedOnBuiltinId: String
        let activatedAt: String
    }

    struct Status: Equatable {
        let activeBundleId: String?
        let activeSource: String
        let pendingBundleId: String?
        let installedOnBuiltinId: String?
        let currentBuiltinId: String
        let lastCheckedAt: String?
        let isChecking: Bool
        let lastError: String?
    }

    struct SwapResult: Equatable {
        let swapped: Bool
        let bundleId: String?
        let activatedAt: String?
        let reason: String?
    }

    enum CheckOutcome: Equatable {
        case throttled
        case upToDate(String?)
        case readyToSwap(String)
        case unreachable
        case failed(String)
    }

    static func readManifest(at url: URL) -> Manifest? {
        guard let data = try? Data(contentsOf: url),
              let manifest = try? JSONDecoder().decode(Manifest.self, from: data),
              isValidManifest(manifest) else { return nil }
        return manifest
    }

    static func isValidManifest(_ manifest: Manifest) -> Bool {
        guard manifest.schemaVersion >= 1,
              !manifest.bundleId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              isValidSafePath(manifest.entry),
              manifest.files[manifest.entry] != nil,
              !manifest.files.isEmpty else {
            return false
        }
        for (path, meta) in manifest.files {
            guard isValidSafePath(path),
                  meta.size >= 0,
                  meta.sha256.trimmingCharacters(in: .whitespacesAndNewlines).count == 64 else {
                return false
            }
        }
        return true
    }

    static func isValidSafePath(_ relPath: String) -> Bool {
        !relPath.isEmpty && !relPath.hasPrefix("/") && !relPath.contains("\\") && !relPath.contains("..")
    }

    static func fileMatches(_ url: URL, expectedSize: Int, expectedSha256: String) -> Bool {
        let fm = FileManager.default
        guard fm.fileExists(atPath: url.path),
              let attrs = try? fm.attributesOfItem(atPath: url.path),
              let size = (attrs[.size] as? NSNumber)?.intValue,
              size == expectedSize,
              let actualSha = PackStore.sha256Hex(of: url)?.lowercased() else {
            return false
        }
        return actualSha == expectedSha256.lowercased()
    }

    static func verifyDirectory(_ dir: URL, matches manifest: Manifest) -> Bool {
        for (relPath, meta) in manifest.files {
            guard isValidSafePath(relPath) else { return false }
            let fileURL = dir.appendingPathComponent(relPath)
            if !fileMatches(fileURL, expectedSize: meta.size, expectedSha256: meta.sha256) {
                return false
            }
        }
        return true
    }
}
