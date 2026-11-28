package me.askbible.native_.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AppPackManifestRulesTest {
    private val shaA = "a".repeat(64)
    private val shaB = "b".repeat(64)
    private val shaC = "c".repeat(64)

    @Test
    fun parsesValidManifestAndRejectsInvalidEntryOrTraversal() {
        val validJson = """
            {
              "schemaVersion": 1,
              "bundleId": "20261127-abc1234",
              "builtAt": "2026-11-27T21:30:00Z",
              "entry": "index.html",
              "files": {
                "index.html": { "size": 1842, "sha256": "$shaA" },
                "assets/app-9a8b7c.js": { "size": 94120, "sha256": "$shaB" },
                "assets/app-3d4e5f.css": { "size": 28410, "sha256": "$shaC" }
              }
            }
        """.trimIndent()

        val manifest = AppPackManifestRules.parseManifestJson(validJson)
        assertNotNull(manifest)
        assertEquals("20261127-abc1234", manifest!!.bundleId)
        assertEquals("index.html", manifest.entry)
        assertEquals(3, manifest.files.size)
        assertEquals(94120L, manifest.files["assets/app-9a8b7c.js"]?.size)

        val roundTrip = AppPackManifestRules.parseManifestJson(
            AppPackManifestRules.serializeManifestJson(manifest)
        )
        assertEquals(manifest, roundTrip)

        val traversalJson = """
            {
              "schemaVersion": 1,
              "bundleId": "bad",
              "entry": "index.html",
              "files": {
                "index.html": { "size": 10, "sha256": "$shaA" },
                "../secret.txt": { "size": 10, "sha256": "$shaB" }
              }
            }
        """.trimIndent()
        assertNull(AppPackManifestRules.parseManifestJson(traversalJson))
    }

    @Test
    fun activeJsonPurgesSandboxOnlyWhenBuiltinIdChanges() {
        val active = AppPackManifestRules.ActivePackRecord(
            bundleId = "20261127-abc1234",
            installedOnBuiltinId = "257:1000:builtin-1",
            activatedAt = "2026-11-27T21:35:00Z",
        )
        val encoded = AppPackManifestRules.serializeActiveJson(active)
        val decoded = AppPackManifestRules.parseActiveJson(encoded)
        assertEquals(active, decoded)

        assertFalse(AppPackManifestRules.shouldPurgeSandboxForNewBuiltin(decoded, "257:1000:builtin-1"))
        assertTrue(AppPackManifestRules.shouldPurgeSandboxForNewBuiltin(decoded, "258:2000:builtin-2"))
        assertFalse(AppPackManifestRules.shouldPurgeSandboxForNewBuiltin(null, "258:2000:builtin-2"))
    }

    @Test
    fun incrementalPlanReusesMatchingSizeAndSha256WithZeroTraffic() {
        val manifest = AppPackManifestRules.PackManifest(
            schemaVersion = 1,
            bundleId = "20261128-next",
            builtAt = "2026-11-28T01:00:00Z",
            entry = "index.html",
            files = mapOf(
                "index.html" to AppPackManifestRules.ManifestFileEntry(1842L, shaA),
                "assets/app-new.js" to AppPackManifestRules.ManifestFileEntry(94120L, shaB),
                "assets/app-same.css" to AppPackManifestRules.ManifestFileEntry(28410L, shaC),
            ),
        )

        val localInventory = mapOf(
            "index.html" to AppPackManifestRules.ManifestFileEntry(1842L, "f".repeat(64)),
            "assets/app-same.css" to AppPackManifestRules.ManifestFileEntry(28410L, shaC),
        )

        val plan = AppPackManifestRules.planIncrementalFiles(manifest) { path, entry ->
            localInventory[path] == entry
        }
        assertEquals(listOf("assets/app-same.css"), plan.reusablePaths)
        assertEquals(listOf("index.html", "assets/app-new.js"), plan.downloadPaths)
    }

    @Test
    fun contractConstantsMatchUnifiedPlanD47() {
        assertEquals("https://pack.askbible.local/", NativeBridgeContract.ORIGIN)
        assertEquals("no-store, no-cache", NativeBridgeContract.CACHE_CONTROL)
        assertEquals(
            setOf("/local-db/chapter", "/local-db/search", "/local-db/translations"),
            NativeBridgeContract.LOCAL_DB_ROUTES,
        )
        assertTrue(NativeBridgeContract.BRIDGE_METHODS.containsAll(listOf(
            "audio.intent",
            "shell.setTab",
            "shell.setTheme",
            "shell.haptic",
            "pack.status",
            "pack.checkNow",
            "pack.downloadTranslation",
            "pack.commitSwap",
            "auth.signIn",
            "auth.getSession",
            "auth.signOut",
            "sys.setReminder",
            "sys.syncWidget",
            "sys.shareImage",
        )))
        assertTrue(NativeBridgeContract.BRIDGE_EVENTS.containsAll(listOf(
            "audio.state",
            "shell.tabSelected",
            "shell.backPressed",
            "pack.readyToSwap",
        )))
    }
}
