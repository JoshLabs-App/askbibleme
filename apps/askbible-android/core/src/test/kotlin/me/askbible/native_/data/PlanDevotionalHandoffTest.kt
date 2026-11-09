package me.askbible.native_.data

import org.junit.Assert.assertEquals
import org.junit.Test

class PlanDevotionalHandoffTest {
    private fun check(expected: Boolean, natural: Boolean = true, active: Boolean = true,
                      count: Int = 3, index: Int = 2, day: String? = "2026-11-09", enabled: Boolean = true, available: Boolean = true) {
        assertEquals(expected, PlanDevotionalHandoff.shouldPlay(natural, active, count, index, day, "2026-11-09", enabled, available))
    }
    @Test fun onlyTodaysNaturalLastChapterHandsOff() {
        check(true)
        check(false, enabled = false)
        check(false, natural = false)
        check(false, active = false)
        check(false, count = 0, index = -1)
        check(false, index = 1)
        check(false, day = "2026-11-08")
        check(false, day = "2026-11-10")
        check(false, day = null)
        check(false, available = false)
        check(true, count = 1, index = 0)
    }
}
