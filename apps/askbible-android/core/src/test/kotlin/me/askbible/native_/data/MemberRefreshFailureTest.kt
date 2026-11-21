package me.askbible.native_.data

import com.sun.net.httpserver.HttpServer
import java.net.InetSocketAddress
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MemberRefreshFailureTest {
    private fun verifyResponse(status: Int, body: String = "{\"error\":\"temporarily unavailable\"}"): AskBibleSyncClient.VerifyOutcome {
        val previousApi = Endpoints.apiBase
        val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        server.createContext("/v1/auth/session") { exchange ->
            val response = body.toByteArray()
            exchange.sendResponseHeaders(status, response.size.toLong())
            exchange.responseBody.use { it.write(response) }
            exchange.close()
        }
        fun useApi(url: String) = Endpoints.init(object : Endpoints.Store {
            override fun get(key: String): String? = if (key.endsWith("api")) "$url/" else null
            override fun put(key: String, value: String) = Unit
        })
        server.start()
        try {
            useApi("http://127.0.0.1:${server.address.port}")
            return AskBibleSyncClient.verify("test-session-token")
        } finally {
            useApi(previousApi)
            server.stop(0)
        }
    }

    @Test fun transientServiceFailureDoesNotInvalidateCredentials() {
        for (status in listOf(429, 500, 503)) {
            assertEquals("HTTP $status", AskBibleSyncClient.VerifyOutcome.TransientFailure, verifyResponse(status))
        }
    }

    @Test fun unauthorizedVerifyInvalidatesCredentials() {
        assertEquals(AskBibleSyncClient.VerifyOutcome.Unauthorized, verifyResponse(401))
        assertEquals(AskBibleSyncClient.VerifyOutcome.Unauthorized, verifyResponse(403))
    }

    @Test fun legacyV1JwtSessionIsDroppedCleanly() {
        val legacy = """{"sessionToken":"eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJBIn0.sig","expiresAt":"2030-01-01T00:00:00Z","user":{"id":"A","email":"a@example.test","name":"A"}}"""
        assertNull(MemberAuthRules.parseSession(legacy))
    }
}
