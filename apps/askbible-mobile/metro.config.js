const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

function resolveFromApp(pkg) {
  return path.dirname(require.resolve(`${pkg}/package.json`, { paths: [projectRoot] }));
}

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

/** 避免 workspace 根与 app 各装一份 react，导致 Context / Hooks 失效 */
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  react: resolveFromApp("react"),
  "react-native": resolveFromApp("react-native"),
};

config.resolver.assetExts = [...config.resolver.assetExts, "sqlite", "db"];

/** 与仓库根 tsconfig `@/*` 对齐，供 `lib/telemetry` 等共享代码在 Metro 中解析 */
config.resolver.alias = {
  ...(config.resolver.alias ?? {}),
  "@": workspaceRoot,
};

module.exports = config;
