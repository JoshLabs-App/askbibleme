package me.askbible.native_.data

import com.sun.net.httpserver.HttpServer
import java.io.File
import java.net.InetSocketAddress
import java.nio.file.Files
import org.junit.Assert.*
import org.junit.Test

class SQLiteDownloadTest {
    private val fixture get() = File("../app/src/main/assets/web-en.sqlite")

    private fun withResponse(bytes: ByteArray, status: Int = 200, chunked: Boolean = false, action: (String, File) -> Unit) {
        val directory = Files.createTempDirectory("askbible-sqlite-download-").toFile()
        val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        server.createContext("/database") { exchange ->
            try {
                exchange.sendResponseHeaders(status, if (chunked) 0 else bytes.size.toLong())
                exchange.responseBody.use { it.write(bytes) }
            } finally { exchange.close() }
        }
        server.start()
        try { action("http://127.0.0.1:${server.address.port}/database", File(directory, "scripture.sqlite")) }
        finally { server.stop(0); directory.deleteRecursively() }
    }

    @Test fun completeDatabaseIsInstalledByteForByte() {
        val bytes = fixture.readBytes()
        withResponse(bytes) { url, destination ->
            SQLiteDownload.install(url, destination)
            assertArrayEquals(bytes, destination.readBytes())
            assertTrue(SQLiteDownload.isComplete(destination))
            assertEquals(listOf(destination.name), destination.parentFile!!.list()!!.toList())
        }
    }

    @Test fun htmlSuccessResponseDoesNotPoisonTheOfflineCache() {
        withResponse("<html>Temporary service error</html>".toByteArray()) { url, destination ->
            assertThrows(java.io.IOException::class.java) { SQLiteDownload.install(url, destination) }
            assertFalse(destination.exists())
            assertTrue(destination.parentFile!!.list()!!.isEmpty())
        }
    }

    @Test fun chunkedDownloadMissingWholePagesIsRejected() {
        val bytes = fixture.inputStream().use { it.readNBytes(4096) }
        withResponse(bytes, chunked = true) { url, destination ->
            assertThrows(java.io.IOException::class.java) { SQLiteDownload.install(url, destination) }
            assertFalse(destination.exists())
        }
    }

    @Test fun failedReplacementPreservesTheExistingOfflineDatabase() {
        withResponse(fixture.inputStream().use { it.readNBytes(101) }) { url, destination ->
            val original = fixture.readBytes()
            destination.writeBytes(original)
            assertThrows(java.io.IOException::class.java) { SQLiteDownload.install(url, destination) }
            assertArrayEquals(original, destination.readBytes())
            assertEquals(listOf(destination.name), destination.parentFile!!.list()!!.toList())
        }
    }

    @Test fun partialHttpResponseIsNotAcceptedAsACompleteDatabase() {
        withResponse(fixture.readBytes(), status = 206) { url, destination ->
            assertThrows(java.io.IOException::class.java) { SQLiteDownload.install(url, destination) }
            assertFalse(destination.exists())
        }
    }
}
