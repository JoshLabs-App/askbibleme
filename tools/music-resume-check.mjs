import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ios = path.join(root, "apps/askbible-ios/AskBible");
const dir = mkdtempSync(path.join(tmpdir(), "askbible-music-resume-"));
try {
  execFileSync("swiftc", ["-swift-version", "5", "-module-cache-path", path.join(dir, "cache"),
    ...["Audio/MusicResumeState.swift", "Model/MusicCatalog.swift", "Model/AppLocale.swift",
      "Model/LocaleTables.swift", "Model/SiteCopy.swift", "Model/BibleCatalog.swift", "Theme/ParchmentTheme.swift"]
      .map((file) => path.join(ios, file)),
    path.join(root, "tools/swift-harness/music-resume/main.swift"), "-o", path.join(dir, "check")], { stdio: "inherit" });
  execFileSync(path.join(dir, "check"), [], { stdio: "inherit" });
  execFileSync("./gradlew", [":core:test", "--offline"], {
    cwd: path.join(root, "apps/askbible-android"), stdio: "inherit",
  });
} finally {
  rmSync(dir, { recursive: true, force: true });
}
