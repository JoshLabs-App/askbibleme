const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// Shared lib/ helpers (e.g. legacy-figure display names) without watching all of data/.
config.watchFolders = [path.join(workspaceRoot, "lib")];

// Lower Metro concurrency to keep file-handle pressure down on this machine.
config.maxWorkers = 1;

// Keep Metro scoped to the app root so it does not watch the large workspace
// data tree. The bundled chapter segments now live inside the app.
config.resolver.useWatchman = false;

config.resolver.assetExts = [...config.resolver.assetExts, "sqlite", "db"];

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith("@/")) {
    const aliased = path.join(workspaceRoot, moduleName.slice(2));
    if (defaultResolveRequest) {
      return defaultResolveRequest(context, aliased, platform);
    }
    return context.resolveRequest(context, aliased, platform);
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
