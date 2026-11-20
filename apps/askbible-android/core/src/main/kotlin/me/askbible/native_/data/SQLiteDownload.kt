package me.askbible.native_.data

import java.io.DataInputStream
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.MessageDigest

/** Downloads are installed only after their HTTP length, SQLite pages, and optional SHA-256 agree. */
object SQLiteDownload {
    private val signature = "SQLite format 3\u0000".toByteArray(Charsets.US_ASCII)

    fun sha256Hex(file: File): String? = runCatching {
        val md = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buf = ByteArray(1 shl 16)
            while (true) {
                val n = input.read(buf)
                if (n <= 0) break
                md.update(buf, 0, n)
            }
        }
        md.digest().joinToString("") { "%02x".format(it) }
    }.getOrNull()

    // SQLite's 100-byte header records page size and, when current, page count:
    // https://www.sqlite.org/fileformat.html#the_database_header
    fun isComplete(file: File): Boolean = runCatching {
        val size = file.length()
        if (size < 100) return false
        val header = ByteArray(100)
        DataInputStream(file.inputStream()).use { it.readFully(header) }
        if (!header.copyOfRange(0, 16).contentEquals(signature)) return false
        val encodedPageSize = (header[16].toInt() and 255) * 256 + (header[17].toInt() and 255)
        val pageSize = if (encodedPageSize == 1) 65536 else encodedPageSize
        if (pageSize !in 512..65536 || pageSize and (pageSize - 1) != 0 || size % pageSize != 0L) return false
        fun uint(offset: Int): Long = (offset until offset + 4).fold(0L) { value, i -> (value shl 8) or (header[i].toLong() and 255) }
        val pageCount = uint(28)
        pageCount == 0L || uint(24) != uint(92) || size == pageCount * pageSize
    }.getOrDefault(false)

    fun install(
        url: String,
        destination: File,
        expectedSha256: String? = null,
        expectedSizeBytes: Long? = null,
        onProgress: (Double) -> Unit = {},
    ) {
        val parent = destination.absoluteFile.parentFile ?: throw IOException("Missing download directory")
        if (!parent.isDirectory && !parent.mkdirs()) throw IOException("Cannot create download directory")
        val temporary = File.createTempFile(destination.name + ".", ".part", parent)
        var connection: HttpURLConnection? = null
        try {
            val conn = URL(url).openConnection() as HttpURLConnection
            connection = conn
            conn.connectTimeout = 20_000
            conn.readTimeout = 120_000
            if (conn.responseCode != HttpURLConnection.HTTP_OK) throw IOException("HTTP ${conn.responseCode}")
            val total = conn.contentLengthLong
            var read = 0L
            conn.inputStream.use { input ->
                temporary.outputStream().use { output ->
                    val buffer = ByteArray(1 shl 16)
                    var lastPercent = -1
                    while (true) {
                        val count = input.read(buffer)
                        if (count < 0) break
                        output.write(buffer, 0, count)
                        read += count
                        if (total > 0) {
                            val percent = (read * 100 / total).toInt().coerceIn(0, 100)
                            if (percent != lastPercent) { lastPercent = percent; onProgress(percent / 100.0) }
                        }
                    }
                }
            }
            if (total > 0 && read != total) throw IOException("Truncated download: $read/$total")
            if (expectedSizeBytes != null && expectedSizeBytes > 0L && read != expectedSizeBytes) {
                throw IOException("Pack size mismatch: $read/$expectedSizeBytes")
            }
            if (!isComplete(temporary)) throw IOException("Invalid or incomplete SQLite download")
            val cleanExpectedSha = expectedSha256?.trim()?.lowercase()?.ifEmpty { null }
            if (cleanExpectedSha != null) {
                val actualSha = sha256Hex(temporary) ?: ""
                if (actualSha != cleanExpectedSha) {
                    throw IOException("Pack SHA-256 mismatch")
                }
            }
            // Never expose a partially copied file, and keep a previous database
            // intact if validation or replacement fails.
            Files.move(temporary.toPath(), destination.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
        } finally {
            connection?.disconnect()
            temporary.delete()
        }
    }
}
