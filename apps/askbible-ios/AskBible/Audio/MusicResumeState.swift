import Foundation

/// Store stable IDs, never catalog offsets: adding/reordering songs must not change the saved song.
struct MusicResumeState: Codable {
    static let storageKey = "askbible.music.resume.v1"
    let trackId: String
    let timeSec: Double
    let repeatMode: String
    let wasPlaying: Bool
    let sleepDeadline: Double?

    func trackIndex(in tracks: [MusicTrack]) -> Int? {
        tracks.firstIndex { $0.id == trackId }
    }

    static func position(_ seconds: Double, duration: Double) -> Double {
        guard seconds.isFinite, seconds > 0 else { return 0 }
        // A completed song can be started again; don't silently restart merely near its end.
        if duration.isFinite, duration > 0, seconds >= duration { return 0 }
        return seconds
    }

    func shouldResume(now: Double) -> Bool {
        wasPlaying && (sleepDeadline.map { $0 > now } ?? true)
    }
}
