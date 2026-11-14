package me.askbible.native_.data

/** Only a natural end of today's last plan item can hand playback to the devotional. */
object PlanDevotionalHandoff {
    fun shouldPlay(naturalEnd: Boolean, active: Boolean, count: Int, index: Int,
                   listeningDay: String?, today: String, enabled: Boolean, available: Boolean): Boolean =
        naturalEnd && active && count > 0 && index == count - 1 && listeningDay == today && enabled && available
}
