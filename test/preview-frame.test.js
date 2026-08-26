const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const test = require("node:test");

const {
  sanitizeAttributes,
  shouldExecuteScript,
} = require("../media/preview-frame.js");

test("safe mode drops scripts, event handlers, and javascript URLs", () => {
  assert.deepEqual(
    sanitizeAttributes(
      { onclick: "run()", href: "javascript:run()", id: "safe-node" },
      "safe",
    ),
    { id: "safe-node" },
  );
  assert.equal(shouldExecuteScript("safe"), false);
});

test("interactive mode executes script elements but not inline event attributes", () => {
  assert.deepEqual(
    sanitizeAttributes({ onclick: "run()", id: "interactive-node" }, "interactive"),
    { id: "interactive-node" },
  );
  assert.equal(shouldExecuteScript("interactive"), true);
});

test("safe mode blocks active embedded documents", () => {
  assert.deepEqual(
    sanitizeAttributes({ srcdoc: "<script>run()</script>", title: "demo" }, "safe"),
    { title: "demo" },
  );
});

test("frame CSP permits the local base URI used by relative resources", () => {
  const panelSource = readFileSync(require.resolve("../src/preview-panel.ts"), "utf8");
  assert.match(panelSource, /base-uri \$\{cspSource\}/);
  assert.match(panelSource, /interactive \? "frame-src https:" : "frame-src 'none'"/);
  const frameSource = readFileSync(require.resolve("../media/preview-frame.js"), "utf8");
  assert.match(frameSource, /getAttribute\("href"\) !== baseUri/);
});

test("preview links cannot navigate the sandbox away from the editor", () => {
  const frameSource = readFileSync(require.resolve("../media/preview-frame.js"), "utf8");
  assert.match(frameSource, /closest\("a\[href\]"\)/);
  assert.match(frameSource, /event\.preventDefault\(\)/);
});

test("interactive updates recreate the frame to clear script side effects", () => {
  const shellSource = readFileSync(require.resolve("../media/preview.js"), "utf8");
  assert.match(shellSource, /currentMode === "interactive" && frameReady/);
  assert.match(shellSource, /rebuildFrame\(\)/);
});

test("interactive inline scripts run through revocable blob URLs", () => {
  const frameSource = readFileSync(require.resolve("../media/preview-frame.js"), "utf8");
  const panelSource = readFileSync(require.resolve("../src/preview-panel.ts"), "utf8");
  assert.match(frameSource, /createObjectURL\(new Blob/);
  assert.match(frameSource, /revokeObjectURL/);
  assert.match(panelSource, /script-src \$\{cspSource\}.*blob: https:/);
  assert.doesNotMatch(panelSource, /script-src[^\n]*unsafe-inline/);
});

test("sandbox frames use independent resource URLs instead of inherited srcdoc CSP", () => {
  const shellSource = readFileSync(require.resolve("../media/preview.js"), "utf8");
  const panelSource = readFileSync(require.resolve("../src/preview-panel.ts"), "utf8");
  assert.doesNotMatch(shellSource, /srcdoc|createFrameDocument/);
  assert.match(shellSource, /frame\.src = currentMode/);
  assert.match(panelSource, /data-safe-src/);
  assert.match(panelSource, /data-interactive-src/);
});

test("document root attributes and direct body selectors are preserved", () => {
  const frameSource = readFileSync(require.resolve("../media/preview-frame.js"), "utf8");
  assert.match(frameSource, /applyRootAttributes\(message\.ast\)/);
  assert.match(frameSource, /target\.setAttribute\("data-hylo-id", node\.nodeId\)/);
  assert.match(frameSource, /TRANSPARENT_ELEMENTS\.has\(tag\) \|\| tag === "body"/);
  assert.doesNotMatch(frameSource, /tag === "body" \? "div"/);
});
