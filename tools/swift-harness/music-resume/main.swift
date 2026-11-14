import Foundation

let track = MusicCatalog.tracks[1]
let saved = MusicResumeState(trackId: track.id, timeSec: 83.25, repeatMode: "off", wasPlaying: false, sleepDeadline: nil)
let decoded = try JSONDecoder().decode(MusicResumeState.self, from: JSONEncoder().encode(saved))
precondition(decoded.trackId == track.id && decoded.timeSec == 83.25 && decoded.repeatMode == "off" && !decoded.wasPlaying)
let reordered = Array(MusicCatalog.tracks.reversed())
precondition(reordered[saved.trackIndex(in: reordered)!].id == track.id)
precondition(saved.trackIndex(in: MusicCatalog.tracks.filter { $0.id != track.id }) == nil)
precondition((try? JSONDecoder().decode(MusicResumeState.self, from: Data("{broken".utf8))) == nil)
precondition(MusicResumeState.position(83.25, duration: 0) == 83.25)
precondition(MusicResumeState.position(99.5, duration: 100) == 99.5)
for position in [-1.0, .nan, .infinity, 100, 101] {
    precondition(MusicResumeState.position(position, duration: 100) == 0)
}
precondition(!saved.shouldResume(now: 100))
let expired = MusicResumeState(trackId: track.id, timeSec: 83.25, repeatMode: "all", wasPlaying: true, sleepDeadline: 99)
precondition(!expired.shouldResume(now: 100))
precondition(expired.shouldResume(now: 98))
print("Swift music resume: round trip, stable IDs, missing song, malformed state, positions, paused state, sleep expiry passed")
