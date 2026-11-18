package me.askbible.native_.data

import org.junit.Assert.*
import org.junit.Test

class MemberSessionStateTest {
    private fun session(id: String, token: String = "token-$id") = MemberSession(
        token, "2030-01-01T00:00:00Z", MemberUser(id, "$id@example.test", id), "refresh-$token",
    )

    @Test fun refreshCompletingAfterSignOutCannotRestoreTheAccount() {
        val state = MemberSessionState(session("alice"))
        val requestRevision = state.revision
        state.replace(null)
        assertFalse(state.replaceIfCurrent(requestRevision, session("alice", "refreshed")))
        assertNull(state.session)
    }

    @Test fun rejectedOldRefreshCannotSignOutTheNewAccount() {
        val state = MemberSessionState(session("alice"))
        val requestRevision = state.revision
        state.replace(session("bob"))
        assertFalse(state.replaceIfCurrent(requestRevision, null))
        assertEquals("bob", state.session?.user?.id)
    }

    @Test fun lateVerificationCannotOverwriteAChangedDisplayName() {
        val original = session("alice")
        val state = MemberSessionState(original)
        val requestRevision = state.revision
        state.replace(original.copy(user = original.user.copy(name = "New name")))
        assertFalse(state.replaceIfCurrent(requestRevision, original))
        assertEquals("New name", state.session?.user?.name)
    }

    @Test fun currentRefreshRotatesBothTokensWithoutInvalidatingAccountSync() {
        val state = MemberSessionState(session("alice"))
        val accountRevision = state.accountRevision
        assertTrue(state.replaceIfCurrent(state.revision, session("alice", "refreshed")))
        assertEquals("refreshed", state.session?.sessionToken)
        assertEquals("refresh-refreshed", state.session?.refreshToken)
        assertEquals(accountRevision, state.accountRevision)
    }

    @Test fun signingBackIntoTheSameAccountInvalidatesOldSync() {
        val state = MemberSessionState(session("alice"))
        val originalAccountRevision = state.accountRevision
        state.replace(null)
        state.replace(session("alice", "new-login"))
        assertNotEquals(originalAccountRevision, state.accountRevision)
    }

    @Test fun signOutAlsoInvalidatesPendingLoginWhenAlreadySignedOut() {
        val state = MemberSessionState()
        val requestRevision = state.revision
        state.replace(null)
        assertFalse(state.replaceIfCurrent(requestRevision, session("alice")))
        assertNull(state.session)
    }
}
