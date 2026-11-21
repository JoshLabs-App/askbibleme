package me.askbible.native_.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class PackCatalogRulesTest {
    @Test
    fun parsesV2SchemaAndMapsLocalSqliteKeys() {
        val json = """
            {
              "schemaVersion": 2,
              "generatedAt": "2026-11-20T22:55:27.856Z",
              "packs": [
                {
                  "id": "bible.cuv-simp",
                  "kind": "bible",
                  "path": "v2/packs/cuv-simp.sqlite",
                  "sha256": "f7db650fd8faafca8244250a6f67cfcb63d485d790603547be0d7fa4df68b07b",
                  "sizeBytes": 4206592
                },
                {
                  "id": "companion.xrefs",
                  "kind": "companion",
                  "path": "v2/packs/scripture-xrefs.sqlite",
                  "sha256": "eb2bf5364c56bd7a7db429f4699e13d19918b35e784c353445bbbe0f13c7d787",
                  "sizeBytes": 16896000
                }
              ]
            }
        """.trimIndent()

        val packs = PackCatalogRules.parseCatalogJson(json)
        assertNotNull(packs)
        assertEquals(2, packs!!.size)
        assertEquals("cuv-simp", PackCatalogRules.localPackKey(packs[0]))
        assertEquals("scripture-xrefs", PackCatalogRules.localPackKey(packs[1]))
        assertEquals(
            listOf(
                "https://askbible-media.joshlabs.app/v2/packs/cuv-simp.sqlite",
                "https://askbible.me/v2/packs/cuv-simp.sqlite",
            ),
            PackCatalogRules.candidateDownloadUrls(
                packs[0].path,
                "https://askbible-media.joshlabs.app",
                "https://askbible.me",
            ),
        )
    }
}
