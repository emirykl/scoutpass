const path = require("node:path");

module.exports = {
  packagerConfig: {
    asar: false,
    derefSymlinks: true,
    executableName: "ScoutPass",
    appBundleId: "io.scoutpass.desktop",
    ignore: [
      /^\/(?:\.git|coverage|docs)(?:\/|$)/,
      /^\/(?:backend|frontend)\/(?:src|tests)(?:\/|$)/,
      /^\/\.scoutpass(?:\/|$)/
    ]
  },
  makers: [
    {
      name: "@electron-forge/maker-dmg",
      platforms: ["darwin"],
      config: { name: "ScoutPass" }
    },
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin", "linux", "win32"],
      config: {}
    }
  ],
  hooks: {
    packageAfterCopy: async (_config, buildPath) => {
      const workerPath = path.join(buildPath, "backend", "dist", "runtime", "pear-worker.js");
      if (!require("node:fs").existsSync(workerPath)) {
        throw new Error("Compiled Pear worker is missing from the desktop package.");
      }
      const preloadPath = path.join(buildPath, "backend", "dist", "desktop", "preload.cjs");
      if (!require("node:fs").existsSync(preloadPath)) {
        throw new Error("Compiled Electron preload is missing from the desktop package.");
      }
      for (const dependency of ["pear-runtime", "corestore", "@qvac/sdk", "@tetherto/wdk"]) {
        const dependencyPath = path.join(buildPath, "node_modules", ...dependency.split("/"));
        if (!require("node:fs").existsSync(dependencyPath)) {
          throw new Error(`${dependency} is missing from the desktop package.`);
        }
      }
    }
  }
};
