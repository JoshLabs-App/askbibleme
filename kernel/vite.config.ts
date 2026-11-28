import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

function formatUtcStamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

function collectFiles(dir: string, root: string, out: Record<string, { size: number; sha256: string }>): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (name === ".DS_Store" || name === "pack-manifest.json") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      collectFiles(full, root, out);
    } else if (st.isFile()) {
      const buf = readFileSync(full);
      const rel = relative(root, full).replaceAll("\\", "/");
      const sha256 = createHash("sha256").update(buf).digest("hex");
      out[rel] = { size: buf.byteLength, sha256 };
    }
  }
}

function packManifestPlugin(outDir: string, bundleId: string): Plugin {
  return {
    name: "askbible-pack-manifest",
    apply: "build",
    closeBundle() {
      const absOut = resolve(process.cwd(), outDir);
      if (!existsSync(absOut)) return;
      const files: Record<string, { size: number; sha256: string }> = {};
      collectFiles(absOut, absOut, files);
      const sortedFiles = Object.fromEntries(
        Object.entries(files).sort(([a], [b]) => a.localeCompare(b)),
      );
      const digest = createHash("sha256")
        .update(JSON.stringify(sortedFiles))
        .digest("hex")
        .slice(0, 7);
      const finalBundleId = `${formatUtcStamp(new Date())}-${digest}`;
      const manifest = {
        schemaVersion: 1,
        bundleId: bundleId || finalBundleId,
        builtAt: new Date().toISOString(),
        entry: "index.html",
        files: sortedFiles,
      };
      writeFileSync(
        join(absOut, "pack-manifest.json"),
        JSON.stringify(manifest, null, 2) + "\n",
        "utf8",
      );
    },
  };
}

const buildHash = process.env.ASKBIBLE_BUNDLE_ID || "";
const shortVersion =
  buildHash || `${formatUtcStamp(new Date())}-dev`;

export default defineConfig({
  base: "/",
  define: {
    __ASKBIBLE_BUNDLE_ID__: JSON.stringify(shortVersion),
    __ASKBIBLE_BUILT_AT__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [react(), packManifestPlugin("dist-pack", buildHash)],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist-pack",
    emptyOutDir: true,
    target: "es2022",
    sourcemap: false,
    cssCodeSplit: true,
    minify: "esbuild",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) {
            return "vendor-react";
          }
          return undefined;
        },
      },
    },
  },
});
