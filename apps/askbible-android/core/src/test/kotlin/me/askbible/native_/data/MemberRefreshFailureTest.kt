package me.askbible.native_.data

import com.sun.net.httpserver.HttpServer
import java.net.InetSocketAddress
import org.junit.Assert.assertEquals
import org.junit.Test

class MemberRefreshFailureTest {
    private fun refreshResponse(status: Int): MemberAuthResult.Failed {
        val previousApi = Endpoints.apiBase
        val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        server.createContext("/auth/v1/token") { exchange ->
            val response = "{\"message\":\"temporarily unavailable\"}".toByteArray()
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
            return SupabaseAuthClient.refresh("test-refresh-token", null) as MemberAuthResult.Failed
        } finally {
            useApi(previousApi)
            server.stop(0)
        }
    }

    @Test fun transientServiceFailureDoesNotInvalidateCredentials() {
        for (status in listOf(429, 500, 503)) assertEquals("HTTP $status", "network", refreshResponse(status).code)
    }

    @Test fun rejectedRefreshStillInvalidatesCredentials() {
        assertEquals("refresh_failed", refreshResponse(400).code)
    }
}
