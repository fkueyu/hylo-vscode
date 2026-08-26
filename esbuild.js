// @ts-check
const esbuild = require("esbuild");
const fs = require("node:fs");

const watch = process.argv.includes("--watch");

/** @type {import('esbuild').BuildOptions} */
const config = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  target: "node18",
  sourcemap: watch,
  minify: !watch,
};

/** @type {import('esbuild').BuildOptions} */
const workerConfig = {
  entryPoints: ["src/parser-worker.ts"],
  bundle: true,
  outfile: "dist/parser-worker.js",
  format: "cjs",
  platform: "node",
  target: "node18",
  sourcemap: watch,
  minify: !watch,
};

async function main() {
  if (watch) {
    const [extensionContext, workerContext] = await Promise.all([
      esbuild.context(config),
      esbuild.context(workerConfig),
    ]);
    await Promise.all([extensionContext.watch(), workerContext.watch()]);
    console.log("[esbuild] watching for changes...");
  } else {
    await Promise.all([esbuild.build(config), esbuild.build(workerConfig)]);
    fs.copyFileSync(
      "vendor/hylo-core/dist/browser.js",
      "media/document-structure.js",
    );
    console.log("[esbuild] build complete.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
