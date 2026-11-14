package me.askbible.native_.data

import org.junit.Assert.*
import org.junit.Test

class MusicResumeStateTest {
    private val track = MusicCatalog.tracks[1]
    private fun saved(playing: Boolean = false, deadline: Double? = null) =
        MusicResumeState(track.id, 83.25, "off", playing, deadline)

    @Test fun restartPreservesTrackPositionPauseAndRepeat() {
        assertEquals(saved(), MusicResumeState.decode(saved().encode()))
    }

    @Test fun catalogReorderingKeepsTheSameSong() {
        val reordered = MusicCatalog.tracks.reversed()
        assertEquals(track.id, reordered[saved().trackIndex(reordered)!!].id)
    }

    @Test fun deletedSongDoesNotResumeAnUnrelatedSong() {
        assertNull(saved().trackIndex(MusicCatalog.tracks.filter { it.id != track.id }))
    }

    @Test fun malformedStorageIsIgnored() {
        assertNull(MusicResumeState.decode("{broken"))
        assertNull(MusicResumeState.decode("{}"))
    }

    @Test fun pendingDurationAndLastSecondsAreRetained() {
        assertEquals(83.25, MusicResumeState.position(83.25, 0.0), 0.0)
        assertEquals(99.5, MusicResumeState.position(99.5, 100.0), 0.0)
    }

    @Test fun completedAndInvalidPositionsRestartSafely() {
        for (position in listOf(-1.0, Double.NaN, Double.POSITIVE_INFINITY, 100.0, 101.0)) {
            assertEquals(0.0, MusicResumeState.position(position, 100.0), 0.0)
        }
    }

    @Test fun pausedOrExpiredSleepTimerNeverAutoplays() {
        assertFalse(saved().shouldResume(100.0))
        assertFalse(saved(true, 99.0).shouldResume(100.0))
        assertTrue(saved(true, 101.0).shouldResume(100.0))
        assertTrue(saved(true).shouldResume(100.0))
    }
}
