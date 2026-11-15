import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "askbible-web",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-10",
    compatibilityFlags: ["nodejs_compat"],
    routes: [
      {
        pattern: "askbible.joshlabs.app",
        customDomain: true,
      },
    ],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
    },
  }),
});
