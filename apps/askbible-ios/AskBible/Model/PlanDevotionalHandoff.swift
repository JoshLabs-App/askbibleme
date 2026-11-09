import Foundation

/// Only a natural end of today's last plan item can hand playback to the devotional.
enum PlanDevotionalHandoff {
    static func shouldPlay(naturalEnd: Bool, active: Bool, count: Int, index: Int,
                           listeningDay: String?, today: String, enabled: Bool, available: Bool) -> Bool {
        naturalEnd && active && count > 0 && index == count - 1 && listeningDay == today && enabled && available
    }
}
