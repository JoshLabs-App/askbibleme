import Combine
import Foundation

/// D-47 `AskBibleBridge` 三路音频意图与状态快照扩展（保持主分发器精简 ≤ 400 行）。
extension AskBibleBridgeDispatcher {
    func handleAudioIntent(_ params: [String: Any]) -> [String: Any] {
        let stream = (params["stream"] as? String)?.lowercased() ?? ""
        let action = (params["action"] as? String)?.lowercased() ?? ""
        let payload = (params["payload"] as? [String: Any]) ?? [:]
        let _ = (params["origin"] as? String) ?? "kernel"

        switch stream {
        case "music":
            applyMusicIntent(action: action, payload: payload)
        case "scripture", "chapter":
            applyScriptureIntent(action: action, payload: payload)
        case "verse":
            applyVerseIntent(action: action, payload: payload)
        default:
            break
        }

        let snapshot = currentAudioSnapshot()
        emit(event: "audio.state", payload: snapshot)
        return ["ok": true, "state": snapshot]
    }

    private func applyMusicIntent(action: String, payload: [String: Any]) {
        switch action {
        case "play", "resume":
            if let album = payload["album"] as? String { musicPlayer?.selectAlbum(album) }
            if let idx = (payload["trackIndex"] as? NSNumber)?.intValue {
                musicPlayer?.select(index: idx)
            } else {
                musicPlayer?.resume()
            }
        case "pause", "stop": musicPlayer?.pause()
        case "toggle": musicPlayer?.toggle()
        case "next": musicPlayer?.next()
        case "previous", "prev": musicPlayer?.previous()
        case "seek":
            if let sec = (payload["seconds"] as? NSNumber)?.doubleValue { musicPlayer?.seek(to: sec) }
            else if let ratio = (payload["ratio"] as? NSNumber)?.doubleValue { musicPlayer?.seek(ratio: ratio) }
        case "selectalbum":
            if let album = payload["album"] as? String { musicPlayer?.selectAlbum(album) }
        case "togglerepeatone": musicPlayer?.toggleRepeatOne()
        case "togglerepeatall": musicPlayer?.toggleRepeatAll()
        case "setsleeptimer":
            let mins = (payload["minutes"] as? NSNumber)?.intValue ?? 0
            if let onSetSleepTimer { onSetSleepTimer(max(0, mins)) }
            else { musicPlayer?.setSleepTimer(minutes: mins > 0 ? mins : nil) }
        default: break
        }
    }

    private func applyScriptureIntent(action: String, payload: [String: Any]) {
        switch action {
        case "play", "resume":
            if let bookId = payload["bookId"] as? String, !bookId.isEmpty,
               let chapter = (payload["chapter"] as? NSNumber)?.intValue, chapter >= 1 {
                if let onLoadChapterAudio { onLoadChapterAudio(bookId, chapter, true) }
                else { onOpenChapter?(bookId, chapter) }
            } else {
                chapterAudio?.resume()
            }
        case "pause", "stop": chapterAudio?.pause()
        case "toggle": chapterAudio?.toggle()
        case "next": chapterAudio?.onSkipNext?()
        case "previous", "prev": chapterAudio?.seek(to: 0)
        case "seek":
            if let sec = (payload["seconds"] as? NSNumber)?.doubleValue { chapterAudio?.seek(to: sec) }
        case "cyclerate": chapterAudio?.cycleRate()
        case "setrate":
            if let rate = (payload["rate"] as? NSNumber)?.floatValue { chapterAudio?.rate = rate }
        case "cycleloop": chapterAudio?.cycleLoop()
        case "setsleeptimer":
            let mins = (payload["minutes"] as? NSNumber)?.intValue ?? 0
            if let onSetSleepTimer { onSetSleepTimer(max(0, mins)) }
            else { chapterAudio?.setSleepTimer(minutes: mins > 0 ? mins : nil) }
        default: break
        }
    }

    private func applyVerseIntent(action: String, payload: [String: Any]) {
        switch action {
        case "play", "start", "resume": homeController?.startVoice()
        case "pause", "stop": homeController?.stopVoice()
        case "toggle": homeController?.toggleVoice()
        case "next": homeController?.advance(play: homeController?.voiceOn ?? false)
        case "setsleeptimer":
            let mins = (payload["minutes"] as? NSNumber)?.intValue ?? 0
            if let onSetSleepTimer { onSetSleepTimer(max(0, mins)) }
            else { homeController?.setSleepTimer(minutes: mins > 0 ? mins : nil) }
        default: break
        }
    }

    func currentAudioSnapshot() -> [String: Any] {
        var music: [String: Any] = [
            "isPlaying": musicPlayer?.isPlaying ?? false,
            "isLoading": musicPlayer?.isLoading ?? false,
            "album": musicPlayer?.album ?? "",
            "currentTime": musicPlayer?.currentTime ?? 0,
            "duration": musicPlayer?.displayDuration ?? 0,
            "repeatMode": musicPlayer?.repeatMode.rawValue ?? "all",
        ]
        if let track = musicPlayer?.track {
            music["trackId"] = track.id
            music["title"] = track.localizedTitle
            music["artist"] = track.artist
        }

        var scripture: [String: Any] = [
            "isPlaying": chapterAudio?.isPlaying ?? false,
            "isLoading": chapterAudio?.isLoading ?? false,
            "loadedKey": chapterAudio?.loadedKey ?? "",
            "title": chapterAudio?.nowPlayingTitle ?? "",
            "currentTime": chapterAudio?.currentTime ?? 0,
            "duration": chapterAudio?.duration ?? 0,
            "rate": Double(chapterAudio?.rate ?? 1.0),
            "loopMode": chapterAudio?.loopMode.rawValue ?? "forward",
        ]
        if let activeVerse = chapterAudio?.activeVerse {
            scripture["activeVerse"] = activeVerse
        }

        let verse: [String: Any] = [
            "voiceOn": homeController?.voiceOn ?? false,
            "isPlaying": homeController?.player.isPlaying ?? false,
            "verseKey": homeController?.verseKey ?? "",
            "reference": homeController?.verse.reference ?? "",
            "text": homeController?.verse.text ?? "",
        ]

        return ["music": music, "scripture": scripture, "verse": verse]
    }

    func observeAudioStreams() {
        cancellables.removeAll()
        let scheduleEmit = { [weak self] in
            guard let self, !self.audioEmitScheduled else { return }
            self.audioEmitScheduled = true
            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                self.audioEmitScheduled = false
                self.emitAudioState()
            }
        }
        chapterAudio?.objectWillChange.sink { _ in scheduleEmit() }.store(in: &cancellables)
        musicPlayer?.objectWillChange.sink { _ in scheduleEmit() }.store(in: &cancellables)
        homeController?.objectWillChange.sink { _ in scheduleEmit() }.store(in: &cancellables)
        homeController?.player.objectWillChange.sink { _ in scheduleEmit() }.store(in: &cancellables)
    }
}
