const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");

test("extension publish runs tests, typecheck, and build before packaging", () => {
  const workflow = read(".github/workflows/publish.yml");
  const testIndex = workflow.indexOf("run: npm test");
  const typecheckIndex = workflow.indexOf("run: npm run typecheck");
  const buildIndex = workflow.indexOf("run: npm run build");
  const packageIndex = workflow.indexOf("vsce package");

  assert.ok(testIndex >= 0, "publish workflow must run npm test");
  assert.ok(typecheckIndex > testIndex, "typecheck must run after tests");
  assert.ok(buildIndex > typecheckIndex, "build must run after typecheck");
  assert.ok(packageIndex > buildIndex, "package must run after all quality gates");
  assert.match(workflow, /Verify VSIX contents/);
  assert.match(workflow, /extension\/dist\/parser-worker\.js/);
  assert.match(workflow, /extension\/media\/preview-frame\.js/);
  assert.match(workflow, /extension\/media\/document-structure\.js/);
});

test("production extension packages exclude source maps", () => {
  assert.match(read("esbuild.js"), /sourcemap:\s*watch/);
  assert.match(read(".vscodeignore"), /dist\/\*\.map/);
  assert.match(read(".vscodeignore"), /vendor\/\*\*/);
});

test("vendored shared core build artifacts remain trackable", () => {
  assert.match(read(".gitignore"), /!vendor\/hylo-core\/dist\/\*\*/);
});

test("extension documentation describes safe sandbox preview accurately", () => {
  const readme = read("README.md");
  assert.doesNotMatch(readme, /Shadow DOM/i);
  assert.match(readme, /Safe Preview|安全预览/);
  assert.match(readme, /sandbox iframe|沙盒 iframe/i);
  assert.match(readme, /Workspace Trust|工作区信任/i);
});

test("restricted workspaces keep only safe preview available", () => {
  const manifest = JSON.parse(read("package.json"));
  assert.equal(manifest.capabilities?.untrustedWorkspaces?.supported, "limited");
  assert.deepEqual(
    manifest.capabilities?.untrustedWorkspaces?.restrictedConfigurations,
    ["hylo.previewMode"],
  );
});

test("extension exports normalize documents and clean temporary PDF files", () => {
  const source = read("src/extension.ts");
  assert.match(source, /normalizeExportDocument/);
  assert.match(source, /temporaryExportFiles/);
  assert.match(source, /unlinkSync/);
  assert.match(source, /await vscode\.env\.openExternal/);
  assert.doesNotMatch(source, /<body>\$\{htmlContent\}<\/body>/);
  assert.match(source, /renameSync\(temporaryPath, saveUri\.fsPath\)/);
});

test("preview host authenticates messages and freezes stale mappings while parsing", () => {
  const panel = read("src/preview-panel.ts");
  const shell = read("media/preview.js");
  assert.match(panel, /sessionToken/);
  assert.match(panel, /nodeMap\.clear\(\)/);
  // 扩展宿主消息：不同 VS Code 版本/分支 event.source 可能是 window、null 或父窗口 proxy，
  // 因此不能用 source 区分宿主消息，改用 sessionToken；帧消息用 channel + contentWindow 校验。
  assert.match(shell, /message\.channel === CHANNEL/);
  assert.match(shell, /event\.source !== frame\.contentWindow/);
  assert.match(shell, /message\.sessionToken !== sessionToken/);
  assert.match(shell, /message\.type === "parsing"/);
});

test("preview frame is rendered from inline srcdoc for restrictive IDE webviews", () => {
  const panel = read("src/preview-panel.ts");
  const shell = read("media/preview.js");
  const security = read("src/preview-security.ts");
  assert.match(panel, /createFrameDocument\("/);
  assert.match(panel, /data-safe-srcdoc/);
  assert.match(panel, /data-interactive-srcdoc/);
  assert.match(panel, /frameErrorSafe/);
  assert.match(shell, /safeSrcdoc/);
  assert.match(shell, /frame\.srcdoc = currentMode === "interactive" \? interactiveSrcdoc : safeSrcdoc/);
  assert.match(shell, /showFrameError/);
  assert.match(security, /style-src \$\{cspSource\} 'unsafe-inline'/);
});

test("local relative CSS/JS/images are inlined before rendering the sandboxed preview", () => {
  const panel = read("src/preview-panel.ts");
  assert.match(panel, /inlineLocalAssets/);
  assert.match(panel, /resolveLocalAsset/);
  assert.match(panel, /readAssetText/);
  assert.match(panel, /readAssetDataUrl/);
  assert.match(panel, /tag === "link"/);
  assert.match(panel, /stylesheet/i);
  assert.match(panel, /node\.tagName = "style"/);
  assert.match(panel, /ast: previewAst/);
});

test("extension sends large documents to a bundled versioned parser worker", () => {
  const panel = read("src/preview-panel.ts");
  const build = read("esbuild.js");
  assert.match(panel, /shouldParseInWorker/);
  assert.match(panel, /new Worker/);
  assert.match(panel, /parseVersion/);
  assert.match(build, /parser-worker/);
});
