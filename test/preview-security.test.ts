import assert from "node:assert/strict";
import test from "node:test";

import {
  createFrameDocumentCsp,
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

test("host CSP keeps nonce scripts and allows resources the srcdoc frame inherits", () => {
  const csp = createHostCsp("vscode-webview:", "abc123");

  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /script-src 'nonce-abc123'/);
  // 预览帧通过 srcdoc 继承宿主 CSP：宿主需放行交互预览会用到的资源，
  // 安全模式由帧内 CSP meta 再收窄（策略取交集）。
  assert.match(csp, /style-src vscode-webview: 'unsafe-inline' https:/);
  assert.match(csp, /img-src vscode-webview: data: blob: https:/);
  assert.match(csp, /connect-src https:/);
  assert.doesNotMatch(csp, /unsafe-eval|connect-src \*|script-src [^;]*unsafe-inline/);
});

test("frame document CSP narrows safe mode and opens remote resources only when interactive", () => {
  const safe = createFrameDocumentCsp("vscode-webview:", "abc123", "safe");
  assert.match(safe, /script-src 'nonce-abc123' vscode-webview:/);
  assert.match(safe, /connect-src 'none'/);
  assert.match(safe, /frame-src 'none'/);
  assert.doesNotMatch(safe, /img-src[^;]*https:|style-src[^;]*https:/);

  const interactive = createFrameDocumentCsp("vscode-webview:", "abc123", "interactive");
  assert.match(interactive, /script-src 'nonce-abc123' vscode-webview: blob: https:/);
  assert.match(interactive, /connect-src https:/);
  assert.match(interactive, /frame-src https:/);
  assert.match(interactive, /img-src[^;]*https:/);
  assert.match(interactive, /style-src[^;]*https:/);
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
