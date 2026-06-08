const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// Lower Metro concurrency to keep file-handle pressure down on this machine.
config.maxWorkers = 1;

// Keep Metro scoped to the app root so it does not watch the large workspace
// data tree. The bundled chapter segments now live inside the app.
config.resolver.useWatchman = false;

config.resolver.assetExts = [...config.resolver.assetExts, "sqlite", "db"];
module.exports = config;
