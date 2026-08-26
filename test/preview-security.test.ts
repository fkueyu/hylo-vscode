import assert from "node:assert/strict";
import test from "node:test";

import {
  createHostCsp,
  isPreviewFrameMessage,
  resolvePreviewMode,
} from "../src/preview-security.ts";

test("untrusted workspaces always resolve to safe preview", () => {
  assert.equal(resolvePreviewMode("interactive", false), "safe");
  assert.equal(resolvePreviewMode("safe", false), "safe");
});

test("trusted workspaces preserve the requested preview mode", () => {
  assert.equal(resolvePreviewMode("interactive", true), "interactive");
  assert.equal(resolvePreviewMode("safe", true), "safe");
});

test("trusted host remains nonce-only while allowing isolated frame resources", () => {
  const csp = createHostCsp("vscode-webview:", "abc123");

  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /script-src 'nonce-abc123'/);
  assert.match(csp, /frame-src vscode-webview:/);
  assert.match(csp, /connect-src 'none'/);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval|blob:|https?:|connect-src \*/);
});

test("frame messages accept only the narrow preview protocol", () => {
  assert.equal(isPreviewFrameMessage({ type: "preview-ready" }), true);
  assert.equal(isPreviewFrameMessage({ type: "node-selected", nodeId: "node-1" }), true);
  assert.equal(
    isPreviewFrameMessage({ type: "render-stats", nodeCount: 4, renderTime: 1.5 }),
    true,
  );

  assert.equal(isPreviewFrameMessage({ type: "node-selected", nodeId: 3 }), false);
  assert.equal(isPreviewFrameMessage({ type: "open-file", path: "/tmp/x" }), false);
  assert.equal(isPreviewFrameMessage(null), false);
});
