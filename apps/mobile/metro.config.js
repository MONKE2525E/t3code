const fs = require("node:fs");
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");

/** @type {import("expo/metro-config").MetroConfig} */
const config = getDefaultConfig(__dirname);
const workspaceRoot = path.resolve(__dirname, "../..");
// Windows can exhaust its file-handle budget while Metro transforms the
// monorepo and Uniwind's generated stylesheet in parallel. Keep the dev
// server bounded there; other platforms keep Metro's defaults.
if (process.platform === "win32") {
  config.maxWorkers = 1;
}
const escapedWorkspaceRoot = workspaceRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const mobileShikiRoot = path.dirname(require.resolve("shiki/package.json", { paths: [__dirname] }));
const resolveShikiDependencyRoot = (packageName) => {
  const entryPath = require.resolve(packageName, { paths: [mobileShikiRoot] });
  let currentDir = path.dirname(entryPath);

  while (!fs.existsSync(path.join(currentDir, "package.json"))) {
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      throw new Error(`Could not resolve package root for ${packageName}`);
    }
    currentDir = parentDir;
  }

  return currentDir;
};

config.watchFolders = [...new Set([...(config.watchFolders ?? []), workspaceRoot])];
// Windows Metro does not reliably resolve modules hoisted to the workspace
// root; the base config picks up only the app's own node_modules. Other
// platforms keep upstream behavior.
const workspaceNodeModulesPaths =
  process.platform === "win32"
    ? [path.join(__dirname, "node_modules"), path.join(workspaceRoot, "node_modules")]
    : undefined;
config.resolver = {
  ...config.resolver,
  ...(workspaceNodeModulesPaths ? { nodeModulesPaths: workspaceNodeModulesPaths } : {}),
  blockList: [
    ...(Array.isArray(config.resolver?.blockList)
      ? config.resolver.blockList
      : config.resolver?.blockList
        ? [config.resolver.blockList]
        : []),
    new RegExp(`${escapedWorkspaceRoot}[/\\\\]\\.t3[/\\\\].*`),
  ],
  extraNodeModules: {
    // oxlint-disable-next-line unicorn/no-useless-fallback-in-spread
    ...(config.resolver?.extraNodeModules ?? {}),
    shiki: mobileShikiRoot,
    "@shikijs/core": resolveShikiDependencyRoot("@shikijs/core"),
    "@shikijs/engine-javascript": resolveShikiDependencyRoot("@shikijs/engine-javascript"),
    "@shikijs/engine-oniguruma": resolveShikiDependencyRoot("@shikijs/engine-oniguruma"),
    "@shikijs/langs": resolveShikiDependencyRoot("@shikijs/langs"),
    "@shikijs/themes": resolveShikiDependencyRoot("@shikijs/themes"),
    "@shikijs/types": resolveShikiDependencyRoot("@shikijs/types"),
    "@shikijs/vscode-textmate": resolveShikiDependencyRoot("@shikijs/vscode-textmate"),
  },
};

const metroConfig = withUniwindConfig(config, {
  cssEntryFile: "./global.css",
  polyfills: { rem: 14 },
});

// Windows-specific dev-server workarounds, applied to the composed config
// (withUniwindConfig returns a new object, so mutating `config` after this
// point would not reach Metro). These bound this machine's Metro so it does
// not exhaust its file-handle budget; other platforms keep Metro's defaults.
if (process.platform === "win32") {
  // Metro's disk transformer cache leaks file handles on this Windows setup
  // during repeated Uniwind stylesheet transforms. Keep the dev server in
  // memory; local release builds run Metro once and are unaffected.
  metroConfig.cacheStores = [];
}

module.exports = metroConfig;
