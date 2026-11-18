package me.askbible.native_.data

/**
 * Async auth responses may only replace the session from which they started.
 * Account revisions survive token refreshes, but invalidate sync after sign-out,
 * including signing back in to the same account while an old request is pending.
 * Access is confined to the store's main dispatcher.
 */
class MemberSessionState(initial: MemberSession? = null) {
    var session: MemberSession? = initial
        private set
    var revision: Long = 0
        private set
    var accountRevision: Long = 0
        private set

    fun replace(next: MemberSession?) {
        if (next == null || session?.user?.id != next.user.id) accountRevision++
        revision++
        session = next
    }

    fun replaceIfCurrent(expectedRevision: Long, next: MemberSession?): Boolean {
        if (revision != expectedRevision) return false
        replace(next)
        return true
    }
}
